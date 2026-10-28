"use server";

import type { Json } from "@frontdesk/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getBusinessContext } from "@/lib/data/business";
import { settingsSchema, toUpdatePayload, type SettingsInput } from "@/lib/onboarding";
import { createClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/monitoring";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Online advance (Razorpay) or pay at the clinic. Merged into settings, which holds other toggles too. */
export async function savePaymentMode(mode: "online" | "at_clinic"): Promise<ActionResult> {
  if (mode !== "online" && mode !== "at_clinic") return { ok: false, error: "Invalid option." };
  return mergeSettings({ payment_mode: mode });
}

const alertsSchema = z.object({
  email: z.union([z.literal(""), z.string().trim().toLowerCase().email("Enter a valid email address").max(200)]),
  bookings: z.boolean(),
});

/** Where owner alerts go, and whether bookings alert too. */
export async function saveAlertSettings(input: { email: string; bookings: boolean }): Promise<ActionResult> {
  const parsed = alertsSchema.safeParse({ ...input, email: input.email.trim() });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings." };
  return mergeSettings({ alerts: parsed.data });
}

async function mergeSettings(patch: Record<string, Json>): Promise<ActionResult> {
  const ctx = await getBusinessContext();
  if (ctx.mode === "demo") return { ok: false, error: "Demo mode: connect Supabase to save settings." };
  if (!ctx.business) return { ok: false, error: "Please log in again." };

  const supabase = await createClient();
  const { data: current, error: readError } = await supabase.from("businesses").select("settings").eq("id", ctx.business.id).single();
  if (readError) return { ok: false, error: "Couldn't load settings. Please try again." };
  const settings = { ...((current.settings as Record<string, Json> | null) ?? {}), ...patch };
  // RLS: only an owner can update the business row.
  const { data, error } = await supabase.from("businesses").update({ settings }).eq("id", ctx.business.id).select("id").maybeSingle();
  if (error || !data) return { ok: false, error: "Only the owner can change this." };
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

const setupErrors: Record<string, string> = {
  not_owner: "Only the owner can change these settings.",
  not_authenticated: "Your session expired. Please log in again.",
  unknown_staff: "Someone on the team was changed in another tab. Reload the page and try again.",
  unknown_service: "A service was changed in another tab. Reload the page and try again.",
};

/**
 * Saves the business profile, team, services and opening hours in one
 * transaction. The AI reads these fresh on every message, so changes apply
 * to the next chat straight away.
 */
export async function saveBusinessSetup(
  input: SettingsInput,
): Promise<ActionResult | { ok: false; error: string; fieldErrors: Record<string, string> }> {
  const ctx = await getBusinessContext();
  if (ctx.mode === "demo") return { ok: false, error: "Demo mode: connect Supabase to save settings." };
  if (!ctx.business) return { ok: false, error: "Please log in again." };

  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  // Every service must be offered by someone still on the team.
  const keys = new Set(parsed.data.staff.map((s) => s.key));
  const orphan = parsed.data.services.findIndex((s) => !s.staffKeys.some((k) => keys.has(k)));
  if (orphan !== -1) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: { [`services.${orphan}.staffKeys`]: "Pick who provides this" } };
  }

  const payload = toUpdatePayload(parsed.data);
  // Removed people can't stay linked to a service.
  payload.services = payload.services.map((s) => ({ ...s, staff_keys: s.staff_keys.filter((k) => keys.has(k)) }));

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_business_setup", { target: ctx.business.id, payload });
  if (error) {
    const code = Object.keys(setupErrors).find((k) => error.message.includes(k));
    if (!code) reportError("[settings] update_business_setup failed", error);
    return { ok: false, error: code ? setupErrors[code]! : "Couldn't save. Please try again." };
  }
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}
