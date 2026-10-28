import type { WidgetConfig } from "@frontdesk/core";
import { corsHeaders, preflight } from "@/lib/cors";
import { allowedDomains, isOriginAllowed } from "@/lib/embed";
import { isSupabaseConfigured } from "@/lib/env";
import { DEMO_BUSINESS_ID, demoClinic, demoQuickReplies } from "@/lib/mock/demo-clinic";
import { createServiceClient } from "@/lib/supabase/server";

export const OPTIONS = preflight;

const QUICK_REPLIES: Record<string, string[]> = {
  clinic: ["Consultation fees kitni hai?", "Kal appointment chahiye", "Clinic timings kya hain?"],
  salon: ["Haircut ka rate kya hai?", "Aaj shaam ka slot milega?", "Aap kahan par ho?"],
  coaching: ["Fees structure batao", "Demo class book karni hai", "Batch timings kya hain?"],
};

export async function GET(request: Request) {
  const businessId = new URL(request.url).searchParams.get("businessId") ?? "";
  const live = businessId === DEMO_BUSINESS_ID ? null : await liveConfig(businessId);
  const config = businessId === DEMO_BUSINESS_ID ? demoConfig() : live?.config;
  if (!config) return Response.json({ error: "unknown_business" }, { status: 404, headers: corsHeaders });
  // The widget doesn't render on sites the owner hasn't allowed.
  if (live && !isOriginAllowed(request.headers.get("origin"), live.domains, request.headers.get("host"))) {
    return Response.json({ error: "origin_not_allowed" }, { status: 403, headers: corsHeaders });
  }
  return Response.json(config, {
    // Varies by Origin once a domain list exists, so a shared cache must not mix sites.
    headers: { ...corsHeaders, "Cache-Control": "public, max-age=60", Vary: "Origin" },
  });
}

function demoConfig(): WidgetConfig {
  return {
    businessId: DEMO_BUSINESS_ID,
    businessName: demoClinic.name,
    tagline: "AI receptionist · replies instantly",
    greeting:
      "Namaste! 👋 Main Sunrise Family Clinic ki AI receptionist hoon. Fees, timings ya appointment, kuch bhi puchiye.",
    accentColor: demoClinic.accentColor,
    quickReplies: demoQuickReplies,
    consentText: "Chat karke aap clinic ko apna message aur number use karne ki permission dete hain.",
    privacyUrl: "/privacy",
  };
}

async function liveConfig(slug: string): Promise<{ config: WidgetConfig; domains: string[] } | null> {
  if (!isSupabaseConfigured || !process.env.SUPABASE_SERVICE_ROLE_KEY || !/^[a-z0-9-]{1,64}$/.test(slug)) return null;
  const { data: b } = await createServiceClient()
    .from("businesses")
    .select("slug, name, vertical, accent_color, settings")
    .eq("slug", slug)
    .maybeSingle();
  if (!b) return null;
  const config: WidgetConfig = {
    businessId: b.slug,
    businessName: b.name,
    tagline: "AI receptionist · replies instantly",
    greeting: `Namaste! 👋 Main ${b.name} ki AI receptionist hoon. Timings, fees ya appointment, kuch bhi puchiye.`,
    accentColor: b.accent_color,
    quickReplies: QUICK_REPLIES[b.vertical] ?? QUICK_REPLIES.clinic!,
    consentText: "Chat karke aap apna message aur number is business ko use karne ki permission dete hain.",
    privacyUrl: "/privacy",
  };
  return { config, domains: allowedDomains(b.settings) };
}
