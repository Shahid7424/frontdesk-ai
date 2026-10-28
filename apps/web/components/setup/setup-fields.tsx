"use client";

import { Check, Copy, GraduationCap, Plus, Scissors, Stethoscope, Store, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WEEKDAYS, type OnboardingInput } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

/**
 * The business, team, services and hours fields. Onboarding shows them as
 * steps; Settings shows them as cards for editing later.
 */

export type Vertical = OnboardingInput["business"]["vertical"];
export type Errors = Record<string, string>;


export const verticals: Array<{ id: Vertical; label: string; icon: typeof Store }> = [
  { id: "clinic", label: "Clinic", icon: Stethoscope },
  { id: "salon", label: "Salon", icon: Scissors },
  { id: "coaching", label: "Coaching", icon: GraduationCap },
  { id: "other", label: "Other", icon: Store },
];

export const suggestions: Record<Vertical, Array<{ name: string; durationMin: number; priceRupees: number }>> = {
  clinic: [
    { name: "General consultation", durationMin: 15, priceRupees: 500 },
    { name: "Follow-up", durationMin: 10, priceRupees: 0 },
    { name: "Specialist consultation", durationMin: 20, priceRupees: 800 },
  ],
  salon: [
    { name: "Haircut", durationMin: 30, priceRupees: 400 },
    { name: "Hair spa", durationMin: 60, priceRupees: 1200 },
    { name: "Facial", durationMin: 45, priceRupees: 900 },
  ],
  coaching: [
    { name: "Demo class", durationMin: 60, priceRupees: 0 },
    { name: "Counselling session", durationMin: 30, priceRupees: 0 },
  ],
  other: [{ name: "Consultation", durationMin: 30, priceRupees: 500 }],
};

export const key = () => Math.random().toString(36).slice(2, 8);

const inputBase =
  "h-11 w-full rounded-xl border bg-white px-3.5 text-[15px] outline-none transition focus:ring-4 placeholder:text-slate-400";
export const inputClass = (error?: string) =>
  cn(inputBase, error ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-black/10 focus:border-brand-500 focus:ring-brand-100");

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {hint && <span className="ml-1.5 text-xs text-slate-400">{hint}</span>}
      <div className="mt-1.5">{children}</div>
      {error && <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>}
    </label>
  );
}

export function BusinessFields({
  value,
  onChange,
  errors,
  autoFocus = false,
}: {
  value: OnboardingInput["business"];
  onChange: (v: OnboardingInput["business"]) => void;
  errors: Errors;
  autoFocus?: boolean;
}) {
  const set = <K extends keyof OnboardingInput["business"]>(k: K, v: OnboardingInput["business"][K]) => onChange({ ...value, [k]: v });
  return (
    <>
      <div className="space-y-5">
        <div>
          <span className="text-sm font-medium">Type of business</span>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {verticals.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                aria-pressed={value.vertical === id}
                onClick={() => set("vertical", id)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-2xl px-3 py-4 text-sm font-semibold ring-1 transition",
                  value.vertical === id ? "bg-brand-50 text-brand-900 ring-2 ring-brand-500" : "bg-white ring-black/10 hover:ring-black/20",
                )}
              >
                <Icon className={cn("size-5", value.vertical === id ? "text-brand-700" : "text-slate-400")} />
                {label}
              </button>
            ))}
          </div>
        </div>
        <Field label="Business name" error={errors["business.name"]}>
          <input className={inputClass(errors["business.name"])} value={value.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Sunrise Family Clinic" autoFocus={autoFocus} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Area / locality" hint="optional" error={errors["business.area"]}>
            <input className={inputClass()} value={value.area} onChange={(e) => set("area", e.target.value)} placeholder="Baner, Pune" />
          </Field>
          <Field label="Phone" hint="optional" error={errors["business.phone"]}>
            <input className={inputClass(errors["business.phone"])} value={value.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98XXX XXXXX" inputMode="tel" />
          </Field>
        </div>
        <Field label="Address" hint="optional, shared when customers ask for directions">
          <textarea className={cn(inputClass(), "h-24 py-3")} value={value.address} onChange={(e) => set("address", e.target.value)} />
        </Field>
      </div>
    </>
  );
}

