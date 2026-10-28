"use client";

import { CheckCircle2, Clock, Loader2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { confirmTestPayment } from "./actions";

type Details = { business: string; service: string; amount: string; when: string | null };

export type PayState =
  | ({ kind: "demo" } & Details)
  | ({ kind: "test" } & Details)
  | ({ kind: "razorpay"; url: string } & Details)
  | ({ kind: "confirming" } & Details)
  | ({ kind: "confirmed" } & Details)
  | ({ kind: "expired" } & Details)
  | { kind: "missing" };

export function PayCard({ state, bookingId }: { state: PayState; bookingId: string }) {
  const router = useRouter();
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Razorpay sends the customer back before (or after) its webhook; poll until the booking flips.
  useEffect(() => {
    if (state.kind !== "confirming") return;
    const t = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(t);
  }, [state.kind, router]);

  if (state.kind === "missing") {
    return <Message title="Booking not found" body="This payment link isn't valid. Please go back to the chat." />;
  }
  if (state.kind === "confirmed" || paid) {
    return (
      <div className="animate-fade-up text-center">
        <CheckCircle2 className="mx-auto size-14 text-emerald-500" />
        <h1 className="mt-4 text-xl font-bold tracking-tight">Booking confirmed</h1>
        <p className="mt-2 text-sm text-slate-500">
          {state.service}
          {state.when && <> · {state.when}</>}
        </p>
        <p className="mt-1 text-sm text-slate-500">{state.business}. You can close this page; the chat has your confirmation.</p>
      </div>
    );
  }
  if (state.kind === "confirming") {
    return (
      <div className="text-center">
        <Loader2 className="mx-auto size-10 animate-spin text-brand-600" />
        <h1 className="mt-4 text-lg font-bold tracking-tight">Payment received, confirming…</h1>
        <p className="mt-2 text-sm text-slate-500">This takes a few seconds.</p>
      </div>
    );
  }
  if (state.kind === "expired") {
    return <Message title="This hold has expired" body="Go back to the chat and ask for the payment link again, or pick a new time." icon />;
  }

  return (
    <>
      <p className="text-sm text-slate-500">{state.business}</p>
      <h1 className="mt-1 text-lg font-semibold tracking-tight">{state.service}</h1>
      {state.when && <p className="text-sm text-slate-500">{state.when}</p>}
      <p className="mt-6 text-4xl font-extrabold tracking-tight">{state.amount}</p>
      <p className="mt-1 text-sm text-slate-500">Booking advance · adjusted in final bill</p>
      {state.kind === "razorpay" ? (
        <ButtonLink href={state.url} size="lg" variant="dark" className="mt-8 w-full">
          <Lock className="size-4" /> Pay {state.amount}
        </ButtonLink>
      ) : (
        <Button
          size="lg"
          variant="dark"
          className="mt-8 w-full"
          disabled={pending}
          onClick={() => {
            setError(null);
            if (state.kind === "demo") return setPaid(true);
            startTransition(async () => {
              const r = await confirmTestPayment(bookingId);
              if (r.ok) setPaid(true);
              else setError(r.error ?? "Payment failed.");
            });
          }}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
          {pending ? "Processing…" : `Pay ${state.amount}`}
        </Button>
      )}
      {error && <p className="mt-3 text-center text-sm text-red-600">{error}</p>}
    </>
  );
}

function Message({ title, body, icon }: { title: string; body: string; icon?: boolean }) {
  return (
    <div className="text-center">
      {icon && <Clock className="mx-auto size-10 text-slate-400" />}
      <h1 className="mt-3 text-lg font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">{body}</p>
    </div>
  );
}
