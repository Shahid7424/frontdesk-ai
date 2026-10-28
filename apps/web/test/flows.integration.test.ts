/**
 * Days 3-9 end to end against a real Postgres with the real migrations and
 * seed: the chat route (search, agent, tools, booking with name + phone),
 * the widget's polling endpoint, the owner's inbox and bookings actions
 * (through RLS as a signed-in owner), dashboard queries, the test payment
 * page and the Razorpay webhook.
 *
 * Supabase's REST server isn't available here, so test/postgrest-standin.ts
 * plays its part, and the model is a scripted stand-in on the real Groq
 * adapter (so tool calls run through the real executor).
 *
 * Needs DATABASE_URL like packages/db's tests; skipped without it.
 */
import { createHmac } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type Groq from "groq-sdk";
import pg from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { isoClient, loadColumns, standIn } from "./postgrest-standin";

const ADMIN_URL = process.env.DATABASE_URL;
const dbRoot = join(import.meta.dirname, "../../../packages/db");
const dbName = `fd_flows_${Date.now()}`;
let admin: pg.Client;
let db: pg.Client;

const BIZ = "00000000-0000-4000-a000-000000000001";
const GP = "00000000-0000-4000-a002-000000000001"; // General consultation, ₹500
const OWNER = { id: "00000000-0000-4000-b000-000000000001", email: "owner@sunrise.test" };
const OTHER = { id: "00000000-0000-4000-b000-000000000002", email: "other@elsewhere.test" };
let signedIn = OWNER;

// --- Stand-ins for Supabase, Next and the model ------------------------------

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => standIn(db, { role: "service" }),
  createClient: async () => standIn(db, { role: "user", userId: signedIn.id, email: signedIn.email }),
}));
vi.mock("@/lib/env", () => ({ supabaseUrl: "http://stand-in", supabaseAnonKey: "anon", isSupabaseConfigured: true }));
vi.mock("@/lib/knowledge/embedder", () => ({ embedder: null }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "app.test", "x-forwarded-proto": "https" }),
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}));
const background: Promise<unknown>[] = [];
vi.mock("next/server", () => ({ after: (fn: () => unknown) => background.push(Promise.resolve().then(fn)) }));

type Turn = { text?: string; toolCall?: { name: string; arguments: string } };
const script: Turn[] = [];
vi.mock("@/lib/agent/provider", async () => {
  const { runGroqAgent } = await import("@frontdesk/core/agent");
  return {
    isAgentConfigured: () => true,
    friendlyError: () => "Kuch gadbad ho gayi.",
    startAgent: (input: object) => runGroqAgent({ ...(input as Record<string, unknown>), client: fakeGroq() } as never),
  };
});

/** Plays the scripted turns as Groq streaming chunks. */
function fakeGroq() {
  return {
    chat: {
      completions: {
        async create() {
          const turn = script.shift() ?? { text: "Ji, bataiye." };
          const chunks: unknown[] = [];
          if (turn.text) chunks.push({ choices: [{ index: 0, delta: { content: turn.text } }] });
          if (turn.toolCall) {
            chunks.push({ choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: "call_1", function: turn.toolCall }] } }] });
          }
          chunks.push({ choices: [{ index: 0, delta: {}, finish_reason: turn.toolCall ? "tool_calls" : "stop" }], x_groq: { usage: { prompt_tokens: 100, completion_tokens: 10 } } });
          return { async *[Symbol.asyncIterator]() { yield* chunks; } };
        },
      },
    },
  } as unknown as Groq;
}

// --- Helpers ------------------------------------------------------------------

type Event = { type: string; [k: string]: unknown };

let ip = 0;
async function chat(body: Record<string, unknown>): Promise<{ status: number; events: Event[]; text: string; conversationId?: string }> {
  const { POST } = await import("@/app/api/chat/route");
  // A fresh IP per request keeps the in-memory rate limiter out of the way.
  const res = await POST(
    new Request("http://app.test/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": `10.0.0.${++ip}` },
      body: JSON.stringify({ businessId: "sunrise-clinic", ...body }),
    }),
  );
  if (!res.ok) return { status: res.status, events: [], text: "" };
  const events = (await res.text()).trim().split("\n").map((l) => JSON.parse(l) as Event);
  await Promise.all(background.splice(0));
  return {
    status: res.status,
    events,
    text: events.map((e) => (e.type === "text" ? String(e.delta) : "")).join(""),
    conversationId: events.find((e) => e.type === "start")?.conversationId as string | undefined,
  };
}

async function updates(conversationId: string) {
  const { GET } = await import("@/app/api/chat/updates/route");
  const res = await GET(new Request(`http://app.test/api/chat/updates?businessId=sunrise-clinic&conversationId=${conversationId}`, { headers: { "x-forwarded-for": "10.9.9.9" } }));
  return (await res.json()) as { messages: Array<{ from: string; content: string }> };
}

