import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getBusinessContext } from "@/lib/data/business";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Set up your business", robots: { index: false } };

export default async function OnboardingPage() {
  const ctx = await getBusinessContext();
  if (ctx.mode === "live") {
    if (!ctx.user) redirect("/login?next=/onboarding");
    if (ctx.business) redirect("/dashboard");
  }
  return <OnboardingForm demoMode={ctx.mode === "demo"} email={ctx.user?.email ?? null} />;
}
