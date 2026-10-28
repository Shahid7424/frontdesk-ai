"use server";

import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { onboardingSchema, toSetupPayload, type OnboardingInput } from "@/lib/onboarding";
import { createClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/monitoring";

export type OnboardingResult = { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const friendlyErrors: Record<string, string> = {
  already_onboarded: "You've already set up a business. Taking you to your dashboard.",
  not_authenticated: "Your session expired. Please log in again.",
};

export async function createBusiness(input: OnboardingInput): Promise<OnboardingResult> {
  // Never trust the client: validate again on the server.
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  if (!isSupabaseConfigured) {
    return {
      ok: false,
      error: "Demo mode: add your Supabase keys to .env.local to save this business. Everything else on this form works.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_business_with_setup", { payload: toSetupPayload(parsed.data) });

  if (error) {
    const code = Object.keys(friendlyErrors).find((k) => error.message.includes(k));
    if (code === "already_onboarded") redirect("/dashboard");
    reportError("[onboarding] create_business_with_setup failed", error);
    return { ok: false, error: code ? friendlyErrors[code]! : "Something went wrong while saving. Please try again." };
  }

  redirect("/dashboard?welcome=1");
}