/** Customer asks for a GP slot tomorrow; returns the conversation and the offered slots. */
async function askForSlots() {
  script.push({ toolCall: { name: "check_availability", arguments: JSON.stringify({ service_id: GP, date: "tomorrow" }) } }, { text: "Ye slots khaali hain, tap kijiye." });
  const r = await chat({ messages: [{ role: "user", content: "Kal general consultation chahiye" }] });
  const slots = r.events.find((e) => e.type === "slots")?.items as Array<{ id: string; label: string }>;
  return { conversationId: r.conversationId!, slots };
}

async function tap(conversationId: string, slot: { id: string; label: string }, customer?: { name: string; phone: string }) {
  return chat({ conversationId, messages: [{ role: "user", content: slot.label }], action: { type: "book_slot", slotId: slot.id, ...(customer ? { customer } : {}) } });
}

const one = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows[0];

// --- Setup ----------------------------------------------------------------------

describe.skipIf(!ADMIN_URL)("customer and owner flows (Postgres)", () => {
  beforeAll(async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
    admin = new pg.Client({ connectionString: ADMIN_URL });
    await admin.connect();
    await admin.query(`create database ${dbName}`);
    const url = new URL(ADMIN_URL!);
    url.pathname = `/${dbName}`;
    db = isoClient(url.toString());
    await db.connect();
    const migrations = readdirSync(join(dbRoot, "supabase/migrations")).sort();
    for (const f of ["test/supabase-shim.sql", ...migrations.map((m) => `supabase/migrations/${m}`), "supabase/seed.sql", "supabase/seed-knowledge.sql"]) {
      await db.query(readFileSync(join(dbRoot, f), "utf8"));
    }
    await loadColumns(db);
    // The demo clinic gets an owner; OTHER owns nothing here.
    await db.query("insert into auth.users (id, email) values ($1, $2), ($3, $4)", [OWNER.id, OWNER.email, OTHER.id, OTHER.email]);
    await db.query("insert into public.members (business_id, user_id, role) values ($1, $2, 'owner')", [BIZ, OWNER.id]);
  });

  afterAll(async () => {
    await db?.end();
    await admin?.query(`drop database if exists ${dbName} with (force)`);
    await admin?.end();
  });

  beforeEach(() => {
    signedIn = OWNER;
    script.length = 0;
  });

  // --- Chat --------------------------------------------------------------------

  it("answers from documents with a source chip and saves both messages", async () => {
    script.push({ text: "Haan, car parking basement mein hai [1]." });
    const r = await chat({ messages: [{ role: "user", content: "Car parking hai kya?" }] });
    expect(r.text).toBe("Haan, car parking basement mein hai.");
    expect(r.events.find((e) => e.type === "citations")).toMatchObject({ items: [{ title: "Clinic FAQ" }] });
    const { n } = await one("select count(*)::int n from public.messages where conversation_id = $1", [r.conversationId]);
    expect(n).toBe(2);
  });

  it("shows slots, then asks for name and phone before holding one", async () => {
    const { conversationId, slots } = await askForSlots();
    expect(slots.length).toBeGreaterThan(0);

    const noDetails = await tap(conversationId, slots[0]!);
    expect(noDetails.text).toMatch(/naam aur sahi 10 digit mobile/);
    const badPhone = await tap(conversationId, slots[0]!, { name: "Ravi Kumar", phone: "12345" });
    expect(badPhone.text).toMatch(/naam aur sahi 10 digit mobile/);
    expect((await one("select count(*)::int n from public.appointments")).n).toBe(0);

    const held = await tap(conversationId, slots[0]!, { name: "Ravi Kumar", phone: "98220 41118" });
    expect(held.text).toMatch(/hold kar diya/);
    const pay = held.events.find((e) => e.type === "payment_link") as unknown as { link: { url: string; bookingId: string; amountInPaise: number } };
    expect(pay.link).toMatchObject({ url: `/pay/${pay.link.bookingId}`, amountInPaise: 50000 });

    const a = await one(
      "select a.status, a.amount_paise, c.name, c.phone, v.customer_id = c.id as linked from public.appointments a join public.customers c on c.id = a.customer_id join public.conversations v on v.id = $2 where a.id = $1",
      [pay.link.bookingId, conversationId],
    );
    expect(a).toEqual({ status: "pending_payment", amount_paise: 50000, name: "Ravi Kumar", phone: "+919822041118", linked: true });
  });

  it("keeps one customer per phone across bookings", async () => {
    const first = await askForSlots();
    await tap(first.conversationId, first.slots.at(-1)!, { name: "Asha", phone: "9876500001" });
    const second = await askForSlots();
    await tap(second.conversationId, second.slots.at(-2)!, { name: "Asha Patil", phone: "+91 98765 00001" });
    const { rows } = await db.query("select name from public.customers where phone = '+919876500001'");
    expect(rows).toEqual([{ name: "Asha Patil" }]);
  });

  it("refuses a slot someone else just took", async () => {
    const a = await askForSlots();
    const b = await askForSlots();
    const slot = a.slots[1]!;
    await tap(a.conversationId, slot, { name: "First", phone: "9000000001" });
    const late = await tap(b.conversationId, slot, { name: "Second", phone: "9000000002" });
    expect(late.text).toMatch(/kisi aur ne le liya/);
    expect(late.events.some((e) => e.type === "payment_link")).toBe(false);
  });

  it("re-sends the payment card for 'payment link do' through show_booking", async () => {
    const { conversationId, slots } = await askForSlots();
    const held = await tap(conversationId, slots[2]!, { name: "Meera", phone: "9000000003" });
    const bookingId = (held.events.find((e) => e.type === "payment_link") as unknown as { link: { bookingId: string } }).link.bookingId;
    script.push({ toolCall: { name: "show_booking", arguments: "{}" } }, { text: "Ye raha payment card." });
    const again = await chat({ conversationId, messages: [{ role: "user", content: "Payment link phir se bhejo" }] });
    expect(again.events.find((e) => e.type === "payment_link")).toMatchObject({ link: { bookingId } });
  });

  // --- Inbox ---------------------------------------------------------------------

  it("delivers the owner's reply to the widget and keeps the AI quiet after", async () => {
    script.push({ text: "Main team ko bata deti hoon." , toolCall: { name: "handoff_to_human", arguments: JSON.stringify({ reason: "customer_requested", summary: "Wants a person" }) } }, { text: "" });
    const r = await chat({ messages: [{ role: "user", content: "Mujhe kisi insaan se baat karni hai" }] });
    expect(r.events.some((e) => e.type === "handoff")).toBe(true);
    expect((await one("select status from public.conversations where id = $1", [r.conversationId])).status).toBe("needs_human");

    const { countNeedsYou } = await import("@/lib/data/dashboard");
    const { getBusinessContext } = await import("@/lib/data/business");
    expect(await countNeedsYou(await getBusinessContext())).toBeGreaterThanOrEqual(1);

    expect((await updates(r.conversationId!)).messages).toEqual([]);
    const { sendReply } = await import("@/app/(dashboard)/dashboard/inbox/actions");
    expect(await sendReply(r.conversationId!, "Namaste, main clinic se bol raha hoon")).toEqual({ ok: true });
    expect((await updates(r.conversationId!)).messages).toMatchObject([{ from: "team", content: "Namaste, main clinic se bol raha hoon" }]);
    expect((await one("select status from public.conversations where id = $1", [r.conversationId])).status).toBe("human");

    const next = await chat({ conversationId: r.conversationId, messages: [{ role: "user", content: "Theek hai" }] });
    expect(next.text).toMatch(/team tak pahunch gaya/);

    const { setConversationStatus } = await import("@/app/(dashboard)/dashboard/inbox/actions");
    expect(await setConversationStatus(r.conversationId!, "ai")).toEqual({ ok: true });
    script.push({ text: "Ji, bataiye kya madad karoon?" });
    expect((await chat({ conversationId: r.conversationId, messages: [{ role: "user", content: "Fees kitni hai?" }] })).text).toBe("Ji, bataiye kya madad karoon?");
  });

  it("lists real conversations and bookings for the owner, and nothing for anyone else", async () => {
    const { getConversations, getBookings, getWeekly } = await import("@/lib/data/dashboard");
    const { getBusinessContext } = await import("@/lib/data/business");
    const ctx = await getBusinessContext();
    expect(ctx).toMatchObject({ mode: "live", business: { id: BIZ } });

    const convs = await getConversations(ctx);
    expect(convs.sample).toBe(false);
    const ravi = convs.items.find((c) => c.customer.name === "Ravi Kumar");
    expect(ravi).toMatchObject({ customer: { phone: "+919822041118" }, intent: "Booking", channel: "web" });
    expect(ravi!.messages[0]!.from).toBe("customer");
    expect(ravi!.messages.map((m) => m.at)).toEqual([...ravi!.messages.map((m) => m.at)].sort());

    const bookings = await getBookings(ctx);
    expect(bookings.items.find((b) => b.customer === "Ravi Kumar")).toMatchObject({ phone: "+919822041118", service: "General consultation", staff: "Dr. Anjali Mehta", status: "pending_payment", amountInr: 500, source: "web" });

    const weekly = await getWeekly(ctx);
    expect(weekly.days).toHaveLength(7);
    expect(weekly.days.at(-1)!.conversations).toBeGreaterThanOrEqual(5);
    expect(weekly.days.at(-1)!.bookings).toBeGreaterThanOrEqual(1);

    // Someone signed in who isn't a member sees no business at all.
    signedIn = OTHER;
    const other = await getBusinessContext.call(null);
    expect(other.business).toBeNull();
    const { sendReply } = await import("@/app/(dashboard)/dashboard/inbox/actions");
    expect(await sendReply(ravi!.id, "hi")).toEqual({ ok: false, error: "Please log in again." });
  });

  // --- Bookings and payments ----------------------------------------------------

  it("confirms on the test payment page once, and tells the customer in chat", async () => {
    const { conversationId, slots } = await askForSlots();
    const held = await tap(conversationId, slots.at(-1)!, { name: "Kiran", phone: "9000000004" });
    const id = (held.events.find((e) => e.type === "payment_link") as unknown as { link: { bookingId: string } }).link.bookingId;

    const { confirmTestPayment } = await import("@/app/pay/[bookingId]/actions");
    expect(await confirmTestPayment(id)).toEqual({ ok: true });
    expect(await confirmTestPayment(id)).toEqual({ ok: true });
    expect(await one("select status, hold_expires_at from public.appointments where id = $1", [id])).toEqual({ status: "confirmed", hold_expires_at: null });
    expect((await one("select count(*)::int n from public.payments where appointment_id = $1 and status = 'paid'", [id])).n).toBe(1);

    const notices = (await updates(conversationId)).messages;
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ from: "system", content: expect.stringMatching(/^Payment mil gaya! Aapki booking confirm hai/) });

    // The chat now says confirmed when asked.
    script.push({ toolCall: { name: "show_booking", arguments: "{}" } }, { text: "Aapki booking confirm hai." });
    const status = await chat({ conversationId, messages: [{ role: "user", content: "Meri booking ka status?" }] });
    expect(status.events.some((e) => e.type === "payment_link")).toBe(false);
  });

  it("lets the owner mark paid, complete and cancel, but not touch another clinic", async () => {
    const { conversationId, slots } = await askForSlots();
    const held = await tap(conversationId, slots.at(-2)!, { name: "Sunil", phone: "9000000005" });
    const id = (held.events.find((e) => e.type === "payment_link") as unknown as { link: { bookingId: string } }).link.bookingId;
    const { updateBooking } = await import("@/app/(dashboard)/dashboard/bookings/actions");

    expect(await updateBooking(id, "complete")).toMatchObject({ ok: false });
    expect(await updateBooking(id, "mark_paid")).toEqual({ ok: true });
    expect((await one("select status from public.appointments where id = $1", [id])).status).toBe("confirmed");
    expect((await updates(conversationId)).messages.at(-1)).toMatchObject({ from: "system" });
    expect(await updateBooking(id, "mark_paid")).toMatchObject({ ok: false });
    expect(await updateBooking(id, "complete")).toEqual({ ok: true });
    expect(await updateBooking(id, "cancel")).toMatchObject({ ok: false });

    const other = await askForSlots();
    const held2 = await tap(other.conversationId, other.slots.at(-3)!, { name: "Tina", phone: "9000000006" });
    const id2 = (held2.events.find((e) => e.type === "payment_link") as unknown as { link: { bookingId: string } }).link.bookingId;
    signedIn = OTHER;
    expect(await updateBooking(id2, "cancel")).toMatchObject({ ok: false });
    signedIn = OWNER;
    expect(await updateBooking(id2, "cancel")).toEqual({ ok: true });
    expect(await one("select status, hold_expires_at from public.appointments where id = $1", [id2])).toEqual({ status: "cancelled", hold_expires_at: null });
  });

  it("renews a lapsed hold when the customer asks for the link again", async () => {
    const { conversationId, slots } = await askForSlots();
    const held = await tap(conversationId, slots[3]!, { name: "Late Payer", phone: "9000000007" });
    const id = (held.events.find((e) => e.type === "payment_link") as unknown as { link: { bookingId: string } }).link.bookingId;
    await db.query("update public.appointments set hold_expires_at = now() - interval '1 minute' where id = $1", [id]);

    script.push({ toolCall: { name: "show_booking", arguments: "{}" } }, { text: "Naya payment card bhej diya." });
    const again = await chat({ conversationId, messages: [{ role: "user", content: "payment link do" }] });
    const link = again.events.find((e) => e.type === "payment_link") as unknown as { link: { bookingId: string } };
    expect(link.link.bookingId).not.toBe(id);
    const renewed = await one("select status, customer_id is not null as has_customer from public.appointments where id = $1", [link.link.bookingId]);
    expect(renewed).toEqual({ status: "pending_payment", has_customer: true });
  });

  it("confirms straight away when the clinic takes payment at the visit", async () => {
    const { savePaymentMode } = await import("@/app/(dashboard)/dashboard/settings/actions");
    expect(await savePaymentMode("at_clinic")).toEqual({ ok: true });
    const settings = (await one("select settings from public.businesses where id = $1", [BIZ])).settings;
    expect(settings).toMatchObject({ payment_mode: "at_clinic" });

    const { conversationId, slots } = await askForSlots();
    const r = await tap(conversationId, slots.at(-4)!, { name: "Walk Later", phone: "9000000008" });
    expect(r.text).toMatch(/^Booking confirm!/);
    expect(r.events.some((e) => e.type === "payment_link")).toBe(false);

    expect(await savePaymentMode("online")).toEqual({ ok: true });
    signedIn = OTHER;
    expect(await savePaymentMode("at_clinic")).toMatchObject({ ok: false });
  });

  // --- Cancel and reschedule from the chat ------------------------------------------

  const bookingIdOf = (r: { events: Event[] }) => r.events.find((e) => e.type === "booked")?.bookingId as string;

  it("cancels only after the customer confirms, frees the slot and tells the team", async () => {
    const { conversationId, slots } = await askForSlots();
    const held = await tap(conversationId, slots[1]!, { name: "Cancel Karna", phone: "9000000011" });
    const id = bookingIdOf(held);
    expect(id).toBeTruthy();

    script.push({ toolCall: { name: "cancel_booking", arguments: JSON.stringify({ customer_confirmed: false }) } }, { text: "Ye booking cancel karun?" });
    await chat({ conversationId, messages: [{ role: "user", content: "booking cancel karni hai" }] });
    expect((await one("select status from public.appointments where id = $1", [id])).status).toBe("pending_payment");

    script.push({ toolCall: { name: "cancel_booking", arguments: JSON.stringify({ customer_confirmed: true }) } }, { text: "Cancel ho gayi." });
    await chat({ conversationId, messages: [{ role: "user", content: "haan cancel karo" }] });
    expect(await one("select status, hold_expires_at from public.appointments where id = $1", [id])).toEqual({ status: "cancelled", hold_expires_at: null });
    const note = await one("select content from public.messages where conversation_id = $1 and metadata->>'staffNote' = 'true'", [conversationId]);
    expect(note.content).toMatch(/^Customer cancelled General consultation/);
    // Unpaid, so nothing for the team to do: the chat stays with the AI.
    expect((await one("select status from public.conversations where id = $1", [conversationId])).status).not.toBe("needs_human");
    // And a paid hold for the same time can't be confirmed any more.
    const { confirmPaidAppointment } = await import("@/lib/payments/confirm");
    expect(await confirmPaidAppointment(id, { raw: {}, method: "test" })).toEqual({ ok: false, reason: "not_payable" });
  });

  it("sends a paid cancellation to the inbox for a refund", async () => {
    const { conversationId, slots } = await askForSlots();
    const id = bookingIdOf(await tap(conversationId, slots[2]!, { name: "Paid Cancel", phone: "9000000012" }));
    const { confirmTestPayment } = await import("@/app/pay/[bookingId]/actions");
    expect(await confirmTestPayment(id)).toEqual({ ok: true });

    script.push({ toolCall: { name: "cancel_booking", arguments: JSON.stringify({ customer_confirmed: true }) } }, { text: "Cancel ho gayi, team refund ke liye contact karegi." });
    await chat({ conversationId, messages: [{ role: "user", content: "haan cancel kar do" }] });
    expect((await one("select status from public.appointments where id = $1", [id])).status).toBe("cancelled");
    expect((await one("select status from public.conversations where id = $1", [conversationId])).status).toBe("needs_human");
    const notes = (await db.query("select content from public.messages where metadata->>'staffNote' = 'true' and metadata->>'appointmentId' = $1", [id])).rows;
    expect(notes.map((n) => n.content).join(" ")).toMatch(/refund/);
  });

  it("moves a booking from a later chat on the same device, keeping it paid", async () => {
    const first = await askForSlots();
    const id = bookingIdOf(await tap(first.conversationId, first.slots[0]!, { name: "Move Karna", phone: "9000000013" }));
    const { confirmTestPayment } = await import("@/app/pay/[bookingId]/actions");
    expect(await confirmTestPayment(id)).toEqual({ ok: true });
    const before = await one("select starts_at from public.appointments where id = $1", [id]);

    // A new chat: the browser sends the ids it remembers.
    script.push({ toolCall: { name: "reschedule_booking", arguments: JSON.stringify({ date: "day_after_tomorrow" }) } }, { text: "Naya time tap kijiye." });
    const offer = await chat({ bookingIds: [id], messages: [{ role: "user", content: "Parso ka time kar do meri booking ka" }] });
    const slots = offer.events.find((e) => e.type === "slots")?.items as Array<{ id: string; label: string; rescheduleOf: string }>;
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((s) => s.rescheduleOf === id)).toBe(true);

    const moved = await chat({
      conversationId: offer.conversationId,
      bookingIds: [id],
      messages: [{ role: "user", content: slots[0]!.label }],
      action: { type: "book_slot", slotId: slots[0]!.id, rescheduleOf: id },
    });
    expect(moved.text).toMatch(/^Ho gaya! Aapki booking ab/);
    expect(bookingIdOf(moved)).toBe(id);
    const after = await one("select starts_at, status from public.appointments where id = $1", [id]);
    expect(after.status).toBe("confirmed");
    expect(after.starts_at).not.toBe(before.starts_at);
    expect((await one("select count(*)::int n from public.payments where appointment_id = $1 and status = 'paid'", [id])).n).toBe(1);
    const note = await one("select content from public.messages where conversation_id = $1 and metadata->>'staffNote' = 'true'", [offer.conversationId]);
    expect(note.content).toMatch(/^Customer moved General consultation from/);

    // The old time is free again.
    const again = await askForSlots();
    expect(again.slots.length).toBeGreaterThan(0);
  });

  it("refuses moves it shouldn't make", async () => {
    const { conversationId, slots } = await askForSlots();
    const id = bookingIdOf(await tap(conversationId, slots[3]!, { name: "No Move", phone: "9000000014" }));
    const move = (bookingId: string, slotId: string) =>
      chat({ conversationId, messages: [{ role: "user", content: "x" }], action: { type: "book_slot", slotId, rescheduleOf: bookingId } });

    // A made-up booking id, and a slot for a different service.
    expect((await move("00000000-0000-4000-a009-000000000009", slots[4]!.id)).text).toMatch(/badli nahi ja sakti/);
    script.push({ toolCall: { name: "check_availability", arguments: JSON.stringify({ service_id: "00000000-0000-4000-a002-000000000002", date: "tomorrow" }) } }, { text: "Ye slots hain." });
    const other = await chat({ conversationId, messages: [{ role: "user", content: "chest wale doctor ke slots" }] });
    const otherSlot = (other.events.find((e) => e.type === "slots")?.items as Array<{ id: string }>)[0]!;
    expect((await move(id, otherSlot.id)).text).toMatch(/available nahi hai/);

    // A booking that was cancelled can't be moved back to life.
    await db.query("update public.appointments set status = 'cancelled', hold_expires_at = null where id = $1", [id]);
    expect((await move(id, slots[4]!.id)).text).toMatch(/badli nahi ja sakti/);
  });

  it("finds no booking for a customer on a new device and says so to the model", async () => {
    const live = "select count(*)::int n from public.appointments where status in ('confirmed', 'pending_payment')";
    const before = (await one(live)).n;
    script.push({ toolCall: { name: "cancel_booking", arguments: JSON.stringify({ customer_confirmed: true }) } }, { text: "Team ko bata diya." });
    const r = await chat({ messages: [{ role: "user", content: "kal wali booking cancel karo" }] });
    expect(r.status).toBe(200);
    expect((await one(live)).n).toBe(before);
    const toolResult = await one("select metadata from public.messages where conversation_id = $1 and role = 'ai'", [r.conversationId]);
    expect(JSON.stringify(toolResult.metadata)).toContain("cancel_booking");
  });

  // --- Owner alerts --------------------------------------------------------------------

  describe("email alerts", () => {
    let sent: Array<{ to: string[]; subject: string; text: string; html: string }>;
    const flush = () => Promise.all(background.splice(0));

    beforeEach(() => {
      sent = [];
      vi.stubEnv("RESEND_API_KEY", "re_test");
      const realFetch = globalThis.fetch;
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
        if (String(input).startsWith("https://api.resend.com/")) {
          sent.push(JSON.parse(String(init?.body)));
          return new Response(JSON.stringify({ id: "email_1" }), { status: 200 });
        }
        return realFetch(input, init);
      });
    });
    afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllEnvs();
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
    });

    it("emails the owner once when the AI hands a chat over, and when the customer answers staff", async () => {
      script.push({ toolCall: { name: "handoff_to_human", arguments: JSON.stringify({ reason: "customer_requested", summary: "Wants to talk about a report" }) } }, { text: "Team aapse baat karegi." });
      const r = await chat({ messages: [{ role: "user", content: "Doctor se baat karni hai report ke baare mein" }] });
      await flush();
      expect(sent).toHaveLength(1);
      expect(sent[0]).toMatchObject({ to: [OWNER.email], subject: "Customer waiting for a reply: Sunrise Family Clinic" });
      expect(sent[0]!.text).toContain("What they need: Wants to talk about a report");
      expect(sent[0]!.text).toContain("/dashboard/inbox");

      // The AI is still on; a second handoff in the same chat doesn't email again.
      script.push({ toolCall: { name: "handoff_to_human", arguments: JSON.stringify({ reason: "other", summary: "again" }) } }, { text: "Team ko pata hai." });
      await chat({ conversationId: r.conversationId, messages: [{ role: "user", content: "jaldi" }] });
      await flush();
      expect(sent).toHaveLength(1);

      // Staff take over and reply; the customer's answer emails the owner.
      const { sendReply } = await import("@/app/(dashboard)/dashboard/inbox/actions");
      expect(await sendReply(r.conversationId!, "Ji, kal 11 baje call karenge.")).toMatchObject({ ok: true });
      await chat({ conversationId: r.conversationId, messages: [{ role: "user", content: "Theek hai, <b>thanks</b>" }] });
      await flush();
      expect(sent).toHaveLength(2);
      expect(sent[1]!.subject).toMatch(/^New message in a chat you're handling/);
      // Customer text is escaped in the HTML.
      expect(sent[1]!.html).toContain("&#60;b&#62;thanks&#60;/b&#62;");
      expect(sent[1]!.html).not.toContain("<b>thanks");
    });

    it("emails confirmed bookings, cancellations and payment problems, and honours the switch", async () => {
      const { conversationId, slots } = await askForSlots();
      const id = (await tap(conversationId, slots[5]!, { name: "Alert Patient", phone: "9000000021" })).events.find((e) => e.type === "booked")!.bookingId as string;
      await flush();
      expect(sent).toHaveLength(0); // a hold isn't a booking yet

      const { confirmTestPayment } = await import("@/app/pay/[bookingId]/actions");
      await confirmTestPayment(id);
      await flush();
      expect(sent).toHaveLength(1);
      expect(sent[0]!.subject).toMatch(/^New booking: /);
      expect(sent[0]!.text).toContain("Advance paid: ₹500");
      expect(sent[0]!.text).toContain("Customer: Alert Patient, +919000000021");

      // Paid cancellation: one "action needed" email about the refund.
      script.push({ toolCall: { name: "cancel_booking", arguments: JSON.stringify({ customer_confirmed: true }) } }, { text: "Cancel ho gayi." });
      await chat({ conversationId, messages: [{ role: "user", content: "haan cancel" }] });
      await flush();
      expect(sent).toHaveLength(2);
      expect(sent[1]!.subject).toMatch(/^Action needed: /);
      expect(sent[1]!.text).toMatch(/refund/);

      // Booking emails off, and a custom address: handoffs still go, bookings don't.
      const { saveAlertSettings } = await import("@/app/(dashboard)/dashboard/settings/actions");
      expect(await saveAlertSettings({ email: "not-an-email", bookings: false })).toMatchObject({ ok: false });
      expect(await saveAlertSettings({ email: "Front.Desk@Sunrise.test ", bookings: false })).toEqual({ ok: true });
      const { savePaymentMode } = await import("@/app/(dashboard)/dashboard/settings/actions");
      await savePaymentMode("at_clinic");
      const more = await askForSlots();
      await tap(more.conversationId, more.slots[0]!, { name: "Quiet", phone: "9000000022" });
      script.push({ toolCall: { name: "handoff_to_human", arguments: JSON.stringify({ reason: "complaint", summary: "Unhappy" }) } }, { text: "Sorry." });
      await chat({ conversationId: more.conversationId, messages: [{ role: "user", content: "bahut bura experience" }] });
      await flush();
      expect(sent).toHaveLength(3);
      expect(sent[2]).toMatchObject({ to: ["front.desk@sunrise.test"], subject: expect.stringMatching(/^Customer waiting/) });

      await savePaymentMode("online");
      await saveAlertSettings({ email: "", bookings: true });
    });

    it("never breaks the chat when email fails", async () => {
      vi.mocked(globalThis.fetch).mockImplementation(async () => new Response("nope", { status: 500 }));
      script.push({ toolCall: { name: "handoff_to_human", arguments: JSON.stringify({ reason: "customer_requested", summary: "x" }) } }, { text: "Team ko bata diya." });
      const r = await chat({ messages: [{ role: "user", content: "insaan se baat" }] });
      await flush();
      expect(r.text).toBe("Team ko bata diya.");
    });
  });

  // --- Razorpay -------------------------------------------------------------------

  it("applies the owner's settings to the next chat, and refuses anyone else", async () => {
    const { saveBusinessSetup } = await import("@/app/(dashboard)/dashboard/settings/actions");
    const { getBusinessContext, getBusinessSetup } = await import("@/lib/data/business");
    const { settingsFromSetup } = await import("@/lib/onboarding");
    // The seed's phone is a placeholder ("98XXX"); a real clinic's landline.
    await db.query("update public.businesses set phone = '020 2729 1234' where id = $1", [BIZ]);
    const ctx = await getBusinessContext();
    const before = settingsFromSetup(ctx.business!, await getBusinessSetup(ctx));
    expect(before.services.find((s) => s.id === GP)).toMatchObject({ priceRupees: 500 });

    const edited = structuredClone(before);
    edited.business.area = "Kondhwa";
    edited.services = edited.services.map((s) => (s.id === GP ? { ...s, priceRupees: 650 } : s));
    edited.services.push({ name: "Dressing", durationMin: 15, priceRupees: 200, staffKeys: [edited.staff[0]!.key] });
    expect(await saveBusinessSetup(edited)).toEqual({ ok: true });

    // The AI's next message sees the new price and service.
    const { loadBusinessKnowledge } = await import("@/lib/agent/knowledge");
    const k = await loadBusinessKnowledge("sunrise-clinic");
    expect(k!.area).toBe("Kondhwa");
    expect(k!.services.find((s) => s.id === GP)!.pricePaise).toBe(65000);
    expect(k!.services.map((s) => s.name)).toContain("Dressing");
    const { conversationId, slots } = await askForSlots();
    const held = await tap(conversationId, slots[0]!, { name: "Price Check", phone: "9811111111" });
    expect((held.events.find((e) => e.type === "payment_link") as unknown as { link: { amountInPaise: number } }).link.amountInPaise).toBe(65000);

    // Bad input comes back per field; nothing is saved.
    const bad = await saveBusinessSetup({ ...edited, services: edited.services.map((s) => ({ ...s, staffKeys: ["gone"] })) });
    expect(bad).toMatchObject({ ok: false, fieldErrors: { "services.0.staffKeys": "Pick who provides this" } });

    signedIn = OTHER;
    expect(await saveBusinessSetup(before)).toMatchObject({ ok: false });
    signedIn = OWNER;

    // Put things back for the tests after this one; "Dressing" is removed, so it's deactivated.
    const now = settingsFromSetup((await getBusinessContext()).business!, await getBusinessSetup(await getBusinessContext()));
    expect(await saveBusinessSetup({ ...before, business: before.business })).toEqual({ ok: true });
    expect(now.services.map((s) => s.name)).toContain("Dressing");
    expect((await one("select active from public.services where name = 'Dressing'")).active).toBe(false);
    expect((await one("select area from public.businesses where id = $1", [BIZ])).area).toBe(before.business.area || null);
  });

  describe("with Razorpay", () => {
    const sent: Array<Record<string, unknown>> = [];
    let n = 0;

    beforeAll(() => {
      vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_abc");
      vi.stubEnv("RAZORPAY_KEY_SECRET", "secret");
      vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "whsec");
      vi.resetModules();
      vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
        if (!String(url).startsWith("https://api.razorpay.com/")) throw new Error(`unexpected fetch ${url}`);
        sent.push(JSON.parse(String(init.body)));
        n++;
        return new Response(JSON.stringify({ id: `plink_${n}`, short_url: `https://rzp.io/l/t${n}` }), { status: 200 });
      });
    });
    afterAll(() => {
      vi.unstubAllGlobals();
      vi.resetModules();
    });

    async function webhook(body: object, secret = "whsec") {
      const { POST } = await import("@/app/api/razorpay/webhook/route");
      const raw = JSON.stringify(body);
      return POST(new Request("http://app.test/api/razorpay/webhook", { method: "POST", body: raw, headers: { "x-razorpay-signature": createHmac("sha256", secret).update(raw).digest("hex") } }));
    }
    const paid = (linkId: string, ref: string) => ({ event: "payment_link.paid", payload: { payment_link: { entity: { id: linkId, reference_id: ref, status: "paid" } }, payment: { entity: { id: "pay_1" } } } });

    it("creates a Razorpay link per hold and confirms on the signed webhook, once", async () => {
      const { conversationId, slots } = await askForSlots();
      const held = await tap(conversationId, slots.at(-5)!, { name: "Online Payer", phone: "9000000009" });
      const pay = held.events.find((e) => e.type === "payment_link") as unknown as { link: { bookingId: string; url: string; expiresInMinutes: number } };
      expect(pay.link.url).toMatch(/^https:\/\/rzp\.io\/l\/t\d+$/);
      expect(pay.link.expiresInMinutes).toBeGreaterThanOrEqual(19);
      expect(sent.at(-1)).toMatchObject({ amount: 50000, reference_id: pay.link.bookingId, customer: { name: "Online Payer", contact: "+919000000009" }, callback_url: `https://app.test/pay/${pay.link.bookingId}` });
      const linkId = (await one("select provider_link_id from public.payments where appointment_id = $1", [pay.link.bookingId])).provider_link_id;

      expect((await webhook(paid(linkId, pay.link.bookingId), "wrong")).status).toBe(401);
      expect((await one("select status from public.appointments where id = $1", [pay.link.bookingId])).status).toBe("pending_payment");

      expect((await webhook(paid(linkId, pay.link.bookingId))).status).toBe(200);
      expect((await webhook(paid(linkId, pay.link.bookingId))).status).toBe(200); // Razorpay retry
      expect((await one("select status from public.appointments where id = $1", [pay.link.bookingId])).status).toBe("confirmed");
      expect((await db.query("select status from public.payments where appointment_id = $1", [pay.link.bookingId])).rows).toEqual([{ status: "paid" }]);
      expect((await updates(conversationId)).messages.filter((m) => m.from === "system")).toHaveLength(1);

      // The test payment page can't confirm anything while Razorpay is on.
      const { confirmTestPayment } = await import("@/app/pay/[bookingId]/actions");
      expect((await confirmTestPayment(pay.link.bookingId)).ok).toBe(false);
    });

    it("records a late payment for a slot that was taken and sends the chat to the inbox", async () => {
      const a = await askForSlots();
      const slot = a.slots.at(-6) ?? a.slots[0]!;
      const held = await tap(a.conversationId, slot, { name: "Too Late", phone: "9000000010" });
      const id = (held.events.find((e) => e.type === "payment_link") as unknown as { link: { bookingId: string } }).link.bookingId;
      const linkId = (await one("select provider_link_id from public.payments where appointment_id = $1", [id])).provider_link_id;
      // The hold runs out and someone else books the same slot.
      await db.query("update public.appointments set hold_expires_at = now() - interval '1 minute' where id = $1", [id]);
      const b = await askForSlots();
      const taken = await tap(b.conversationId, slot, { name: "Quick", phone: "9000000011" });
      expect(taken.events.some((e) => e.type === "payment_link")).toBe(true);

      expect((await webhook(paid(linkId, id))).status).toBe(200);
      expect((await one("select status from public.payments where provider_link_id = $1", [linkId])).status).toBe("paid");
      expect((await one("select status from public.conversations where id = $1", [a.conversationId])).status).toBe("needs_human");
      const { getConversations } = await import("@/lib/data/dashboard");
      const { getBusinessContext } = await import("@/lib/data/business");
      const conv = (await getConversations(await getBusinessContext())).items.find((c) => c.id === a.conversationId)!;
      expect(conv.messages.at(-1)).toMatchObject({ from: "note", text: expect.stringMatching(/refund/) });
    });

    it("ignores unsigned and unrelated events", async () => {
      const { POST } = await import("@/app/api/razorpay/webhook/route");
      expect((await POST(new Request("http://app.test/x", { method: "POST", body: "{}" }))).status).toBe(401);
      expect((await webhook({ event: "payment.captured", payload: {} })).status).toBe(200);
    });
  });
});
