import "server-only";
import {
  bookings as sampleBookings,
  conversations as sampleConversations,
  weekly as sampleWeekly,
  type Booking,
  type Conversation,
  type InboxMessage,
} from "@/lib/mock/dashboard";
import { createClient } from "@/lib/supabase/server";
import type { BusinessContext } from "./business";

/** Rough rupees per dollar, for showing LLM cost to Indian owners. */
export const USD_INR = 88;

export interface DayStats {
  day: string;
  conversations: number;
  aiResolved: number;
  bookings: number;
}

/** Sample data in demo mode; the business's real rows (through RLS) once signed in. */
export async function getConversations(ctx: BusinessContext): Promise<{ items: Conversation[]; sample: boolean }> {
  if (ctx.mode === "demo") return { items: sampleConversations, sample: true };
  if (!ctx.business) return { items: [], sample: false };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, channel, status, last_message_at, cost_usd, customers(name, phone), messages(id, role, content, created_at, model, metadata)")
    .eq("business_id", ctx.business.id)
    .order("last_message_at", { ascending: false })
    .order("created_at", { referencedTable: "messages" })
    .limit(80)
    .limit(100, { referencedTable: "messages" });
  if (error) throw new Error(`Could not load conversations: ${error.message}`);

  // The generated types don't list relationships, so embedded rows are typed by hand.
  type Row = { id: string; role: string; content: string; created_at: string; model: string | null; metadata: unknown };
  const items = (data ?? []).flatMap((c): Conversation[] => {
    // Tool rows are internal, except notes written for staff (e.g. "payment came after the slot was taken").
    const rows = (c.messages as unknown as Row[]).filter((m) => m.role !== "tool" || (m.metadata as { staffNote?: boolean } | null)?.staffNote);
    if (!rows.length) return [];
    const customer = c.customers as unknown as { name: string | null; phone: string | null } | null;
    const messages: InboxMessage[] = rows.map((m) => ({
      id: m.id,
      from: (m.role === "tool" ? "note" : m.role) as InboxMessage["from"],
      text: m.content,
      at: m.created_at,
    }));
    return [
      {
        id: c.id,
        customer: { name: customer?.name ?? `Visitor ${c.id.slice(0, 4).toUpperCase()}`, phone: customer?.phone ?? null },
        channel: c.channel,
        status: c.status,
        intent: topic(rows.map((m) => m.metadata)),
        unread: c.status === "needs_human",
        costInr: Number(c.cost_usd) * USD_INR,
        model: [...rows].reverse().find((m) => m.role === "ai" && m.model)?.model ?? null,
        messages,
      },
    ];
  });
  return { items, sample: false };
}

/** A one-word topic for the list, from what the AI did in the chat. */
function topic(metadata: unknown[]): string {
  const meta = metadata as Array<{ handoff?: { reason?: string } | null; appointmentId?: string; toolCalls?: Array<{ name: string }> }>;
  const handoff = meta.find((m) => m?.handoff)?.handoff?.reason;
  if (handoff === "complaint") return "Complaint";
  if (handoff === "medical") return "Medical question";
  if (handoff) return "Needs a person";
  if (meta.some((m) => m?.appointmentId)) return "Booking";
  if (meta.some((m) => m?.toolCalls?.some((t) => t.name === "check_availability"))) return "Booking enquiry";
  return "Question";
}

