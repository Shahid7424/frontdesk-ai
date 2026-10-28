import { z } from "zod";

/**
 * Onboarding form schema. Shared by the client (instant field errors) and
 * the Server Action (the check that actually matters).
 */

/** A mobile (98765 43210) or a landline with its STD code (020 2729 1234), with or without +91. */
export function isIndianPhone(raw: string): boolean {
  if (!/^[\d\s()+-]+$/.test(raw)) return false;
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits.length === 10 && digits[0] !== "0";
}

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");

export const shiftSchema = z
  .object({ start: time, end: time })
  .refine((s) => s.end > s.start, { message: "Closing time must be after opening time", path: ["end"] });

export const onboardingSchema = z.object({
  business: z.object({
    name: z.string().trim().min(2, "Business name is required").max(120),
    vertical: z.enum(["clinic", "salon", "coaching", "other"]),
    area: z.string().trim().max(80).optional().default(""),
    address: z.string().trim().max(300).optional().default(""),
    phone: z
      .string()
      .trim()
      .refine((v) => v === "" || isIndianPhone(v), "Enter a valid Indian phone number")
  }),
  staff: z
    .array(z.object({ key: z.string().min(1), name: z.string().trim().min(1, "Name is required").max(80), title: z.string().trim().max(80) }))
    .min(1, "Add at least one person")
    .max(10),
  services: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Service name is required").max(120),
        durationMin: z.number().int().min(5).max(480),
        priceRupees: z.number().min(0, "Price can't be negative").max(1_00_000),
        staffKeys: z.array(z.string()).min(1, "Pick who provides this"),
      }),
    )
    .min(1, "Add at least one service")
    .max(50),
  hours: z
    .array(z.object({ open: z.boolean(), shifts: z.array(shiftSchema).max(2) }))
    .length(7)
    .refine((days) => days.some((d) => d.open && d.shifts.length > 0), "Open at least one day"),
});

export type OnboardingInput = z.input<typeof onboardingSchema>;
export type OnboardingData = z.output<typeof onboardingSchema>;

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function slugify(name: string) {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  // Random suffix keeps slugs unique without a lookup round trip.
  return `${base.length >= 3 ? base : "business"}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Converts the form into the payload create_business_with_setup() expects. */
export function toSetupPayload(data: OnboardingData) {
  return {
    business: { ...data.business, slug: slugify(data.business.name) },
    staff: data.staff.map((s) => ({ key: s.key, name: s.name, title: s.title })),
    services: data.services.map((s) => ({
      name: s.name,
      duration_min: s.durationMin,
      price_paise: Math.round(s.priceRupees * 100),
      staff_keys: s.staffKeys,
    })),
    hours: data.hours.flatMap((day, weekday) =>
      day.open ? day.shifts.map((s) => ({ weekday, start_time: s.start, end_time: s.end })) : [],
    ),
  };
}

/**
 * Settings edits the same fields; existing staff and services carry their
 * database id so they're updated in place (bookings point at them).
 */
export const settingsSchema = onboardingSchema.extend({
  staff: z
    .array(onboardingSchema.shape.staff.element.extend({ id: z.string().uuid().optional() }))
    .min(1, "Add at least one person")
    .max(10),
  services: z
    .array(onboardingSchema.shape.services.element.extend({ id: z.string().uuid().optional() }))
    .min(1, "Add at least one service")
    .max(50),
});

export type SettingsInput = z.input<typeof settingsSchema>;
export type SettingsData = z.output<typeof settingsSchema>;

/** Converts the settings form into the payload update_business_setup() expects. */
export function toUpdatePayload(data: SettingsData) {
  return {
    business: data.business,
    staff: data.staff.map((s) => ({ key: s.key, ...(s.id ? { id: s.id } : {}), name: s.name, title: s.title })),
    services: data.services.map((s) => ({
      ...(s.id ? { id: s.id } : {}),
      name: s.name,
      duration_min: s.durationMin,
      price_paise: Math.round(s.priceRupees * 100),
      staff_keys: s.staffKeys,
    })),
    hours: data.hours.flatMap((day, weekday) =>
      day.open ? day.shifts.map((s) => ({ weekday, start_time: s.start, end_time: s.end })) : [],
    ),
  };
}

/** The business-wide hours as the form's seven days (Sunday first). Staff-only hours aren't part of it. */
export function toFormHours(rules: Array<{ weekday: number; start: string; end: string; staffId: string | null }>): OnboardingInput["hours"] {
  return WEEKDAYS.map((_, weekday) => {
    const shifts = rules
      .filter((r) => r.weekday === weekday && r.staffId === null)
      .sort((a, b) => a.start.localeCompare(b.start))
      .slice(0, 2)
      .map((r) => ({ start: r.start, end: r.end }));
    return { open: shifts.length > 0, shifts };
  });
}

/** What the settings form starts with: the saved business, team, services and hours. */
export function settingsFromSetup(
  business: { name: string; vertical: SettingsInput["business"]["vertical"]; area: string | null; address: string | null; phone: string | null },
  setup: {
    staff: Array<{ id: string; name: string; title: string | null }>;
    services: Array<{ id: string; name: string; durationMin: number; pricePaise: number; staffIds: string[] }>;
    hours: Array<{ weekday: number; start: string; end: string; staffId: string | null }>;
  },
): SettingsInput {
  const staffIds = new Set(setup.staff.map((s) => s.id));
  return {
    business: { name: business.name, vertical: business.vertical, area: business.area ?? "", address: business.address ?? "", phone: business.phone ?? "" },
    staff: setup.staff.map((s) => ({ key: s.id, id: s.id, name: s.name, title: s.title ?? "" })),
    services: setup.services.map((s) => ({
      id: s.id,
      name: s.name,
      durationMin: s.durationMin,
      priceRupees: s.pricePaise / 100,
      staffKeys: s.staffIds.filter((id) => staffIds.has(id)),
    })),
    hours: toFormHours(setup.hours),
  };
}
