import { BadgeIndianRupee, CalendarCheck, CheckCheck, FileText, Languages, Lock } from "lucide-react";

/** Static, animated preview of a real Swagat AI conversation for the hero. */
export function HeroChat() {
  return (
    <div className="relative mx-auto w-full max-w-[410px] lg:mr-4">
      <div
        aria-hidden
        className="absolute -inset-10 -z-10 rounded-[56px] bg-[conic-gradient(from_140deg,var(--color-brand-300),var(--color-saffron-300),var(--color-brand-200),var(--color-brand-400))] opacity-50 blur-3xl"
      />
      <div className="rounded-[34px] bg-white/60 p-2 shadow-lift ring-1 ring-black/[0.06] backdrop-blur-xl">
        <div className="overflow-hidden rounded-[28px] bg-white ring-1 ring-black/[0.05]">
          <div className="relative flex items-center gap-3 overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 px-4 py-4 text-white">
            <div aria-hidden className="absolute -top-10 -right-6 size-28 rounded-full bg-saffron-400/30 blur-2xl" />
            <span className="relative grid size-10 place-items-center rounded-full bg-white/15 text-sm font-bold ring-1 ring-white/20">
              SF
              <span className="absolute right-0 bottom-0.5 size-2.5 rounded-full bg-emerald-400 ring-2 ring-brand-700" />
            </span>
            <div className="relative min-w-0">
              <p className="truncate text-sm font-semibold">Sunrise Family Clinic</p>
              <p className="text-xs text-white/75">AI receptionist · replies instantly</p>
            </div>
          </div>

          <div className="space-y-2.5 bg-[linear-gradient(to_bottom,#faf9ff,#f6f5fb)] px-3.5 py-4 text-[13.5px] leading-relaxed">
            <Bubble side="user" delay={0.1}>
              Dr. Kulkarni ki fees kitni hai? Kal mil sakte hain?
            </Bubble>
            <Bubble side="bot" delay={0.5}>
              Chest &amp; asthma consultation ₹800 hai. Kal ke liye ye slots khaali hain 👇
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11.5px] text-brand-800 ring-1 ring-brand-100">
                <FileText className="size-3" /> Clinic rate card.pdf
              </span>
            </Bubble>
            <div className="grid grid-cols-3 gap-1.5 animate-fade-up" style={{ animationDelay: "0.9s" }}>
              {["10:30 AM", "11:15 AM", "5:30 PM"].map((t, i) => (
                <span
                  key={t}
                  className={
                    i === 1
                      ? "rounded-xl bg-gradient-to-b from-brand-600 to-brand-800 py-2 text-center text-xs font-semibold text-white shadow-md shadow-brand-900/20"
                      : "rounded-xl bg-white py-2 text-center text-xs font-semibold text-brand-800 ring-1 ring-brand-200"
                  }
                >
                  {t}
                </span>
              ))}
            </div>
            <Bubble side="bot" delay={1.3}>
              Done! 11:15 AM hold kar diya hai. Payment hote hi confirm ✅
            </Bubble>
            <div
              className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 ring-1 ring-black/[0.06] animate-fade-up"
              style={{ animationDelay: "1.7s" }}
            >
              <div>
                <p className="text-[11px] text-slate-500">Booking advance</p>
                <p className="text-base font-bold tracking-tight">₹800</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-3 py-2 text-xs font-semibold text-white">
                <Lock className="size-3.5" /> Pay via UPI
              </span>
            </div>
          </div>
        </div>
      </div>

      <Float className="-right-4 -bottom-7 sm:-right-10" delay="0s">
        <span className="grid size-8 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
          <CalendarCheck className="size-4" />
        </span>
        <div className="text-xs leading-tight">
          <p className="font-semibold">Booking confirmed</p>
          <p className="text-slate-500">Paid ₹800 · 11:15 AM</p>
        </div>
      </Float>
      <Float className="top-[100px] -left-4 sm:-left-24" delay="1.5s">
        <span className="grid size-8 place-items-center rounded-xl bg-brand-50 text-brand-700">
          <Languages className="size-4" />
        </span>
        <div className="text-xs leading-tight">
          <p className="font-semibold">Replied in Hinglish</p>
          <p className="text-slate-500">in 2.1 seconds</p>
        </div>
      </Float>
      <Float className="-top-8 -right-2 sm:-right-8" delay="3s">
        <span className="grid size-8 place-items-center rounded-xl bg-saffron-100 text-saffron-600">
          <BadgeIndianRupee className="size-4" />
        </span>
        <div className="text-xs leading-tight">
          <p className="font-semibold">₹12,400 collected</p>
          <p className="text-slate-500">in advances this week</p>
        </div>
      </Float>
    </div>
  );
}

function Float({ className, delay, children }: { className: string; delay: string; children: React.ReactNode }) {
  return (
    <div
      aria-hidden
      className={`absolute hidden items-center gap-2.5 rounded-2xl bg-white/95 px-3.5 py-2.5 shadow-lift ring-1 ring-black/[0.06] backdrop-blur animate-float sm:flex ${className}`}
      style={{ animationDelay: delay }}
    >
      {children}
    </div>
  );
}

function Bubble({ side, delay, children }: { side: "user" | "bot"; delay: number; children: React.ReactNode }) {
  const user = side === "user";
  return (
    <div className={`flex animate-fade-up ${user ? "justify-end" : ""}`} style={{ animationDelay: `${delay}s` }}>
      <div
        className={
          user
            ? "max-w-[85%] rounded-2xl rounded-tr-md bg-gradient-to-br from-brand-600 to-brand-800 px-3.5 py-2 text-white shadow-sm shadow-brand-900/20"
            : "flex max-w-[88%] flex-col items-start rounded-2xl rounded-tl-md bg-white px-3.5 py-2 shadow-sm ring-1 ring-black/[0.05]"
        }
      >
        {children}
        {user && <CheckCheck className="mt-0.5 ml-auto size-3.5 text-white/70" aria-hidden />}
      </div>
    </div>
  );
}
