import type { Json } from "@frontdesk/db";
import type { PaymentMode } from "@/lib/agent/booking";

/** businesses.settings.payment_mode; online advances unless the owner turned them off. */
export function paymentMode(settings: Json | null | undefined): PaymentMode {
  const mode = settings && typeof settings === "object" && !Array.isArray(settings) ? settings.payment_mode : null;
  return mode === "at_clinic" ? "at_clinic" : "online";
}
