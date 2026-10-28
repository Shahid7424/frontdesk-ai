import type { Reply } from "./grade";
import type { Turn } from "./cases";

/**
 * Talks to a running FrontDesk app exactly like the widget does: POST
 * /api/chat, read the NDJSON stream, keep the conversation id. So an eval
 * covers the whole path a customer hits: rate limits, DB, search, the
 * model, tools and persistence.
 */

interface SlotItem {
  id: string;
  label: string;
}

type Event =
  | { type: "start"; conversationId: string }
  | { type: "text"; delta: string }
  | { type: "citations"; items: Array<{ title: string }> }
  | { type: "slots"; items: SlotItem[] }
  | { type: "payment_link" }
  | { type: "handoff"; reason: string }
  | { type: "error"; message: string }
  | { type: "done" };

export interface TurnResult {
  reply: Reply;
  slots: SlotItem[];
  ms: number;
  /** ms until the first text arrived; null if no text. */
  firstTextMs: number | null;
}

export class RateLimited extends Error {
  constructor(readonly retryAfter: number) {
    super(`rate limited, retry after ${retryAfter}s`);
  }
}

export interface Conversation {
  url: string;
  businessId: string;
  conversationId?: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  lastSlots: SlotItem[];
}

export async function sendTurn(convo: Conversation, turn: Turn): Promise<TurnResult> {
  let content: string;
  let action: { type: "book_slot"; slotId: string; customer: { name: string; phone: string } } | undefined;
  if (typeof turn === "string") {
    content = turn;
  } else {
    const slot = convo.lastSlots[0];
    if (!slot) throw new Error("no slot to tap: the previous reply showed no slot buttons");
    content = slot.label;
    // A fixed test patient, as the widget's name + phone form would send.
    action = { type: "book_slot", slotId: slot.id, customer: { name: "Eval Test Patient", phone: "+919999999999" } };
  }
  convo.messages.push({ role: "user", content });

  const started = Date.now();
  const res = await fetch(new URL("/api/chat", convo.url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      businessId: convo.businessId,
      conversationId: convo.conversationId,
      messages: convo.messages.slice(-40),
      action,
    }),
  });

  if (res.status === 429) throw new RateLimited(Number(res.headers.get("retry-after")) || 60);
  const reply: Reply = { text: "", slots: 0, payment: false, handoff: null, citations: [], error: null };
  const slots: SlotItem[] = [];
  let firstTextMs: number | null = null;

  if (!res.ok || !res.body) {
    reply.error = `HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`;
    return { reply, slots, ms: Date.now() - started, firstTextMs };
  }

  for await (const event of readEvents(res.body)) {
    switch (event.type) {
      case "start":
        convo.conversationId = event.conversationId;
        break;
      case "text":
        if (firstTextMs === null && event.delta.trim()) firstTextMs = Date.now() - started;
        reply.text += event.delta;
        break;
      case "slots":
        slots.push(...event.items);
        reply.slots = slots.length;
        break;
      case "payment_link":
        reply.payment = true;
        break;
      case "handoff":
        reply.handoff = event.reason;
        break;
      case "citations":
        reply.citations = event.items.map((c) => c.title);
        break;
      case "error":
        reply.error = event.message;
        break;
    }
  }

  convo.messages.push({ role: "assistant", content: reply.text });
  convo.lastSlots = slots;
  return { reply, slots, ms: Date.now() - started, firstTextMs };
}

async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<Event> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline: number;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) yield JSON.parse(line) as Event;
    }
  }
  if (buffer.trim()) yield JSON.parse(buffer) as Event;
}
