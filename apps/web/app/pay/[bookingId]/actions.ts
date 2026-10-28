"use server";

import { revalidatePath } from "next/cache";
import { confirmPaidAppointment } from "@/lib/payments/confirm";
import { isRazorpayConfigured } from "@/lib/payments/razorpay";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The test payment page's "Pay" button: confirms the booking the way the
 * Razorpay webhook would. Refused in production and whenever Razorpay is
 * configured, so it can never confirm a booking without real money.
 */
export async function confirmTestPayment(bookingId: string): Promise<{ ok: boolean; error?: string }> {
  if (process.env.NODE_ENV === "production" || isRazorpayConfigured) return { ok: false, error: "Test payments are off." };
  if (!UUID.test(bookingId)) return { ok: false, error: "Unknown booking." };
  const r = await confirmPaidAppointment(bookingId, { method: "test", raw: { method: "test_payment_page" } });
  revalidatePath(`/pay/${bookingId}`);
  if (r.ok) return { ok: true };
  return { ok: false, error: r.reason === "slot_taken" ? "This slot was taken after the hold ran out. Go back to the chat to pick another time." : "This booking can't be paid any more." };
}
