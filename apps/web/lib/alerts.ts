import "server-only";
import type { Json } from "@frontdesk/db";
import { slotLabel } from "@frontdesk/core/agent";
import { formatRupees } from "@frontdesk/core";
import { after } from "next/server";
import { reportError } from "@/lib/monitoring";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Email alerts to the clinic owner, so a patient waiting for a human or a
 * new booking isn't missed while nobody is looking at the dashboard.
 *
 * Sent through Resend (RESEND_API_KEY). Without a key the alert is only
 * logged, so development works without an email account. Alerts are sent
 * after the response, and a failure never breaks the chat or a payment.
 */
export type Alert =
  /** The AI handed the chat to the team. */
  | { kind: "handoff"; conversationId: string; summary: string }
  /** The customer wrote again after staff replied. */
  | { kind: "customer_replied"; conversationId: string; message: string }
  | { kind: "booking"; appointmentId: string; paid: boolean }
  | { kind: "cancelled"; appointmentId: string }
  | { kind: "moved"; appointmentId: string; from: string }
  /** A payment or refund needs the team (see flagForTeam). */
  | { kind: "attention"; appointmentId: string; note: string };

export interface AlertSettings {
  /** Where alerts go; empty = the owner's login email. */
  email: string;
  /** New bookings, cancellations and moves. Handoffs and payment problems always alert. */
  bookings: boolean;
}

export function alertSettings(settings: Json | null | undefined): AlertSettings {
  const a = (settings && typeof settings === "object" && !Array.isArray(settings) ? settings.alerts : null) as Partial<AlertSettings> | null;
  return { email: typeof a?.email === "string" ? a.email : "", bookings: a?.bookings !== false };
}

/** Queues an alert to go out after the response is sent. */
export function queueAlert(businessId: string, alert: Alert) {
  after(() => sendAlert(businessId, alert).catch((err) => reportError("[alerts] failed", err)));
}

export async function sendAlert(businessId: string, alert: Alert): Promise<void> {
  const db = createServiceClient();
  const { data: business } = await db.from("businesses").select("name, settings").eq("id", businessId).maybeSingle();
  if (!business) return;
  const prefs = alertSettings(business.settings);
  const bookingKind = alert.kind === "booking" || alert.kind === "cancelled" || alert.kind === "moved";
  if (bookingKind && !prefs.bookings) return;

  const to = prefs.email || (await ownerEmail(businessId));
  if (!to) return;
  const email = await compose(business.name, businessId, alert);
  if (!email) return;
  await deliver({ to, ...email });
}

async function ownerEmail(businessId: string): Promise<string | null> {
  const db = createServiceClient();
  const { data: owner } = await db.from("members").select("user_id").eq("business_id", businessId).eq("role", "owner").limit(1).maybeSingle();
  if (!owner) return null;
  const { data } = await db.auth.admin.getUserById(owner.user_id);
  return data.user?.email ?? null;
}

interface Email {
  subject: string;
  lines: string[];
  link: { label: string; path: string };
}

async function compose(businessName: string, businessId: string, alert: Alert): Promise<Email | null> {
  const db = createServiceClient();

  if (alert.kind === "handoff" || alert.kind === "customer_replied") {
    const { data: c } = await db.from("conversations").select("customers(name, phone)").eq("id", alert.conversationId).eq("business_id", businessId).maybeSingle();
    const who = customerLine((c?.customers as unknown as { name: string | null; phone: string | null } | null) ?? null);
    return alert.kind === "handoff"
      ? {
          subject: `Customer waiting for a reply: ${businessName}`,
          lines: [`A customer on your website chat needs your team.`, `What they need: ${alert.summary}`, who],
          link: { label: "Reply in the inbox", path: "/dashboard/inbox" },
        }
      : {
          subject: `New message in a chat you're handling: ${businessName}`,
          lines: [`The customer replied: "${alert.message.slice(0, 300)}"`, who],
          link: { label: "Open the inbox", path: "/dashboard/inbox" },
        };
  }

  const { data: a } = await db
    .from("appointments")
    .select("starts_at, amount_paise, services(name), staff(name), customers(name, phone)")
    .eq("id", alert.appointmentId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!a) return null;
  const what = `${(a.services as unknown as { name: string } | null)?.name ?? "Appointment"} with ${(a.staff as unknown as { name: string } | null)?.name ?? "your team"}`;
  const when = slotLabel(new Date(a.starts_at));
  const who = customerLine((a.customers as unknown as { name: string | null; phone: string | null } | null) ?? null);
  const bookings = { label: "Open bookings", path: "/dashboard/bookings" };

  switch (alert.kind) {
    case "booking":
      return {
        subject: `New booking: ${when}`,
        lines: [`${what}, ${when}.`, alert.paid ? `Advance paid: ${formatRupees(a.amount_paise)}.` : "No advance taken.", who],
        link: bookings,
      };
    case "cancelled":
      return { subject: `Booking cancelled: ${when}`, lines: [`The customer cancelled ${what}, ${when}, from the chat. The slot is free again.`, who], link: bookings };
    case "moved":
      return { subject: `Booking moved to ${when}`, lines: [`The customer moved ${what} from ${alert.from} to ${when}.`, who], link: bookings };
    case "attention":
      return { subject: `Action needed: ${when}`, lines: [alert.note, `${what}, ${when}.`, who], link: { label: "Open the inbox", path: "/dashboard/inbox" } };
  }
}

function customerLine(c: { name: string | null; phone: string | null } | null): string {
  if (!c || (!c.name && !c.phone)) return "Customer: not shared yet.";
  return `Customer: ${[c.name, c.phone].filter(Boolean).join(", ")}`;
}

const escape = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

async function deliver({ to, subject, lines, link }: Email & { to: string }) {
  const origin = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").trim().replace(/\/$/, "");
  const url = `${origin}${link.path}`;
  const text = [...lines, "", `${link.label}: ${url}`, "", "Swagat AI"].join("\n");
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#0f172a">${lines
    .map((l) => `<p style="margin:0 0 10px">${escape(l)}</p>`)
    .join("")}<p style="margin:18px 0"><a href="${escape(url)}" style="background:#5a2bd4;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:600">${escape(link.label)}</a></p><p style="color:#64748b;font-size:12px">Swagat AI · You get this because you own this business. Change alerts in Settings.</p></div>`;

  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    console.info(`[alerts] RESEND_API_KEY not set, would email ${to}: ${subject}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.ALERTS_FROM?.trim() || "Swagat AI <onboarding@resend.dev>", to: [to], subject, text, html }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Resend refused the alert (${res.status}): ${(await res.text().catch(() => "")).slice(0, 200)}`);
}
