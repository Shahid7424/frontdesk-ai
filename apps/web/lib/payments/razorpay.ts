import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Razorpay Payment Links over plain fetch (no SDK). Test keys work without
 * KYC, so the whole flow can be tried before a clinic goes live.
 *
 * RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET: Dashboard → Account & Settings → API keys
 * RAZORPAY_WEBHOOK_SECRET: the secret typed when adding the webhook
 */
const keyId = process.env.RAZORPAY_KEY_ID?.trim();
const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();

export const isRazorpayConfigured = Boolean(keyId && keySecret);
export const isRazorpayTestMode = Boolean(keyId?.startsWith("rzp_test_"));

/** Razorpay refuses links that expire sooner than 15 minutes from now. */
export const RAZORPAY_MIN_EXPIRY_MINUTES = 16;

export interface CreatedLink {
  id: string;
  shortUrl: string;
}

export async function createPaymentLink(input: {
  appointmentId: string;
  businessId: string;
  amountPaise: number;
  description: string;
  customer: { name: string | null; phone: string | null };
  expiresAt: Date;
  callbackUrl: string;
}): Promise<CreatedLink> {
  if (!keyId || !keySecret) throw new Error("Razorpay is not configured");
  const res = await fetch("https://api.razorpay.com/v1/payment_links", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
    },
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: "INR",
      accept_partial: false,
      expire_by: Math.floor(input.expiresAt.getTime() / 1000),
      // A retried request can't create a second link for the same hold.
      reference_id: input.appointmentId,
      description: input.description.slice(0, 2048),
      customer: {
        ...(input.customer.name ? { name: input.customer.name } : {}),
        ...(input.customer.phone ? { contact: input.customer.phone } : {}),
      },
      // The chat already shows the link; no duplicate SMS or email from Razorpay.
      notify: { sms: false, email: false },
      reminder_enable: false,
      notes: { appointment_id: input.appointmentId, business_id: input.businessId },
      callback_url: input.callbackUrl,
      callback_method: "get",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json().catch(() => null)) as { id?: string; short_url?: string; error?: { description?: string } } | null;
  if (!res.ok || !body?.id || !body.short_url) {
    throw new Error(`Razorpay payment link failed (${res.status}): ${body?.error?.description ?? "no details"}`);
  }
  return { id: body.id, shortUrl: body.short_url };
}

/**
 * Checks X-Razorpay-Signature: HMAC-SHA256 of the raw body with the webhook
 * secret. Without a secret configured every webhook is refused.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!webhookSecret || !signature) return false;
  const expected = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
