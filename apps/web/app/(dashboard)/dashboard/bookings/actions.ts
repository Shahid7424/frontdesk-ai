"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getBusinessContext } from "@/lib/data/business";
import { notifyChat } from "@/lib/payments/confirm";
import { createClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/monitoring";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type BookingAction = "mark_paid" | "complete" | "no_show" | "cancel";

const input = z.object({ id: z.string().uuid(), action: z.enum(["mark_paid", "complete", "no_show", "cancel"]) });

/**
 * The owner's changes to a booking. Until online payments are live, "mark
 * paid" is how a UPI or cash advance confirms the slot. Runs through the
 * owner's own client, so RLS limits it to their business, and the
 * exclusion constraint still refuses a slot someone else has taken.
 */
export async function updateBooking(id: string, action: BookingAction): Promise<ActionResult> {
  if (!input.safeParse({ id, action }).success) return { ok: false, error: "Invalid request." };
  const ctx = await getBusinessContext();
  if (ctx.mode === "demo") return { ok: false, error: "Demo mode: sign in to manage real bookings." };
  if (!ctx.user || !ctx.business) return { ok: false, error: "Please log in again." };
  const supabase = await createClient();
  const businessId = ctx.business.id;

  const { data: a } = await supabase
    .from("appointments")
    .select("id, status, amount_paise, hold_expires_at, starts_at")
    .eq("id", id)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!a) return { ok: false, error: "Booking not found." };

  if (action === "mark_paid") {
    // A live hold, or one the system released when it ran out. Never one the clinic cancelled.
    const releasedHold = a.status === "cancelled" && a.hold_expires_at !== null;
    if (a.status !== "pending_payment" && !releasedHold) return { ok: false, error: "Only bookings awaiting payment can be marked paid." };
    const { error } = await supabase
      .from("appointments")
      .update({ status: "confirmed", hold_expires_at: null })
      .eq("id", id)
      .eq("business_id", businessId);
    // 23P01: the hold ran out and someone else booked the slot.
    if (error?.code === "23P01") return { ok: false, error: "Someone else has booked this slot since. Offer the customer another time." };
    if (error) return failed(error);
    if (a.amount_paise > 0) {
      await supabase.from("payments").insert({
        business_id: businessId,
        appointment_id: id,
        amount_paise: a.amount_paise,
        status: "paid",
        paid_at: new Date().toISOString(),
        raw: { method: "marked_paid_by_owner", by: ctx.user.id },
      });
    }
    // The customer sees "payment received, booking confirmed" in their chat.
    await notifyChat(businessId, id).catch((err) => reportError("[bookings] chat notice failed", err));
  } else {
    const allowed: Record<Exclude<BookingAction, "mark_paid">, string[]> = {
      complete: ["confirmed"],
      no_show: ["confirmed"],
      cancel: ["confirmed", "pending_payment"],
    };
    if (!allowed[action].includes(a.status)) return { ok: false, error: "This booking can't be changed that way." };
    const status = action === "complete" ? "completed" : action === "no_show" ? "no_show" : "cancelled";
    // hold_expires_at null marks a cancellation by the clinic, which is never renewed.
    const { error } = await supabase
      .from("appointments")
      .update({ status, ...(action === "cancel" ? { hold_expires_at: null } : {}) })
      .eq("id", id)
      .eq("business_id", businessId);
    if (error) return failed(error);
  }
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard");
  return { ok: true };
}

function failed(error: { message: string }): ActionResult {
  reportError("[bookings] update failed", error);
  return { ok: false, error: "Couldn't update the booking. Please try again." };
}
