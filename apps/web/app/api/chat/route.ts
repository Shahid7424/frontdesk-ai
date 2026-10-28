import { CHAT_LANGUAGES, encodeEvent, type ChatRequest } from "@frontdesk/core";
import { z } from "zod";
import { loadBusinessKnowledge } from "@/lib/agent/knowledge";
import { runLiveChat } from "@/lib/agent/live";
import { isAgentConfigured } from "@/lib/agent/provider";
import { corsHeaders, preflight } from "@/lib/cors";
import { isOriginAllowed } from "@/lib/embed";
import { isSupabaseConfigured } from "@/lib/env";
import { runMockAgent } from "@/lib/mock/agent";
import { DEMO_BUSINESS_ID } from "@/lib/mock/demo-clinic";
import { checkChatLimits, clientIp } from "@/lib/rate-limit";
import { reportError } from "@/lib/monitoring";

export const runtime = "nodejs";
// A reply with a tool call or two streams for a few seconds; leave room for a slow model.
export const maxDuration = 60;

// Validate everything coming from the browser. Limits keep a malicious
// page from sending a 1 MB "message" that we would pay tokens for later.
const bodySchema = z.object({
  businessId: z.string().min(1).max(64),
  conversationId: z.string().max(64).optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(2000),
      }),
    )
    .min(1)
    .max(40),
  action: z
    .object({
      type: z.literal("book_slot"),
      slotId: z.string().max(120),
      customer: z.object({ name: z.string().trim().min(2).max(80), phone: z.string().max(20) }).optional(),
      rescheduleOf: z.string().uuid().optional(),
    })
    .optional(),
  language: z.enum(CHAT_LANGUAGES).optional(),
  bookingIds: z.array(z.string().uuid()).max(10).optional(),
}) satisfies z.ZodType<ChatRequest>;

export const OPTIONS = preflight;

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_request", issues: parsed.error.issues },
      { status: 400, headers: corsHeaders },
    );
  }
  const req = parsed.data;

  // Before any database or LLM work, so a flood costs us almost nothing.
  const limit = await checkChatLimits(clientIp(request), req.businessId);
  if (!limit.ok) {
    console.warn(`[chat] rate limited (${limit.rule}) for ${req.businessId}`);
    return Response.json(
      {
        error: "rate_limited",
        message:
          limit.rule === "businessDay"
            ? "Aaj bahut saare messages aa chuke hain. Kripya business ko seedha call kijiye."
            : "Aap bahut jaldi messages bhej rahe hain. Thodi der baad dobara try kijiye.",
      },
      { status: 429, headers: { ...corsHeaders, "Retry-After": String(limit.retryAfter) } },
    );
  }

  // The demo clinic keeps the scripted mock until an LLM key is added, so
  // the landing page demo works on a fresh clone. Every other business is live.
  const hasDb = isSupabaseConfigured && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const useMock = req.businessId === DEMO_BUSINESS_ID && (!hasDb || !isAgentConfigured());
  const business = useMock || !hasDb ? null : await loadBusinessKnowledge(req.businessId);
  if (!useMock && !business) {
    return Response.json({ error: "unknown_business" }, { status: 404, headers: corsHeaders });
  }
  if (business && !isOriginAllowed(request.headers.get("origin"), business.allowedDomains, request.headers.get("host"))) {
    return Response.json(
      { error: "origin_not_allowed", message: "Ye chat is website par enabled nahi hai." },
      { status: 403, headers: corsHeaders },
    );
  }

  const events = business ? runLiveChat(req, business) : runMockAgent(req);
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await events.next();
        if (done) return controller.close();
        controller.enqueue(encoder.encode(encodeEvent(value)));
      } catch (err) {
        // A DB failure mid-stream still ends the chat bubble cleanly.
        reportError("[chat] stream failed", err);
        controller.enqueue(encoder.encode(encodeEvent({ type: "error", message: "Kuch gadbad ho gayi. Please dobara try kijiye." })));
        controller.enqueue(encoder.encode(encodeEvent({ type: "done" })));
        controller.close();
      }
    },
    cancel() {
      void events.return(undefined);
    },
  });

  return new Response(body, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
      // Lets the eval runner refuse to grade the scripted mock.
      "X-Frontdesk-Mode": business ? "live" : "mock",
    },
  });
}
