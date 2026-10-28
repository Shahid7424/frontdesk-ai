import { corsHeaders, preflight } from "@/lib/cors";
import { isSupabaseConfigured } from "@/lib/env";
import { checkPollLimit, clientIp } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const OPTIONS = preflight;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Replies the business's staff typed in the inbox, and notices like
 * "payment received", for the widget to show.
 * The conversation id is a random UUID only that browser knows, and it must
 * belong to the business named, so nobody can read another chat.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const slug = params.get("businessId") ?? "";
  const conversationId = params.get("conversationId") ?? "";
  const empty = () => Response.json({ messages: [] }, { headers: { ...corsHeaders, "Cache-Control": "no-store" } });

  if (!isSupabaseConfigured || !process.env.SUPABASE_SERVICE_ROLE_KEY) return empty();
  if (!/^[a-z0-9-]{1,64}$/.test(slug) || !UUID.test(conversationId)) {
    return Response.json({ error: "invalid_request" }, { status: 400, headers: corsHeaders });
  }
  const limit = await checkPollLimit(clientIp(request));
  if (!limit.ok) {
    return Response.json({ error: "rate_limited" }, { status: 429, headers: { ...corsHeaders, "Retry-After": String(limit.retryAfter) } });
  }

  const db = createServiceClient();
  const { data: business } = await db.from("businesses").select("id").eq("slug", slug).maybeSingle();
  if (!business) return empty();
  const { data } = await db
    .from("messages")
    .select("id, role, content, created_at")
    .eq("business_id", business.id)
    .eq("conversation_id", conversationId)
    .or("role.eq.owner,metadata->>notice.eq.true")
    .order("created_at")
    .limit(50);

  return Response.json(
    { messages: (data ?? []).map((m) => ({ id: m.id, from: m.role === "owner" ? "team" : "system", content: m.content, at: m.created_at })) },
    { headers: { ...corsHeaders, "Cache-Control": "no-store" } },
  );
}
