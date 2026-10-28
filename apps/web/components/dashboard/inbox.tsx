"use client";

import {
  ArrowLeft,
  Bot,
  CheckCheck,
  MessageCircle,
  Hand,
  Phone,
  Search,
  SendHorizontal,
  Sparkles,
  Undo2,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { sendReply, setConversationStatus } from "@/app/(dashboard)/dashboard/inbox/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Conversation, ConversationStatus } from "@/lib/mock/dashboard";
import { cn, formatTime, initials, relativeTime } from "@/lib/utils";
import { ChannelIcon, ConversationStatusBadge } from "./status";

const filters: Array<{ id: "all" | ConversationStatus; label: string }> = [
  { id: "all", label: "All" },
  { id: "needs_human", label: "Needs you" },
  { id: "ai", label: "AI handling" },
  { id: "resolved", label: "Resolved" },
];

/**
 * Owner inbox. Changes show at once and are saved by server actions; the
 * list refreshes every 10 seconds so new chats and messages come in on
 * their own. "Take over" (or any reply) sets the conversation to "human",
 * which stops the AI from replying.
 */
export function Inbox({ initial, sample }: { initial: Conversation[]; sample: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [items, setItems] = useState(initial);
  // Fresh data from the server replaces the local copy.
  useEffect(() => setItems(initial), [initial]);
  useEffect(() => {
    if (sample) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 10_000);
    return () => clearInterval(t);
  }, [router, sample]);
  const [filter, setFilter] = useState<(typeof filters)[number]["id"]>("all");
  const [query, setQuery] = useState("");
  const selectedId = params.get("c");
  const selected = items.find((c) => c.id === selectedId) ?? null;

  const visible = useMemo(
    () =>
      items.filter(
        (c) =>
          (filter === "all" || c.status === filter) &&
          (!query || `${c.customer.name} ${c.messages.map((m) => m.text).join(" ")}`.toLowerCase().includes(query.toLowerCase())),
      ),
    [items, filter, query],
  );

  const select = (id: string | null) => {
    if (id) setItems((all) => all.map((c) => (c.id === id ? { ...c, unread: false } : c)));
    router.replace(id ? `/dashboard/inbox?c=${id}` : "/dashboard/inbox", { scroll: false });
  };

  const update = (id: string, patch: (c: Conversation) => Conversation) =>
    setItems((all) => all.map((c) => (c.id === id ? patch(c) : c)));

  return (
    <div className="grid h-[calc(100dvh-3.5rem)] lg:h-dvh lg:grid-cols-[340px_1fr] xl:grid-cols-[340px_1fr_300px]">
      {/* List */}
      <section
        aria-label="Conversations"
        className={cn("flex min-h-0 flex-col border-r border-black/[0.06] bg-white", selected && "hidden lg:flex")}
      >
        <div className="space-y-3 border-b border-black/[0.06] p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-extrabold tracking-tight">Inbox</h1>
            {sample && <Badge tone="neutral">Sample data</Badge>}
            <Badge tone="amber">{items.filter((c) => c.status === "needs_human").length} need you</Badge>
          </div>
          <label className="relative block">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or message"
              aria-label="Search conversations"
              className="h-9 w-full rounded-xl bg-slate-100 pr-3 pl-9 text-sm outline-none ring-brand-200 transition focus:bg-white focus:ring-4"
            />
          </label>
          <div className="flex gap-1 overflow-x-auto" role="tablist">
            {filters.map((f) => (
              <button
                key={f.id}
                role="tab"
                aria-selected={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "shrink-0 rounded-lg px-2.5 py-1 text-[13px] font-medium transition",
                  filter === f.id ? "bg-ink text-white" : "text-slate-500 hover:bg-black/5",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto p-2">
          {visible.length === 0 && (
            <li className="p-6 text-center text-sm text-slate-400">
              {items.length ? "No conversations here." : "No chats yet. They show up here as soon as a customer writes on your widget."}
            </li>
          )}
          {visible.map((c) => {
            const last = c.messages.at(-1)!;
            return (
              <li key={c.id}>
                <button
                  onClick={() => select(c.id)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl p-3 text-left transition",
                    c.id === selectedId ? "bg-brand-50 ring-1 ring-brand-100" : "hover:bg-black/[0.03]",
                  )}
                >
                  <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                    {initials(c.customer.name)}
                    <span className="absolute -right-0.5 -bottom-0.5 grid size-4.5 place-items-center rounded-full bg-white ring-1 ring-black/5">
                      <ChannelIcon channel={c.channel} className={cn("size-2.5", c.channel === "whatsapp" ? "text-emerald-600" : "text-sky-600")} />
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={cn("truncate text-sm", c.unread ? "font-bold" : "font-semibold")}>{c.customer.name}</span>
                      <span className="ml-auto shrink-0 text-[11px] text-slate-400">{relativeTime(last.at)}</span>
                    </span>
                    <span className={cn("mt-0.5 line-clamp-1 block text-[13px]", c.unread ? "text-ink" : "text-slate-500")}>
                      {last.from === "ai" && "AI: "}
                      {last.from === "owner" && "You: "}
                      {last.text}
                    </span>
                    <span className="mt-1.5 flex items-center gap-1.5">
                      <ConversationStatusBadge status={c.status} />
                      {c.unread && <span className="ml-auto size-2 rounded-full bg-brand-600" aria-label="Unread" />}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Thread */}
      {selected ? (
        <Thread key={selected.id} conversation={selected} onBack={() => select(null)} update={(p) => update(selected.id, p)} />
      ) : (
        <div className="hidden flex-col items-center justify-center gap-3 text-center lg:flex">
          <span className="grid size-14 place-items-center rounded-2xl bg-white shadow-soft ring-1 ring-black/5">
            <Sparkles className="size-6 text-brand-600" />
          </span>
          <p className="font-semibold">Pick a conversation</p>
          <p className="max-w-xs text-sm text-slate-500">
            The AI handles most chats on its own. Ones marked <b>Needs you</b> are waiting for a human.
          </p>
        </div>
      )}

      {/* Customer details */}
      {selected && <CustomerPanel conversation={selected} />}
    </div>
  );
}

function Thread({
  conversation: c,
  onBack,
  update,
}: {
  conversation: Conversation;
  onBack: () => void;
  update: (patch: (c: Conversation) => Conversation) => void;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ownerMode = c.status === "human";

  const send = () => {
    const text = draft.trim();
    if (!text || pending) return;
    update((cur) => ({
      ...cur,
      status: "human",
      messages: [...cur.messages, { id: crypto.randomUUID(), from: "owner", text, at: new Date().toISOString() }],
    }));
    setDraft("");
    setError(null);
    startTransition(async () => {
      const r = await sendReply(c.id, text);
      if (!r.ok) {
        setError(r.error);
        setDraft(text);
      }
    });
  };

  const setStatus = (status: "ai" | "human" | "resolved") => {
    update((cur) => ({ ...cur, status }));
    setError(null);
    startTransition(async () => {
      const r = await setConversationStatus(c.id, status);
      if (!r.ok) setError(r.error);
    });
  };

  return (
    <section aria-label={`Conversation with ${c.customer.name}`} className="flex min-h-0 flex-col bg-canvas">
      <header className="flex items-center gap-3 border-b border-black/[0.06] bg-white px-4 py-3">
        <button onClick={onBack} aria-label="Back to list" className="grid size-9 place-items-center rounded-lg hover:bg-black/5 lg:hidden">
          <ArrowLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 truncate font-semibold">
            {c.customer.name} <ChannelIcon channel={c.channel} />
          </p>
          <p className="text-xs text-slate-500">
            {c.intent} · {c.channel === "whatsapp" ? "WhatsApp" : "Website chat"}
            {c.customer.phone && ` · ${c.customer.phone}`}
          </p>
        </div>
        {c.status !== "resolved" && (
          <Button variant="ghost" size="sm" onClick={() => setStatus("resolved")} disabled={pending}>
            <CheckCheck className="size-3.5" /> Resolve
          </Button>
        )}
        {ownerMode ? (
          <Button variant="secondary" size="sm" onClick={() => setStatus("ai")} disabled={pending}>
            <Undo2 className="size-3.5" /> Hand back to AI
          </Button>
        ) : (
          <Button size="sm" onClick={() => setStatus("human")} disabled={pending}>
            <Hand className="size-3.5" /> Take over
          </Button>
        )}
      </header>

      {c.status === "needs_human" && (
        <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-900">
          <Hand className="mt-0.5 size-4 shrink-0" />
          The AI handed this to you and the customer was told the team will reply here. Your reply appears in their chat within a few seconds.
        </div>
      )}

      <ol className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-5 sm:px-8">
        {c.messages.map((m) => {
          if (m.from === "note") {
            return (
              <li key={m.id} className="mx-auto max-w-[90%] rounded-xl bg-amber-50 px-3 py-2 text-center text-xs text-amber-900 ring-1 ring-amber-200">
                Only you see this: {m.text}
              </li>
            );
          }
          const mine = m.from !== "customer";
          return (
            <li key={m.id} className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}>
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-3.5 py-2 text-[14.5px] leading-relaxed",
                  m.from === "customer" && "rounded-tl-md bg-white ring-1 ring-black/[0.06]",
                  m.from === "ai" && "rounded-tr-md bg-brand-50 text-brand-950 ring-1 ring-brand-100",
                  m.from === "owner" && "rounded-tr-md bg-ink text-white",
                )}
              >
                {m.text}
              </div>
              <span className="flex items-center gap-1 px-1 text-[11px] text-slate-400">
                {m.from === "ai" && <><Bot className="size-3" /> AI ·</>}
                {m.from === "owner" && "You ·"} {formatTime(m.at)}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="border-t border-black/[0.06] bg-white p-3">
        {error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        {!ownerMode && (
          <p className="mb-2 px-1 text-xs text-slate-500">
            Typing a reply takes over from the AI for this conversation.
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-end gap-2"
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={`Reply to ${c.customer.name.split(" ")[0]}…`}
            aria-label="Reply"
            className="max-h-32 min-h-11 flex-1 resize-none rounded-xl bg-slate-100 px-3.5 py-2.5 text-sm outline-none ring-brand-200 transition focus:bg-white focus:ring-4"
          />
          <Button type="submit" size="icon" className="size-11 rounded-xl" aria-label="Send" disabled={!draft.trim()}>
            <SendHorizontal className="size-4" />
          </Button>
        </form>
      </div>
    </section>
  );
}

function CustomerPanel({ conversation: c }: { conversation: Conversation }) {
  const rows: Array<[string, React.ReactNode]> = [
    ["Phone", c.customer.phone ?? "Not shared yet"],
    ...(c.customer.visits !== undefined ? [["Visits", `${c.customer.visits} total`] as [string, string]] : []),
    ["Channel", c.channel === "whatsapp" ? "WhatsApp" : "Website chat"],
    ["Model", c.model ? <Badge key="m" tone="neutral">{modelName(c.model)}</Badge> : "-"],
    ["AI cost so far", `₹${c.costInr.toFixed(2)}`],
  ];
  return (
    <aside className="hidden min-h-0 overflow-y-auto border-l border-black/[0.06] bg-white p-5 xl:block">
      <div className="text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-slate-100 text-lg font-bold text-slate-600">
          {initials(c.customer.name)}
        </span>
        <p className="mt-3 font-semibold">{c.customer.name}</p>
        <p className="text-xs text-slate-500">Last active {relativeTime(c.messages.at(-1)!.at)}</p>
      </div>
      {c.customer.phone && (
        <div className="mt-5 grid grid-cols-2 gap-2">
          <a href={`tel:${c.customer.phone}`} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-slate-100 text-sm font-medium hover:bg-slate-200">
            <Phone className="size-3.5" /> Call
          </a>
          <a
            href={`https://wa.me/${c.customer.phone.replace(/\D/g, "")}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-slate-100 text-sm font-medium hover:bg-slate-200"
          >
            <MessageCircle className="size-3.5" /> WhatsApp
          </a>
        </div>
      )}
      <dl className="mt-6 divide-y divide-black/5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3 py-2.5">
            <dt className="text-slate-500">{k}</dt>
            <dd className="text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 rounded-xl bg-slate-50 p-4 ring-1 ring-black/5">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          <Sparkles className="size-3.5 text-brand-600" /> Next step
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
          {c.intent} conversation. {c.status === "needs_human" ? "Customer is waiting for a human reply." : "No action pending."}
        </p>
      </div>
    </aside>
  );
}

function modelName(model: string) {
  if (model.startsWith("claude-sonnet")) return "Claude Sonnet";
  if (model.startsWith("claude-haiku")) return "Claude Haiku";
  if (model.includes("gpt-oss")) return "Groq (free)";
  return model;
}
