import type { Metadata } from "next";
import { Logo } from "@/components/ui/logo";
import { isSupabaseConfigured } from "@/lib/env";
import { safeNext } from "@/lib/safe-next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

// Passwordless magic link: nothing for clinic staff to forget, and no
// password table for us to protect.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next: rawNext, error } = await searchParams;
  const next = safeNext(rawNext);
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-2xl font-extrabold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-sm text-ink/60">Log in to see your conversations and bookings.</p>
          <LoginForm configured={isSupabaseConfigured} next={next} error={error} />
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-brand-800 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_70%_20%,var(--color-brand-500),transparent)]" />
        <div className="relative flex h-full flex-col justify-end p-12 text-white">
          <blockquote className="max-w-md text-2xl leading-snug font-semibold tracking-tight">
            “Ab raat ko aaye WhatsApp ke jawab ke liye subah tak wait nahi karna padta.”
          </blockquote>
          <p className="mt-4 text-sm text-white/70">What we're building towards with our pilot clinics</p>
        </div>
      </div>
    </main>
  );
}
