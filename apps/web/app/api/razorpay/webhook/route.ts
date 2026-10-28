import type { Json } from "@frontdesk/db";
import { confirmPaidAppointment } from "@/lib/payments/confirm";
import { verifyWebhookSignature } from "@/lib/payments/razorpay";
import { createServiceClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/monitoring";

export const runtime = "nodejs";

interface LinkEvent {
  event: string;
  payload?: {
    payment_link?: { entity?: { id?: string; reference_id?: string; status?: string; amount_paid?: number } };
    payment?: { entity?: { id?: string; method?: string } };
  };
}

/**
 * Razorpay → us. Add in Razorpay Dashboard → Webhooks with the URL
 * https://<your-domain>/api/razorpay/webhook, a secret (same value as
 * RAZORPAY_WEBHOOK_SECRET), and the events payment_link.paid,
 * payment_link.expired and payment_link.cancelled.
 *
 * The signature is checked on the raw body before anything is parsed.
 * Razorpay retries until it gets a 2xx, so every branch is idempotent and
 * only a real failure (DB down) returns 500 to get a retry.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyWebhookSignature(raw, request.headers.get("x-razorpay-signature"))) {
    console.warn("[razorpay] webhook with a bad or missing signature");
    return Response.json({ error: "invalid_signature" }, { status: 401 });
  }

  let body: LinkEvent;
  try {
    body = JSON.parse(raw) as LinkEvent;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const link = body.payload?.payment_link?.entity;
  if (!link?.id) return Response.json({ ok: true, ignored: body.event });

  try {
    if (body.event === "payment_link.paid") {
      // The payments row created with the link says which booking it is; reference_id is a fallback.
      const { data } = await createServiceClient().from("payments").select("appointment_id").eq("provider_link_id", link.id).maybeSingle();
      const appointmentId = data?.appointment_id ?? link.reference_id;
      if (!appointmentId) return Response.json({ ok: true, ignored: "unknown_link" });
      const result = await confirmPaidAppointment(appointmentId, {
        providerLinkId: link.id,
        method: "razorpay",
        raw: { event: body.event, payment_link: link, payment: body.payload?.payment?.entity ?? null } as unknown as Json,
      });
      return Response.json({ ok: true, result });
    }
    if (body.event === "payment_link.expired" || body.event === "payment_link.cancelled") {
      await createServiceClient().from("payments").update({ status: body.event.endsWith("expired") ? "expired" : "cancelled" }).eq("provider_link_id", link.id).eq("status", "created");
      return Response.json({ ok: true });
    }
    return Response.json({ ok: true, ignored: body.event });
  } catch (err) {
    reportError("[razorpay] webhook failed", err);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
