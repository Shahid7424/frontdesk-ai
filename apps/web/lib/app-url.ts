import "server-only";
import { headers } from "next/headers";

/**
 * The public origin of this app, for the embed snippet. NEXT_PUBLIC_APP_URL
 * wins (set it on Vercel to your real domain); otherwise it's taken from
 * the request, so local development shows http://localhost:3000.
 */
export async function appOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
