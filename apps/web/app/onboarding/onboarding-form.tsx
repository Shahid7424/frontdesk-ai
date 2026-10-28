"use client";

import { ArrowLeft, ArrowRight, Building2, Check, Clock, Loader2, Sparkles, Users } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { onboardingSchema, WEEKDAYS, type OnboardingInput } from "@/lib/onboarding";
import { cn } from "@/lib/utils";
import {
  BusinessFields,
  HoursFields,
  key,
  ServicesFields,
  StaffFields,
  suggestions,
  type Errors,
} from "@/components/setup/setup-fields";
import { createBusiness } from "./actions";

const steps = [
  { id: "business", title: "Your business", icon: Building2 },
  { id: "staff", title: "Team", icon: Users },
  { id: "services", title: "Services & prices", icon: Sparkles },
  { id: "hours", title: "Opening hours", icon: Clock },
  { id: "review", title: "Review", icon: Check },
] as const;

const initialHours = (): OnboardingInput["hours"] =>
  WEEKDAYS.map((_, i) => ({
    open: i !== 0,
    shifts: i === 0 ? [] : [{ start: "09:00", end: "13:30" }, { start: "17:00", end: "21:00" }],
  }));

/** Validates one part of the form and returns errors keyed by field path. */
function validate(section: keyof OnboardingInput, value: unknown): Errors {
  const result = onboardingSchema.shape[section].safeParse(value);
  if (result.success) return {};
  const errors: Errors = {};
  for (const issue of result.error.issues) {
    const path = [section, ...issue.path].join(".");
    errors[path] ??= issue.message;
  }
  return errors;
}