export async function getBookings(ctx: BusinessContext): Promise<{ items: Booking[]; sample: boolean }> {
  if (ctx.mode === "demo") return { items: sampleBookings, sample: true };
  if (!ctx.business) return { items: [], sample: false };

  const supabase = await createClient();
  const from = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("appointments")
    .select("id, starts_at, status, source, amount_paise, hold_expires_at, customers(name, phone), services(name), staff(name)")
    .eq("business_id", ctx.business.id)
    .gte("starts_at", from)
    .order("starts_at")
    .limit(500);
  if (error) throw new Error(`Could not load bookings: ${error.message}`);

  const now = Date.now();
  const items = (data ?? []).map((a): Booking => {
    const customer = a.customers as unknown as { name: string | null; phone: string | null } | null;
    const lapsed = a.status === "pending_payment" && (!a.hold_expires_at || new Date(a.hold_expires_at).getTime() < now);
    // A hold that ran out is released by the system (cancelled with a hold time), not by the clinic.
    const expired = lapsed || (a.status === "cancelled" && a.hold_expires_at !== null);
    return {
      id: a.id,
      customer: customer?.name ?? "No name given",
      phone: customer?.phone ?? null,
      service: (a.services as unknown as { name: string } | null)?.name ?? "Service",
      staff: (a.staff as unknown as { name: string } | null)?.name ?? "",
      startsAt: a.starts_at,
      amountInr: a.amount_paise / 100,
      status: expired ? "expired" : a.status,
      source: a.source,
    };
  });
  return { items, sample: false };
}

/** Last 7 days in IST, oldest first: conversations, how many the AI handled alone, and bookings made. */
export async function getWeekly(ctx: BusinessContext): Promise<{ days: DayStats[]; costUsd: number; conversations: number }> {
  if (ctx.mode === "demo" || !ctx.business) {
    return { days: sampleWeekly, costUsd: 0.006 * sampleWeekly.reduce((n, d) => n + d.conversations, 0), conversations: 0 };
  }
  const supabase = await createClient();
  const businessId = ctx.business.id;
  const keys = Array.from({ length: 7 }, (_, i) => istKey(new Date(Date.now() - (6 - i) * 86_400_000)));
  const since = `${keys[0]}T00:00:00+05:30`;

  const [convs, owner, appts] = await Promise.all([
    supabase.from("conversations").select("id, status, created_at, cost_usd").eq("business_id", businessId).gte("created_at", since).limit(10_000),
    supabase.from("messages").select("conversation_id").eq("business_id", businessId).eq("role", "owner").gte("created_at", since).limit(10_000),
    supabase
      .from("appointments")
      .select("created_at, status, hold_expires_at")
      .eq("business_id", businessId)
      .in("source", ["web", "whatsapp"])
      .gte("created_at", since)
      .limit(10_000),
  ]);
  const ownerReplied = new Set((owner.data ?? []).map((m) => m.conversation_id));

  const days = keys.map((key) => ({
    day: new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" }).format(new Date(`${key}T12:00:00+05:30`)),
    conversations: 0,
    aiResolved: 0,
    bookings: 0,
  }));
  let costUsd = 0;
  for (const c of convs.data ?? []) {
    const d = days[keys.indexOf(istKey(new Date(c.created_at)))];
    if (!d) continue;
    d.conversations++;
    costUsd += Number(c.cost_usd);
    const handed = c.status === "needs_human" || c.status === "human" || ownerReplied.has(c.id);
    if (!handed) d.aiResolved++;
  }
  for (const a of appts.data ?? []) {
    // Holds that lapsed without payment aren't bookings.
    if (a.status === "cancelled" || (a.status === "pending_payment" && a.hold_expires_at && new Date(a.hold_expires_at).getTime() < Date.now())) continue;
    const d = days[keys.indexOf(istKey(new Date(a.created_at)))];
    if (d) d.bookings++;
  }
  return { days, costUsd, conversations: convs.data?.length ?? 0 };
}

const istKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/** Conversations the AI handed over that nobody has picked up yet. */
export async function countNeedsYou(ctx: BusinessContext): Promise<number> {
  if (ctx.mode === "demo") return sampleConversations.filter((c) => c.status === "needs_human").length;
  if (!ctx.business) return 0;
  const supabase = await createClient();
  const { count } = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("business_id", ctx.business.id)
    .eq("status", "needs_human");
  return count ?? 0;
}
