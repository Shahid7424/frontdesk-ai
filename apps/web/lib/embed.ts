import type { Json } from "@frontdesk/db";

/**
 * Which websites may embed a business's widget. Owners list their domains
 * in Channels; an empty list means "any site" (the default, so a new
 * business works immediately). This stops someone from copying the script
 * tag onto their own site and spending the business's chat quota.
 *
 * It's a browser-level guard: the Origin header can be faked from a
 * script, which is why rate limits exist too.
 */
export function allowedDomains(settings: Json | null | undefined): string[] {
  const list = settings && typeof settings === "object" && !Array.isArray(settings) ? settings.allowed_domains : null;
  return Array.isArray(list) ? list.filter((d): d is string => typeof d === "string") : [];
}

/** Normalises what an owner types ("https://www.Clinic.in/contact") to a bare host ("clinic.in"). */
export function normalizeDomain(input: string): string | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;
  try {
    const host = new URL(raw.includes("://") ? raw : `https://${raw}`).hostname.replace(/^www\./, "");
    return /^(localhost|[a-z0-9-]+(\.[a-z0-9-]+)+)$/.test(host) ? host : null;
  } catch {
    return null;
  }
}

/**
 * True when a request from this Origin may use the widget. Our own app
 * (dashboard tester, /try, /demo) is always allowed, and so are requests
 * without an Origin (not from a browser page; rate limits cover those).
 * A domain also allows its subdomains: "clinic.in" allows "book.clinic.in".
 */
export function isOriginAllowed(origin: string | null, domains: string[], ownHost: string | null): boolean {
  if (!domains.length || !origin) return true;
  let host: string;
  try {
    host = new URL(origin).hostname.toLowerCase();
  } catch {
    return false; // "null" origin (file://, sandboxed iframes) when a list is set
  }
  if (ownHost && host === ownHost.split(":")[0]) return true;
  const bare = host.replace(/^www\./, "");
  return domains.some((d) => bare === d || bare.endsWith(`.${d}`));
}
