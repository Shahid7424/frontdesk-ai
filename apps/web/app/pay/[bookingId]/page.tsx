import { formatRupees } from "@frontdesk/core";
import { slotLabel } from "@frontdesk/core/agent";
import type { Metadata } from "next";
import { LogoMark } from "@/components/ui/logo";
import { isSupabaseConfigured } from "@/lib/env";
import { demoClinic } from "@/lib/mock/demo-clinic";
import { isRazorpayConfigured } from "@/lib/payments/razorpay";
import { createServiceClient } from "@/lib/supabase/server";
import { PayCard, type PayState } from "./pay-card";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata: Metadata = { title: "Payment", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Where the payment link points. With Razorpay, customers land here after
 * paying (the webhook confirms the booking); without it, while developing,
 * this is a test payment page that confirms the booking for real in the DB.
 * The demo clinic without a database keeps the old pretend page.
 */
export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookingId: string }>;
  searchParams: Promise<{ amount?: string; service?: string; razorpay_payment_link_status?: string }>;
}) {
  const { bookingId } = await params;
  const query = await searchParams;
  const live = isSupabaseConfigured && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) && UUID.test(bookingId);
  const state = live ? await loadState(bookingId, query.razorpay_payment_link_status === "paid") : demoState(query);

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas bg-[radial-gradient(60%_45%_at_50%_0%,var(--color-brand-100),transparent)] px-4 py-10">
      <div className="w-full max-w-sm">
        {state.kind === "test" && (
          <p className="mb-3 text-center text-xs font-medium tracking-wide text-amber-700 uppercase">Test mode · no real money moves</p>
        )}
        <div className="rounded-3xl bg-white p-7 shadow-lift ring-1 ring-black/5">
          <PayCard state={state} bookingId={bookingId} />
        </div>
        <p className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-500">
          <LogoMark className="size-5 rounded-md" /> Secure booking by <span className="font-semibold text-ink">Swagat AI</span>
        </p>
      </div>
    </main>
  );
}

function demoState(query: { amount?: string; service?: string }): PayState {
  return {
    kind: "demo",
    business: demoClinic.name,
    service: query.service ?? "Appointment",
    amount: formatRupees(Number(query.amount) || 0),
    when: null,
  };
}

async function loadState(bookingId: string, returnedPaid: boolean): Promise<PayState> {
  const db = createServiceClient();
  const { data: a } = await db
    .from("appointments")
    .select("status, amount_paise, starts_at, hold_expires_at, businesses(name), services(name), staff(name)")
    .eq("id", bookingId)
    .maybeSingle();
  if (!a) return { kind: "missing" };

  const base = {
    business: (a.businesses as unknown as { name: string } | null)?.name ?? "",
    service: (a.services as unknown as { name: string } | null)?.name ?? "Appointment",
    amount: formatRupees(a.amount_paise),
    when: `${slotLabel(new Date(a.starts_at))} · ${(a.staff as unknown as { name: string } | null)?.name ?? ""}`,
  };
  if (a.status === "confirmed" || a.status === "completed") return { kind: "confirmed", ...base };
  const holdActive = a.status === "pending_payment" && a.hold_expires_at !== null && new Date(a.hold_expires_at).getTime() > Date.now();
  // Back from Razorpay before the webhook arrived: show "confirming" and refresh.
  if (returnedPaid) return { kind: "confirming", ...base };
  if (!holdActive) return { kind: "expired", ...base };

  if (isRazorpayConfigured) {
    const { data: p } = await db.from("payments").select("raw").eq("appointment_id", bookingId).eq("status", "created").order("created_at", { ascending: false }).limit(1).maybeSingle();
    const url = (p?.raw as { short_url?: string } | null)?.short_url;
    return url ? { kind: "razorpay", url, ...base } : { kind: "expired", ...base };
  }
  return process.env.NODE_ENV === "production" ? { kind: "expired", ...base } : { kind: "test", ...base };
}
