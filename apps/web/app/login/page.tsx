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
    <main className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <div className="relative flex flex-col px-6 py-8 sm:px-12">
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="bg-grid absolute inset-0" />
          <div className="absolute -top-32 -left-32 size-[420px] rounded-full bg-brand-200/50 blur-[110px]" />
        </div>
        <Logo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <div className="rounded-3xl bg-white/85 p-7 shadow-lift ring-1 ring-black/[0.06] backdrop-blur sm:p-8">
            <h1 className="text-[1.7rem] font-extrabold tracking-[-0.03em]">Welcome back 🙏</h1>
            <p className="mt-2 text-sm text-ink/60">Log in to see your conversations and bookings.</p>
            <LoginForm configured={isSupabaseConfigured} next={next} error={error} />
          </div>
        </div>
        <p className="text-center text-xs text-ink/40">© {new Date().getFullYear()} Swagat AI · Made in India</p>
      </div>
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 lg:block">
        <div aria-hidden className="absolute inset-0">
          <div className="bg-grid absolute inset-0 opacity-40 invert" />
          <div className="absolute -top-20 right-0 size-[520px] rounded-full bg-brand-400/40 blur-[110px]" />
          <div className="absolute bottom-0 -left-20 size-[380px] rounded-full bg-saffron-400/25 blur-[100px]" />
        </div>
        <div className="relative flex h-full flex-col p-12 text-white">
          <div className="mx-auto my-auto w-full max-w-md space-y-3">
            <Preview who="Customer" text="Kal shaam 6 baje slot milega?" />
            <Preview who="Swagat AI" ai text="Haan ji! 6:00 PM aur 6:30 PM khaali hain. Kaunsa book karun?" />
            <div className="ml-10 flex items-center gap-3 rounded-2xl bg-white p-3 text-ink shadow-lift">
              <span className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600">✓</span>
              <div className="text-xs leading-tight">
                <p className="font-semibold">New booking · 6:30 PM</p>
                <p className="text-slate-500">Advance ₹500 paid via UPI</p>
              </div>
            </div>
          </div>
          <div>
            <blockquote className="max-w-md text-[1.7rem] leading-snug font-semibold tracking-tight">
              “Ab raat ko aaye messages ke jawab ke liye{" "}
              <span className="font-serif font-normal text-saffron-300 italic">subah tak wait</span> nahi karna padta.”
            </blockquote>
            <p className="mt-4 text-sm text-white/65">What we're building towards with our pilot businesses</p>
          </div>
        </div>
      </div>
    </main>
  );
}

function Preview({ who, text, ai }: { who: string; text: string; ai?: boolean }) {
  return (
    <div className={ai ? "mr-6" : "ml-10"}>
      <p className={`mb-1 text-[11px] font-semibold text-white/55 ${ai ? "" : "text-right"}`}>{who}</p>
      <p
        className={
          ai
            ? "rounded-2xl rounded-tl-md bg-white/95 px-4 py-2.5 text-sm text-ink shadow-lift"
            : "rounded-2xl rounded-tr-md bg-white/15 px-4 py-2.5 text-sm ring-1 ring-white/20 backdrop-blur"
        }
      >
        {text}
      </p>
    </div>
  );
}