export function OnboardingForm({ demoMode, email }: { demoMode: boolean; email: string | null }) {
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [business, setBusiness] = useState<OnboardingInput["business"]>({
    name: "",
    vertical: "clinic",
    area: "",
    address: "",
    phone: "",
  });
  const [staff, setStaff] = useState<OnboardingInput["staff"]>([{ key: key(), name: "", title: "" }]);
  const [services, setServices] = useState<OnboardingInput["services"]>([]);
  const [hours, setHours] = useState<OnboardingInput["hours"]>(initialHours);

  const sections = { business, staff, services, hours } as const;
  const current = steps[step]!.id;

  const next = () => {
    if (current !== "review") {
      const errs = validate(current, sections[current]);
      setErrors(errs);
      if (Object.keys(errs).length) return;
    }
    // Pre-fill services the first time, linked to everyone on the team.
    if (current === "staff" && services.length === 0) {
      setServices(
        suggestions[business.vertical].slice(0, 2).map((s) => ({ ...s, staffKeys: staff.map((p) => p.key) })),
      );
    }
    setStep((s) => Math.min(s + 1, steps.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const back = () => {
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
  };

  const submit = () => {
    setServerError(null);
    startTransition(async () => {
      const result = await createBusiness({ business, staff, services, hours });
      // On success the action redirects, so we only get here on failure.
      if (result && !result.ok) setServerError(result.error);
    });
  };

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[320px_1fr]">
      {/* Step rail */}
      <aside className="border-b border-black/[0.06] bg-white px-5 py-5 lg:sticky lg:top-0 lg:h-dvh lg:border-r lg:border-b-0 lg:px-8 lg:py-8">
        <Logo />
        <div className="mt-6 lg:mt-12">
          <p className="text-sm font-semibold text-brand-700">Set up in about 5 minutes</p>
          <p className="mt-1 hidden text-sm text-slate-500 lg:block">
            Your AI receptionist uses this to answer questions and book appointments.
          </p>
        </div>
        <ol className="mt-5 flex gap-1.5 lg:mt-8 lg:flex-col lg:gap-1">
          {steps.map((s, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li key={s.id} className="flex-1 lg:flex-none">
                <span className="block h-1.5 rounded-full bg-black/[0.06] lg:hidden">
                  <span className={cn("block h-full rounded-full transition-all", done || active ? "bg-brand-600" : "")} style={{ width: done || active ? "100%" : "0%" }} />
                </span>
                <span
                  className={cn(
                    "hidden items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium lg:flex",
                    active ? "bg-brand-50 text-brand-900" : done ? "text-ink" : "text-slate-400",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-7 place-items-center rounded-full text-xs font-bold",
                      done ? "bg-brand-600 text-white" : active ? "bg-brand-700 text-white" : "bg-slate-100",
                    )}
                  >
                    {done ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  {s.title}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-sm font-semibold lg:hidden">
          Step {step + 1} of {steps.length}: {steps[step]!.title}
        </p>
        {email && <p className="mt-10 hidden text-xs text-slate-400 lg:block">Signed in as {email}</p>}
      </aside>

      <main className="px-4 py-8 sm:px-8 lg:px-16 lg:py-14">
        <div className="mx-auto max-w-2xl">
          {demoMode && (
            <div className="mb-6 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
              <b>Demo mode.</b> Supabase keys aren't set, so you can try the whole form but saving is disabled.
            </div>
          )}

          <div key={current} className="animate-fade-up">
            {current === "business" && <><StepTitle title="Tell us about your business" body="Customers will see this name in the chat." /><BusinessFields autoFocus value={business} onChange={setBusiness} errors={errors} /></>}
            {current === "staff" && <><StepTitle title="Who can customers book?" body="Doctors, stylists or teachers. You can add up to 10 and change this anytime." /><StaffFields value={staff} onChange={setStaff} errors={errors} vertical={business.vertical} /></>}
            {current === "services" && (
              <><StepTitle title="What can customers book?" body="Prices are shared when customers ask, and used for UPI advance payments." /><ServicesFields value={services} onChange={setServices} staff={staff} errors={errors} vertical={business.vertical} /></>
            )}
            {current === "hours" && <><StepTitle title="When are you open?" body="Add a second shift for afternoon breaks, like 9–1:30 and 5–9." /><HoursFields value={hours} onChange={setHours} errors={errors} /></>}
            {current === "review" && <ReviewStep business={business} staff={staff} services={services} hours={hours} goTo={setStep} />}
          </div>

          {serverError && (
            <p role="alert" className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
              {serverError}
            </p>
          )}

          <div className="mt-10 flex items-center justify-between border-t border-black/[0.06] pt-6">
            <Button variant="ghost" onClick={back} disabled={step === 0 || pending} className={step === 0 ? "invisible" : ""}>
              <ArrowLeft className="size-4" /> Back
            </Button>
            {current === "review" ? (
              <Button size="lg" onClick={submit} disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {pending ? "Setting up…" : "Launch my AI receptionist"}
              </Button>
            ) : (
              <Button size="lg" onClick={next}>
                Continue <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function StepTitle({ title, body }: { title: string; body: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-extrabold tracking-[-0.025em] sm:text-3xl">{title}</h1>
      <p className="mt-2 text-[15px] text-slate-500">{body}</p>
    </div>
  );
}

function ReviewStep({
  business,
  staff,
  services,
  hours,
  goTo,
}: {
  business: OnboardingInput["business"];
  staff: OnboardingInput["staff"];
  services: OnboardingInput["services"];
  hours: OnboardingInput["hours"];
  goTo: (step: number) => void;
}) {
  const openDays = hours.map((d, i) => ({ ...d, i })).filter((d) => d.open);
  return (
    <>
      <StepTitle title="Looks good?" body="Your AI receptionist will use exactly this. You can edit everything later in Settings." />
      <div className="space-y-3">
        <ReviewCard title="Business" onEdit={() => goTo(0)}>
          <p className="font-semibold">{business.name}</p>
          <p className="text-sm text-slate-500">{[business.area, business.phone].filter(Boolean).join(" · ") || "No area or phone added"}</p>
        </ReviewCard>
        <ReviewCard title={`Team (${staff.length})`} onEdit={() => goTo(1)}>
          <p className="text-sm">{staff.map((s) => s.name).join(", ")}</p>
        </ReviewCard>
        <ReviewCard title={`Services (${services.length})`} onEdit={() => goTo(2)}>
          <ul className="space-y-1 text-sm">
            {services.map((s, i) => (
              <li key={i} className="flex justify-between gap-4">
                <span>{s.name} <span className="text-slate-400">· {s.durationMin} min</span></span>
                <span className="font-medium tabular-nums">{s.priceRupees ? `₹${s.priceRupees.toLocaleString("en-IN")}` : "Free"}</span>
              </li>
            ))}
          </ul>
        </ReviewCard>
        <ReviewCard title="Hours" onEdit={() => goTo(3)}>
          <ul className="space-y-1 text-sm">
            {openDays.map((d) => (
              <li key={d.i} className="flex justify-between gap-4">
                <span>{WEEKDAYS[d.i]}</span>
                <span className="text-slate-600 tabular-nums">{d.shifts.map((s) => `${s.start}–${s.end}`).join(", ")}</span>
              </li>
            ))}
          </ul>
        </ReviewCard>
      </div>
    </>
  );
}

function ReviewCard({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-black/[0.07]">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{title}</h2>
        <button type="button" onClick={onEdit} className="text-[13px] font-semibold text-brand-700 hover:underline">
          Edit
        </button>
      </div>
      {children}
    </section>
  );
}
