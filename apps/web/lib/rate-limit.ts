import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limits for the public chat API. Every message costs an LLM call, and
 * the widget is public, so a script hammering one business's widget must
 * not burn the free Groq quota (or a client's Claude budget).
 *
 * With UPSTASH_REDIS_REST_URL/TOKEN set, limits are shared across all
 * server instances (needed on Vercel). Without them, an in-memory window
 * per server process, which is fine for local development.
 */
const RULES = {
  /** One visitor (IP): a fast typist sends ~6 a minute; 20 is clearly a script. */
  ipMinute: { limit: 20, window: "1 m" },
  ipDay: { limit: 300, window: "1 d" },
  /** One business: a cost ceiling per day, whatever the number of visitors. */
  businessDay: { limit: Number(process.env.CHAT_DAILY_LIMIT_PER_BUSINESS) || 3000, window: "1 d" },
  /** The widget asks for staff replies every 8 s while open; a few tabs fit easily. */
  pollMinute: { limit: 40, window: "1 m" },
} as const;

type Rule = keyof typeof RULES;
type Duration = `${number} ${"s" | "m" | "h" | "d"}`;

const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
const redis = url && token ? new Redis({ url, token }) : null;

const limiters = redis
  ? Object.fromEntries(
      (Object.keys(RULES) as Rule[]).map((rule) => [
        rule,
        new Ratelimit({
          redis,
          prefix: `fd:rl:${rule}`,
          limiter: Ratelimit.slidingWindow(RULES[rule].limit, RULES[rule].window as Duration),
          // Keeps a hot key in memory between calls, saving Redis round trips under attack.
          ephemeralCache: new Map(),
        }),
      ]),
    )
  : null;

export const rateLimitBackend = redis ? "upstash" : "memory";

export interface LimitResult {
  ok: boolean;
  /** Seconds until the caller may try again. */
  retryAfter: number;
  rule?: Rule;
}

/** Checks every rule; the first one exceeded wins. */
export async function checkChatLimits(ip: string, businessId: string): Promise<LimitResult> {
  const checks: Array<[Rule, string]> = [
    ["ipMinute", ip],
    ["ipDay", ip],
    ["businessDay", businessId],
  ];
  for (const [rule, key] of checks) {
    const r = await hit(rule, key);
    if (!r.ok) return { ...r, rule };
  }
  return { ok: true, retryAfter: 0 };
}

/** For the widget's "any reply from the team?" check, which never reaches the LLM. */
export async function checkPollLimit(ip: string): Promise<LimitResult> {
  const r = await hit("pollMinute", ip);
  return r.ok ? r : { ...r, rule: "pollMinute" };
}

async function hit(rule: Rule, key: string): Promise<LimitResult> {
  if (limiters) {
    try {
      const r = await limiters[rule]!.limit(key);
      return { ok: r.success, retryAfter: Math.max(1, Math.ceil((r.reset - Date.now()) / 1000)) };
    } catch (err) {
      // Redis down: fail open. Losing rate limiting briefly beats losing the chat.
      console.error("[rate-limit] upstash failed, allowing request", (err as Error).message);
      return { ok: true, retryAfter: 0 };
    }
  }
  return memoryHit(rule, key);
}

// --- In-memory fallback: fixed windows, pruned as they expire. ---

const MS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;
const windows = new Map<string, { count: number; resetAt: number }>();

function memoryHit(rule: Rule, key: string): LimitResult {
  const { limit, window } = RULES[rule];
  const [n, unit] = (window as Duration).split(" ") as [string, keyof typeof MS];
  const length = Number(n) * MS[unit];
  const now = Date.now();
  const id = `${rule}:${key}`;

  let w = windows.get(id);
  if (!w || w.resetAt <= now) {
    w = { count: 0, resetAt: now + length };
    windows.set(id, w);
    if (windows.size > 10_000) for (const [k, v] of windows) if (v.resetAt <= now) windows.delete(k);
  }
  w.count++;
  return { ok: w.count <= limit, retryAfter: Math.ceil((w.resetAt - now) / 1000) };
}

/** The visitor's IP. On Vercel the first x-forwarded-for entry is set by the platform. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "local";
}
