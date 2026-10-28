"use client";

import { ArrowRight, Loader2, MailCheck } from "lucide-react";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ configured, next, error }: { configured: boolean; next: string; error?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [message, setMessage] = useState(error === "link_expired" ? "That login link has expired. Please request a new one." : "");

  if (!configured) {
    return (
      <div className="mt-8 space-y-4">
        <ButtonLink href="/dashboard" size="lg" className="w-full">
          Open demo dashboard <ArrowRight className="size-4" />
        </ButtonLink>
        <p className="text-center text-xs text-ink/45">
          Demo mode: add Supabase keys to <code>.env.local</code> to enable real login.
        </p>
      </div>
    );
  }

  if (state === "sent") {
    return (
      <div className="mt-8 animate-fade-up rounded-2xl bg-brand-50 p-6 text-center ring-1 ring-brand-100">
        <MailCheck className="mx-auto size-10 text-brand-700" />
        <p className="mt-3 font-semibold">Check your inbox</p>
        <p className="mt-1 text-sm text-slate-600">
          We sent a login link to <b>{email}</b>. It works once and expires in an hour.
        </p>
        <button className="mt-4 text-sm font-semibold text-brand-700 hover:underline" onClick={() => setState("idle")}>
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form
      className="mt-8 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("sending");
        setMessage("");
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
        });
        if (error) {
          setState("idle");
          setMessage(error.status === 429 ? "Too many attempts. Please wait a minute and try again." : error.message);
        } else {
          setState("sent");
        }
      }}
    >
      <label className="block">
        <span className="text-sm font-medium">Work email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@clinic.in"
          className="mt-1.5 h-11 w-full rounded-xl border border-black/10 bg-white px-3.5 text-[15px] outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
        />
      </label>
      {message && (
        <p role="alert" className="text-sm text-red-600">
          {message}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={state === "sending"}>
        {state === "sending" ? <Loader2 className="size-4 animate-spin" /> : null}
        Email me a login link {state !== "sending" && <ArrowRight className="size-4" />}
      </Button>
      <p className="text-center text-xs text-ink/45">No password needed. New here? The same link creates your account.</p>
    </form>
  );
}
