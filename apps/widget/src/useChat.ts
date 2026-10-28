import {
  CHAT_LANGUAGES,
  readEvents,
  type ChatAction,
  type ChatLanguage,
  type ChatMessage,
  type Citation,
  type CustomerDetails,
  type PaymentLink,
  type Slot,
} from "@frontdesk/core";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

export interface UIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  slots?: Slot[];
  chosenSlotId?: string;
  /** The tap was sent (after name and phone), so the slot buttons stay locked. */
  slotSent?: boolean;
  /** A reply typed by the business's staff in their inbox. */
  fromTeam?: boolean;
  payment?: PaymentLink;
  handoff?: boolean;
  error?: string;
  streaming?: boolean;
}

interface Options {
  apiBase: string;
  businessId: string;
  language: ChatLanguage;
  connectionError: string;
}

const uid = () => Math.random().toString(36).slice(2, 10);

/** sessionStorage can throw (Safari private mode, blocked cookies). */
const storage = {
  get<T>(key: string): T | null {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  set(key: string, value: unknown) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* not critical: the chat just won't survive a reload */
    }
  },
};

/** The customer's language choice, remembered across pages and visits. */
export function useLanguage(businessId: string) {
  const key = `frontdesk:lang:${businessId}`;
  const [language, setLanguage] = useState<ChatLanguage>(() => {
    try {
      const saved = localStorage.getItem(key) as ChatLanguage | null;
      return saved && CHAT_LANGUAGES.includes(saved) ? saved : "auto";
    } catch {
      return "auto";
    }
  });
  const choose = useCallback(
    (next: ChatLanguage) => {
      setLanguage(next);
      try {
        localStorage.setItem(key, next);
      } catch {
        /* the choice just won't be remembered */
      }
    },
    [key],
  );
  return [language, choose] as const;
}