export function StaffFields({
  value,
  onChange,
  errors,
  vertical,
}: {
  value: OnboardingInput["staff"];
  onChange: (v: OnboardingInput["staff"]) => void;
  errors: Errors;
  vertical: Vertical;
}) {
  const placeholder = { clinic: ["Dr. Anjali Mehta", "General Physician"], salon: ["Priya", "Senior Stylist"], coaching: ["Rahul Sir", "Physics"], other: ["Name", "Role"] }[vertical];
  return (
    <>
      <ul className="space-y-3">
        {value.map((p, i) => (
          <li key={p.key} className="flex items-start gap-2 rounded-2xl bg-white p-3 ring-1 ring-black/[0.07]">
            <div className="grid flex-1 gap-2 sm:grid-cols-2">
              <div>
                <input
                  aria-label="Name"
                  className={inputClass(errors[`staff.${i}.name`])}
                  value={p.name}
                  placeholder={placeholder[0]}
                  onChange={(e) => onChange(value.map((x) => (x.key === p.key ? { ...x, name: e.target.value } : x)))}
                />
                {errors[`staff.${i}.name`] && <span className="mt-1 block text-xs font-medium text-red-600">{errors[`staff.${i}.name`]}</span>}
              </div>
              <input
                aria-label="Role"
                className={inputClass()}
                value={p.title}
                placeholder={`${placeholder[1]} (optional)`}
                onChange={(e) => onChange(value.map((x) => (x.key === p.key ? { ...x, title: e.target.value } : x)))}
              />
            </div>
            <Button variant="ghost" size="icon" className="mt-1" aria-label="Remove" disabled={value.length === 1} onClick={() => onChange(value.filter((x) => x.key !== p.key))}>
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
      {errors.staff && <p className="mt-2 text-sm text-red-600">{errors.staff}</p>}
      <Button variant="secondary" className="mt-4" disabled={value.length >= 10} onClick={() => onChange([...value, { key: key(), name: "", title: "" }])}>
        <Plus className="size-4" /> Add person
      </Button>
    </>
  );
}

export function ServicesFields({
  value,
  onChange,
  staff,
  errors,
  vertical,
}: {
  value: OnboardingInput["services"];
  onChange: (v: OnboardingInput["services"]) => void;
  staff: OnboardingInput["staff"];
  errors: Errors;
  vertical: Vertical;
}) {
  const update = (i: number, patch: Partial<OnboardingInput["services"][number]>) => onChange(value.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const unused = suggestions[vertical].filter((s) => !value.some((v) => v.name === s.name));

  return (
    <>
      <ul className="space-y-3">
        {value.map((s, i) => (
          <li key={i} className="rounded-2xl bg-white p-4 ring-1 ring-black/[0.07]">
            <div className="flex items-start gap-2">
              <div className="grid flex-1 gap-3 sm:grid-cols-[1fr_120px_120px]">
                <Field label="Service" error={errors[`services.${i}.name`]}>
                  <input className={inputClass(errors[`services.${i}.name`])} value={s.name} onChange={(e) => update(i, { name: e.target.value })} />
                </Field>
                <Field label="Duration">
                  <select className={inputClass()} value={s.durationMin} onChange={(e) => update(i, { durationMin: Number(e.target.value) })}>
                    {[10, 15, 20, 30, 45, 60, 90, 120].map((m) => (
                      <option key={m} value={m}>
                        {m} min
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Price (₹)" error={errors[`services.${i}.priceRupees`]}>
                  <input
                    className={inputClass(errors[`services.${i}.priceRupees`])}
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={Number.isNaN(s.priceRupees) ? "" : s.priceRupees}
                    onChange={(e) => update(i, { priceRupees: e.target.valueAsNumber })}
                  />
                </Field>
              </div>
              <Button variant="ghost" size="icon" className="mt-7" aria-label="Remove service" onClick={() => onChange(value.filter((_, j) => j !== i))}>
                <Trash2 className="size-4" />
              </Button>
            </div>
            <div className="mt-3">
              <span className="text-xs font-medium text-slate-500">Provided by</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {staff.map((p) => {
                  const on = s.staffKeys.includes(p.key);
                  return (
                    <button
                      key={p.key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => update(i, { staffKeys: on ? s.staffKeys.filter((k) => k !== p.key) : [...s.staffKeys, p.key] })}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[13px] font-medium ring-1 transition",
                        on ? "bg-brand-700 text-white ring-brand-700" : "bg-white text-slate-600 ring-black/10 hover:ring-black/20",
                      )}
                    >
                      {on && <Check className="size-3" />} {p.name || "Unnamed"}
                    </button>
                  );
                })}
              </div>
              {errors[`services.${i}.staffKeys`] && <span className="mt-1 block text-xs font-medium text-red-600">{errors[`services.${i}.staffKeys`]}</span>}
            </div>
          </li>
        ))}
      </ul>
      {errors.services && <p className="mt-2 text-sm text-red-600">{errors.services}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => onChange([...value, { name: "", durationMin: 30, priceRupees: 0, staffKeys: staff.map((p) => p.key) }])}>
          <Plus className="size-4" /> Add service
        </Button>
        {unused.map((s) => (
          <button
            key={s.name}
            type="button"
            onClick={() => onChange([...value, { ...s, staffKeys: staff.map((p) => p.key) }])}
            className="rounded-full bg-brand-50 px-3 py-1.5 text-[13px] font-medium text-brand-800 ring-1 ring-brand-100 transition hover:bg-brand-100"
          >
            + {s.name}
          </button>
        ))}
      </div>
    </>
  );
}

export function HoursFields({ value, onChange, errors }: { value: OnboardingInput["hours"]; onChange: (v: OnboardingInput["hours"]) => void; errors: Errors }) {
  const setDay = (i: number, day: OnboardingInput["hours"][number]) => onChange(value.map((d, j) => (j === i ? day : d)));
  // Show Monday first: that's how Indian businesses think about their week.
  const order = [1, 2, 3, 4, 5, 6, 0];

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange(value.map((d, i) => (i >= 2 && i <= 6 ? structuredClone(value[1]!) : d)))}
        >
          <Copy className="size-3.5" /> Copy Monday to Tue–Sat
        </Button>
      </div>
      <ul className="divide-y divide-black/5 rounded-2xl bg-white ring-1 ring-black/[0.07]">
        {order.map((i) => {
          const day = value[i]!;
          return (
            <li key={i} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-start">
              <label className="flex w-36 shrink-0 cursor-pointer items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={day.open}
                  onChange={(e) => setDay(i, { open: e.target.checked, shifts: e.target.checked && !day.shifts.length ? [{ start: "09:00", end: "18:00" }] : day.shifts })}
                />
                <span className="relative h-5 w-9 rounded-full bg-slate-200 transition peer-checked:bg-brand-600 peer-focus-visible:ring-4 peer-focus-visible:ring-brand-100 after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-4" />
                <span className="text-sm font-semibold">{WEEKDAYS[i]}</span>
              </label>
              {day.open ? (
                <div className="flex-1 space-y-2">
                  {day.shifts.map((s, k) => (
                    <div key={k}>
                      <div className="flex items-center gap-2">
                        <input type="time" aria-label="Opens" className={cn(inputClass(errors[`hours.${i}.shifts.${k}.end`]), "h-10 w-[9.5rem] px-3")} value={s.start} onChange={(e) => setDay(i, { ...day, shifts: day.shifts.map((x, j) => (j === k ? { ...x, start: e.target.value } : x)) })} />
                        <span className="text-slate-400">–</span>
                        <input type="time" aria-label="Closes" className={cn(inputClass(errors[`hours.${i}.shifts.${k}.end`]), "h-10 w-[9.5rem] px-3")} value={s.end} onChange={(e) => setDay(i, { ...day, shifts: day.shifts.map((x, j) => (j === k ? { ...x, end: e.target.value } : x)) })} />
                        {day.shifts.length > 1 && (
                          <Button variant="ghost" size="icon" aria-label="Remove shift" onClick={() => setDay(i, { ...day, shifts: day.shifts.filter((_, j) => j !== k) })}>
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                      {errors[`hours.${i}.shifts.${k}.end`] && <span className="mt-1 block text-xs font-medium text-red-600">{errors[`hours.${i}.shifts.${k}.end`]}</span>}
                    </div>
                  ))}
                  {day.shifts.length < 2 && (
                    <button type="button" className="text-[13px] font-semibold text-brand-700 hover:underline" onClick={() => setDay(i, { ...day, shifts: [...day.shifts, { start: "17:00", end: "21:00" }] })}>
                      + Add second shift
                    </button>
                  )}
                </div>
              ) : (
                <p className="pt-2 text-sm text-slate-400">Closed</p>
              )}
            </li>
          );
        })}
      </ul>
      {errors.hours && <p className="mt-2 text-sm text-red-600">{errors.hours}</p>}
    </>
  );
}

