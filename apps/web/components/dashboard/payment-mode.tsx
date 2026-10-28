"use client";

import { useState, useTransition } from "react";
import { savePaymentMode } from "@/app/(dashboard)/dashboard/settings/actions";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Mode = "online" | "at_clinic";

const OPTIONS: Array<{ value: Mode; title: string; body: string }> = [
  {
    value: "online",
    title: "Advance online",
    body: "Paid services are held for a few minutes and confirmed when the customer pays the advance by UPI or card. Free services confirm at once.",
  },
  {
    value: "at_clinic",
    title: "Pay at the clinic",
    body: "Every booking is confirmed straight away. The customer pays at the visit.",
  },
];

/**
 * How bookings are paid. "online" needs Razorpay keys in production;
 * without them bookings confirm at once whatever is chosen here.
 */
export function PaymentModeCard({ initial, razorpay }: { initial: Mode; razorpay: "live" | "test" | "off" }) {
  const [mode, setMode] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const choose = (next: Mode) => {
    const before = mode;
    setMode(next);
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const r = await savePaymentMode(next);
      if (r.ok) setSaved(true);
      else {
        setMode(before);
        setError(r.error);
      }
    });
  };

  return (
    <Card>
      <CardHeader title="Payments" description="Whether customers pay an advance when the AI books them." />
      <div className="grid gap-3 p-5 sm:grid-cols-2" role="radiogroup" aria-label="Payment mode">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            role="radio"
            aria-checked={mode === o.value}
            disabled={pending}
            onClick={() => choose(o.value)}
            className={cn(
              "rounded-2xl p-4 text-left ring-1 transition disabled:opacity-60",
              mode === o.value ? "bg-brand-50 ring-2 ring-brand-600" : "ring-black/10 hover:ring-black/20",
            )}
          >
            <p className="text-sm font-semibold">{o.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{o.body}</p>
          </button>
        ))}
      </div>
      <p className="px-5 pb-5 text-xs text-slate-500">
        {razorpay === "live" && "Razorpay is connected (live). Payments confirm bookings automatically."}
        {razorpay === "test" && "Razorpay is connected in test mode: use Razorpay's test UPI or cards, no real money moves."}
        {razorpay === "off" &&
          "Razorpay isn't connected yet. Locally a test payment page stands in; on the live site bookings confirm at once until Razorpay keys are added. You can always mark an advance paid from Bookings."}
        {saved && <span className="ml-1 font-medium text-emerald-700">Saved.</span>}
        {error && <span className="ml-1 font-medium text-red-600">{error}</span>}
      </p>
    </Card>
  );
}
