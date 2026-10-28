"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { saveAlertSettings } from "@/app/(dashboard)/dashboard/settings/actions";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";

/**
 * Email alerts to the owner. Handoffs and payment problems always alert;
 * bookings, cancellations and moves can be switched off by busy clinics.
 */
export function AlertsCard({ initial, loginEmail, delivery }: { initial: { email: string; bookings: boolean }; loginEmail: string | null; delivery: boolean }) {
  const [email, setEmail] = useState(initial.email);
  const [bookings, setBookings] = useState(initial.bookings);
  const [saved, setSaved] = useState(initial);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = email.trim() !== saved.email || bookings !== saved.bookings;

  const save = () => {
    setMessage(null);
    startTransition(async () => {
      const r = await saveAlertSettings({ email, bookings });
      if (r.ok) {
        setSaved({ email: email.trim().toLowerCase(), bookings });
        setMessage({ ok: true, text: "Saved." });
      } else setMessage({ ok: false, text: r.error });
    });
  };

  return (
    <Card>
      <CardHeader title="Email alerts" description="So a patient waiting for a reply is never missed." />
      <div className="space-y-4 p-5">
        <label className="block">
          <span className="text-sm font-medium">Send alerts to</span>
          <input
            type="email"
            className="mt-1.5 h-10 w-full max-w-md rounded-xl border border-black/10 bg-white px-3.5 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
            value={email}
            placeholder={loginEmail ?? "you@clinic.in"}
            onChange={(e) => setEmail(e.target.value)}
          />
          <span className="mt-1 block text-xs text-slate-500">Leave empty to use your login email{loginEmail ? ` (${loginEmail})` : ""}.</span>
        </label>
        <ul className="space-y-1 text-sm text-slate-600">
          <li>Always: a customer asks for a person, replies to your team, or a payment needs a refund.</li>
        </ul>
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3">
          <span className="text-sm">Also email me for new bookings, cancellations and time changes</span>
          <input type="checkbox" checked={bookings} onChange={(e) => setBookings(e.target.checked)} className="peer sr-only" />
          <span className="relative h-6 w-11 shrink-0 rounded-full bg-slate-200 transition peer-checked:bg-brand-600 peer-focus-visible:ring-4 peer-focus-visible:ring-brand-100 after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
        </label>
        {!delivery && (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-900 ring-1 ring-amber-200">
            Email sending isn&apos;t connected yet (RESEND_API_KEY). Alerts are written to the server log until it is.
          </p>
        )}
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={save} disabled={!dirty || pending}>
            {pending && <Loader2 className="size-4 animate-spin" />} Save alerts
          </Button>
          {message && <span className={message.ok ? "text-sm font-medium text-emerald-700" : "text-sm font-medium text-red-600"}>{message.text}</span>}
        </div>
      </div>
    </Card>
  );
}