export function useChat({ apiBase, businessId, language, connectionError }: Options) {
  const key = `frontdesk:${businessId}`;
  const saved = storage.get<{ conversationId?: string; messages: UIMessage[] }>(key);

  const [messages, setMessages] = useState<UIMessage[]>(saved?.messages ?? []);
  const [busy, setBusy] = useState(false);
  const conversationId = useRef<string | undefined>(saved?.conversationId);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    // Don't persist half-streamed replies.
    if (!busy) storage.set(key, { conversationId: conversationId.current, messages });
  }, [messages, busy, key]);

  useEffect(() => () => abort.current?.abort(), []);

  const patch = (id: string, update: (m: UIMessage) => UIMessage) =>
    setMessages((all) => all.map((m) => (m.id === id ? update(m) : m)));

  const send = useCallback(
    async (text: string, action?: ChatAction) => {
      const content = text.trim();
      if (!content || busy) return;

      const user: UIMessage = { id: uid(), role: "user", content };
      const reply: UIMessage = { id: uid(), role: "assistant", content: "", streaming: true };
      const history: ChatMessage[] = [...messages, user]
        .filter((m) => !m.error && m.content)
        .slice(-20)
        .map(({ role, content }) => ({ role, content }));

      setMessages((all) => [...all, user, reply]);
      setBusy(true);
      abort.current = new AbortController();

      try {
        const res = await fetch(`${apiBase}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId,
            conversationId: conversationId.current,
            messages: history,
            action,
            language,
            bookingIds: bookingStore.get(businessId),
          }),
          signal: abort.current.signal,
        });
        if (!res.ok || !res.body) {
          // Rate limits and blocked sites come with a message meant for the customer.
          const body = (await res.json().catch(() => null)) as { message?: string } | null;
          if (body?.message) {
            patch(reply.id, (m) => ({ ...m, error: body.message }));
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }

        for await (const event of readEvents(res.body)) {
          switch (event.type) {
            case "start":
              conversationId.current = event.conversationId;
              break;
            case "text":
              patch(reply.id, (m) => ({ ...m, content: m.content + event.delta }));
              break;
            case "citations":
              patch(reply.id, (m) => ({ ...m, citations: event.items }));
              break;
            case "slots":
              patch(reply.id, (m) => ({ ...m, slots: event.items }));
              break;
            case "booked":
              bookingStore.add(businessId, event.bookingId);
              break;
            case "payment_link":
              bookingStore.add(businessId, event.link.bookingId);
              patch(reply.id, (m) => ({
                ...m,
                payment: { ...event.link, url: new URL(event.link.url, apiBase).toString() },
              }));
              break;
            case "handoff":
              patch(reply.id, (m) => ({ ...m, handoff: true }));
              break;
            case "error":
              patch(reply.id, (m) => ({ ...m, error: event.message }));
              break;
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          patch(reply.id, (m) => ({
            ...m,
            error: connectionError,
          }));
        }
      } finally {
        patch(reply.id, (m) => ({ ...m, streaming: false }));
        setBusy(false);
      }
    },
    [apiBase, businessId, busy, messages, language, connectionError],
  );

  /** First tap only picks the slot; the name + phone form then holds it. */
  const chooseSlot = useCallback((messageId: string, slot: Slot | null) => {
    patch(messageId, (m) => ({ ...m, chosenSlotId: slot?.id }));
  }, []);

  const confirmSlot = useCallback(
    (messageId: string, slot: Slot, customer: CustomerDetails) => {
      customerStore.set(businessId, customer);
      patch(messageId, (m) => ({ ...m, slotSent: true }));
      void send(`${slot.label} · ${slot.staffName}`, { type: "book_slot", slotId: slot.id, customer });
    },
    [send, businessId],
  );

  /** A slot offered to move an existing booking: no form, the customer is already known. */
  const moveSlot = useCallback(
    (messageId: string, slot: Slot) => {
      patch(messageId, (m) => ({ ...m, chosenSlotId: slot.id, slotSent: true }));
      void send(`${slot.label} · ${slot.staffName}`, { type: "book_slot", slotId: slot.id, rescheduleOf: slot.rescheduleOf });
    },
    [send],
  );

  // Replies the clinic's staff type in their inbox, and notices such as "payment received".
  // Ids are kept so each shows once.
  const pollTeam = useCallback(async () => {
    if (!conversationId.current || busy) return;
    try {
      const params = new URLSearchParams({ businessId, conversationId: conversationId.current });
      const res = await fetch(`${apiBase}/api/chat/updates?${params}`);
      if (!res.ok) return;
      const { messages: team } = (await res.json()) as { messages: Array<{ id: string; from?: "team" | "system"; content: string }> };
      setMessages((all) => {
        const seen = new Set(all.map((m) => m.id));
        const fresh = team.filter((t) => !seen.has(`team-${t.id}`));
        return fresh.length
          ? [...all, ...fresh.map((t) => ({ id: `team-${t.id}`, role: "assistant" as const, content: t.content, fromTeam: t.from !== "system" }))]
          : all;
      });
    } catch {
      /* offline for a moment; the next poll catches up */
    }
  }, [apiBase, businessId, busy]);

  const reset = useCallback(() => {
    abort.current?.abort();
    conversationId.current = undefined;
    setMessages([]);
  }, []);

  return { messages, busy, send, chooseSlot, confirmSlot, moveSlot, pollTeam, reset, savedCustomer: () => customerStore.get(businessId) };
}

/** Name and number from the last booking, so a returning patient doesn't type them again. */
const customerStore = {
  get(businessId: string): CustomerDetails | null {
    try {
      const raw = localStorage.getItem(`frontdesk:customer:${businessId}`);
      return raw ? (JSON.parse(raw) as CustomerDetails) : null;
    } catch {
      return null;
    }
  },
  set(businessId: string, details: CustomerDetails) {
    try {
      localStorage.setItem(`frontdesk:customer:${businessId}`, JSON.stringify(details));
    } catch {
      /* they'll just type it again next time */
    }
  },
};

/**
 * Bookings made from this browser, newest first. A booking id is the
 * customer's proof that a booking is theirs, so a later chat can cancel
 * or move it.
 */
const bookingStore = {
  get(businessId: string): string[] {
    try {
      const raw = localStorage.getItem(`frontdesk:bookings:${businessId}`);
      const ids = raw ? (JSON.parse(raw) as unknown) : [];
      return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string").slice(0, 10) : [];
    } catch {
      return [];
    }
  },
  add(businessId: string, id: string) {
    try {
      const ids = [id, ...bookingStore.get(businessId).filter((x) => x !== id)].slice(0, 10);
      localStorage.setItem(`frontdesk:bookings:${businessId}`, JSON.stringify(ids));
    } catch {
      /* the team can still help from the inbox */
    }
  },
};
