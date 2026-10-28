import "server-only";
import type { Json } from "@frontdesk/db";
import { replyLanguage, slotLabel, type ReplyLanguage } from "@frontdesk/core/agent";
import { queueAlert } from "@/lib/alerts";
import { createServiceClient } from "@/lib/supabase/server";

export type ConfirmResult =
  | { ok: true; alreadyConfirmed: boolean }
  | { ok: false; reason: "not_found" | "slot_taken" | "not_payable" };

const NOTICE: Record<ReplyLanguage, (when: string, who: string) => string> = {
  hinglish: (when, who) => `Payment mil gaya! Aapki booking confirm hai: ${when}, ${who}. Milte hain!`,
  en: (when, who) => `Payment received! Your booking is confirmed: ${when} with ${who}. See you then!`,
  hi: (when, who) => `पेमेंट मिल गया! आपकी बुकिंग कन्फ़र्म है: ${when}, ${who}। मिलते हैं!`,
};

/**
 * Confirms a booking once its advance is paid: from the Razorpay webhook,
 * the test payment page, or the owner's "Mark paid". Safe to call twice
 * (webhooks are retried): a confirmed booking stays as it is.
 *
 * If the hold ran out and someone else took the slot before the money
 * arrived, the payment is still recorded and the chat goes to the inbox,
 * because the clinic now owes a new slot or a refund.
 */
export async function confirmPaidAppointment(
  appointmentId: string,
  payment: { providerLinkId?: string; raw: Json; method: string },
): Promise<ConfirmResult> {
  const db = createServiceClient();
  const { data: a } = await db
    .from("appointments")
    .select("id, business_id, status, hold_expires_at, amount_paise")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!a) return { ok: false, reason: "not_found" };

  await recordPayment(a.business_id, a.id, a.amount_paise, payment);
  if (a.status === "confirmed" || a.status === "completed") return { ok: true, alreadyConfirmed: true };

  // A live hold, or one the system released when it ran out. Never one the clinic cancelled.
  const releasedHold = a.status === "cancelled" && a.hold_expires_at !== null;
  if (a.status !== "pending_payment" && !releasedHold) {
    await flagForTeam(a.business_id, a.id, "Payment received for a booking that was cancelled. Please refund or rebook.");
    return { ok: false, reason: "not_payable" };
  }

  const { error } = await db
    .from("appointments")
    .update({ status: "confirmed", hold_expires_at: null })
    .eq("id", a.id)
    .eq("business_id", a.business_id);
  if (error?.code === "23P01") {
    await flagForTeam(a.business_id, a.id, "Payment received after the hold ran out, and the slot was taken. Please offer another slot or refund.");
    return { ok: false, reason: "slot_taken" };
  }
  if (error) throw new Error(`Could not confirm booking: ${error.message}`);

  await notifyChat(a.business_id, a.id);
  queueAlert(a.business_id, { kind: "booking", appointmentId: a.id, paid: true });
  return { ok: true, alreadyConfirmed: false };
}

async function recordPayment(businessId: string, appointmentId: string, amountPaise: number, payment: { providerLinkId?: string; raw: Json; method: string }) {
  const db = createServiceClient();
  const paid = { status: "paid" as const, paid_at: new Date().toISOString(), raw: payment.raw };
  if (payment.providerLinkId) {
    // Only a link still open moves to paid, so a retried webhook changes nothing.
    await db.from("payments").update(paid).eq("provider_link_id", payment.providerLinkId).neq("status", "paid");
    return;
  }
  if (amountPaise <= 0) return;
  const { data: existing } = await db.from("payments").select("id").eq("appointment_id", appointmentId).eq("status", "paid").maybeSingle();
  if (!existing) {
    await db.from("payments").insert({ business_id: businessId, appointment_id: appointmentId, amount_paise: amountPaise, ...paid });
  }
}

/** The chat this booking was made in, if any. */
async function conversationOf(businessId: string, appointmentId: string): Promise<string | null> {
  const { data } = await createServiceClient()
    .from("messages")
    .select("conversation_id")
    .eq("business_id", businessId)
    .eq("metadata->>appointmentId", appointmentId)
    .limit(1)
    .maybeSingle();
  return data?.conversation_id ?? null;
}

/** Tells the customer in their chat; the widget shows notices like staff replies. */
export async function notifyChat(businessId: string, appointmentId: string) {
  const db = createServiceClient();
  const conversationId = await conversationOf(businessId, appointmentId);
  if (!conversationId) return;
  const [{ data: a }, { data: history }] = await Promise.all([
    db.from("appointments").select("starts_at, staff(name)").eq("id", appointmentId).maybeSingle(),
    db
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .eq("role", "customer")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  if (!a) return;
  const lang = replyLanguage((history ?? []).reverse().map((m) => ({ role: "user" as const, content: m.content })));
  const who = (a.staff as unknown as { name: string } | null)?.name ?? "";
  await db.from("messages").insert({
    business_id: businessId,
    conversation_id: conversationId,
    role: "ai",
    content: NOTICE[lang](slotLabel(new Date(a.starts_at)), who),
    metadata: { notice: true, appointmentId },
  });
  await db.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId).eq("business_id", businessId);
}

/** Puts the booking's chat in the inbox with a note only staff see. */
export async function flagForTeam(businessId: string, appointmentId: string, note: string) {
  const db = createServiceClient();
  console.warn(`[payments] ${note} (appointment ${appointmentId})`);
  queueAlert(businessId, { kind: "attention", appointmentId, note });
  const conversationId = await conversationOf(businessId, appointmentId);
  if (!conversationId) return;
  await db.from("messages").insert({ business_id: businessId, conversation_id: conversationId, role: "tool", content: note, metadata: { staffNote: true, appointmentId } });
  await db.from("conversations").update({ status: "needs_human", last_message_at: new Date().toISOString() }).eq("id", conversationId).eq("business_id", businessId);
}
