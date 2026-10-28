"use server";

import type { Json } from "@frontdesk/db";
import { revalidatePath } from "next/cache";
import { getBusinessContext } from "@/lib/data/business";
import { normalizeDomain } from "@/lib/embed";
import { createClient } from "@/lib/supabase/server";

export type DomainsResult = { ok: true; domains: string[] } | { ok: false; error: string };

/** Saves which websites may embed the widget. Empty = any website. */
export async function saveAllowedDomains(input: string[]): Promise<DomainsResult> {
  const ctx = await getBusinessContext();
  if (ctx.mode === "demo") return { ok: false, error: "Demo mode: connect Supabase to save settings." };
  if (!ctx.business) return { ok: false, error: "Please log in again." };

  const domains: string[] = [];
  for (const raw of input.slice(0, 20)) {
    const d = normalizeDomain(raw);
    if (!d) return { ok: false, error: `"${raw}" doesn't look like a website address.` };
    if (!domains.includes(d)) domains.push(d);
  }

  // RLS: only an owner of this business can update it. settings holds other
  // AI toggles too, so merge rather than overwrite.
  const supabase = await createClient();
  const { data: current, error: readError } = await supabase
    .from("businesses")
    .select("settings")
    .eq("id", ctx.business.id)
    .single();
  if (readError) return { ok: false, error: "Couldn't load settings. Please try again." };
  const settings = { ...((current.settings as Record<string, Json> | null) ?? {}), allowed_domains: domains };

  const { data, error } = await supabase
    .from("businesses")
    .update({ settings })
    .eq("id", ctx.business.id)
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Only the owner can change this." };
  revalidatePath("/dashboard/widget");
  return { ok: true, domains };
}
