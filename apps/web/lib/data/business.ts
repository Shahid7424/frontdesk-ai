import "server-only";
import type { Tables } from "@frontdesk/db";
import { cache } from "react";
import { alertSettings } from "@/lib/alerts";
import { allowedDomains } from "@/lib/embed";
import { paymentMode } from "@/lib/payments/settings";
import { isSupabaseConfigured } from "@/lib/env";
import { demoClinic, services as demoServices, staff as demoStaff } from "@/lib/mock/demo-clinic";
import { createClient } from "@/lib/supabase/server";

export type Business = Pick<Tables<"businesses">, "id" | "slug" | "name" | "vertical" | "area" | "address" | "phone">;

export type BusinessContext =
  | { mode: "demo"; user: null; business: Business }
  | { mode: "live"; user: { id: string; email: string } | null; business: Business | null };

const DEMO_BUSINESS: Business = {
  id: demoClinic.id,
  slug: demoClinic.id,
  name: demoClinic.name,
  vertical: "clinic",
  area: demoClinic.area,
  address: demoClinic.address,
  phone: demoClinic.phone,
};

/**
 * Who is signed in and which business they belong to. Wrapped in cache()
 * so the layout and the page share one lookup per request.
 */
export const getBusinessContext = cache(async (): Promise<BusinessContext> => {
  if (!isSupabaseConfigured) return { mode: "demo", user: null, business: DEMO_BUSINESS };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { mode: "live", user: null, business: null };

  // No business_id filter needed: RLS only returns businesses this user is a member of.
  const { data: business } = await supabase
    .from("businesses")
    .select("id, slug, name, vertical, area, address, phone")
    .order("created_at")
    .limit(1)
    .maybeSingle();

  return { mode: "live", user: { id: user.id, email: user.email ?? "" }, business };
});

export interface BusinessSetup {
  staff: Array<{ id: string; name: string; title: string | null }>;
  services: Array<{ id: string; name: string; durationMin: number; pricePaise: number; staffIds: string[] }>;
  hours: Array<{ weekday: number; start: string; end: string; staffId: string | null }>;
}

export async function getBusinessSetup(ctx: BusinessContext): Promise<BusinessSetup> {
  if (ctx.mode === "demo") {
    return {
      staff: demoStaff.map((s) => ({ id: s.id, name: s.name, title: s.role })),
      services: demoServices.map((s) => ({ ...s })),
      hours: [
        ...[1, 2, 3, 4, 5, 6].flatMap((weekday) => [
          { weekday, start: "09:00", end: "13:30", staffId: null },
          { weekday, start: "17:00", end: "21:00", staffId: null },
        ]),
        { weekday: 0, start: "10:00", end: "13:00", staffId: "dr-mehta" },
      ],
    };
  }
  if (!ctx.business) return { staff: [], services: [], hours: [] };

  const supabase = await createClient();
  const businessId = ctx.business.id;
  const [staff, services, hours] = await Promise.all([
    supabase.from("staff").select("id, name, title").eq("business_id", businessId).eq("active", true).order("created_at"),
    supabase
      .from("services")
      .select("id, name, duration_min, price_paise, service_staff(staff_id)")
      .eq("business_id", businessId)
      .eq("active", true)
      .order("created_at"),
    supabase
      .from("availability_rules")
      .select("weekday, start_time, end_time, staff_id")
      .eq("business_id", businessId)
      .order("weekday")
      .order("start_time"),
  ]);

  return {
    staff: staff.data ?? [],
    services: (services.data ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      durationMin: s.duration_min,
      pricePaise: s.price_paise,
      staffIds: (s.service_staff as unknown as Array<{ staff_id: string }>).map((x) => x.staff_id),
    })),
    hours: (hours.data ?? []).map((h) => ({
      weekday: h.weekday,
      start: h.start_time.slice(0, 5),
      end: h.end_time.slice(0, 5),
      staffId: h.staff_id,
    })),
  };
}

/** Websites allowed to embed the widget (empty = any). */
export async function getAllowedDomains(ctx: BusinessContext): Promise<string[]> {
  if (ctx.mode === "demo" || !ctx.business) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("businesses").select("settings").eq("id", ctx.business.id).single();
  return allowedDomains(data?.settings);
}

/** Whether bookings need an online advance or are paid at the visit. */
export async function getPaymentMode(ctx: BusinessContext) {
  if (ctx.mode === "demo" || !ctx.business) return paymentMode(null);
  const supabase = await createClient();
  const { data } = await supabase.from("businesses").select("settings").eq("id", ctx.business.id).single();
  return paymentMode(data?.settings);
}

/** Where owner alerts go and which ones are on. */
export async function getAlertSettings(ctx: BusinessContext) {
  if (ctx.mode === "demo" || !ctx.business) return alertSettings(null);
  const supabase = await createClient();
  const { data } = await supabase.from("businesses").select("settings").eq("id", ctx.business.id).single();
  return alertSettings(data?.settings);
}
