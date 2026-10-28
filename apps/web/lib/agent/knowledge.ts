import "server-only";
import type { BusinessKnowledge, BusyInterval } from "@frontdesk/core/agent";
import { allowedDomains } from "@/lib/embed";
import { paymentMode } from "@/lib/payments/settings";
import type { PaymentMode } from "./booking";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Loads everything the agent needs about one business. Uses the service
 * role because widget visitors have no Supabase session; every query is
 * scoped by the business id resolved from the public slug.
 */
export async function loadBusinessKnowledge(
  slug: string,
): Promise<(BusinessKnowledge & { aiEnabled: boolean; allowedDomains: string[]; paymentMode: PaymentMode }) | null> {
  const db = createServiceClient();
  const { data: b } = await db
    .from("businesses")
    .select("id, slug, name, vertical, area, address, phone, ai_enabled, settings")
    .eq("slug", slug)
    .maybeSingle();
  if (!b) return null;

  const [staff, services, hours] = await Promise.all([
    db.from("staff").select("id, name, title").eq("business_id", b.id).eq("active", true).order("created_at"),
    db
      .from("services")
      .select("id, name, duration_min, price_paise, service_staff(staff_id)")
      .eq("business_id", b.id)
      .eq("active", true)
      .order("created_at"),
    db.from("availability_rules").select("weekday, start_time, end_time, staff_id").eq("business_id", b.id).order("weekday").order("start_time"),
  ]);
  // Documents aren't loaded here: each message searches them (lib/knowledge/search.ts).

  return {
    id: b.id,
    slug: b.slug,
    name: b.name,
    vertical: b.vertical,
    area: b.area,
    address: b.address,
    phone: b.phone,
    aiEnabled: b.ai_enabled,
    allowedDomains: allowedDomains(b.settings),
    paymentMode: paymentMode(b.settings),
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

/** Live appointments: confirmed, or awaiting payment with an unexpired hold. */
export async function getBusy(businessId: string, staffIds: string[], from: string, to: string): Promise<BusyInterval[]> {
  if (!staffIds.length) return [];
  const db = createServiceClient();
  const { data, error } = await db
    .from("appointments")
    .select("staff_id, starts_at, ends_at, status, hold_expires_at")
    .eq("business_id", businessId)
    .in("staff_id", staffIds)
    .in("status", ["confirmed", "pending_payment"])
    .lt("starts_at", to)
    .gt("ends_at", from);
  if (error) throw new Error(`Could not read appointments: ${error.message}`);
  const now = Date.now();
  return (data ?? [])
    .filter((a) => a.status === "confirmed" || !a.hold_expires_at || new Date(a.hold_expires_at).getTime() > now)
    .map((a) => ({ staffId: a.staff_id, startsAt: a.starts_at, endsAt: a.ends_at }));
}
