import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { ChatEvent } from "@frontdesk/core";
import {
  DEFAULT_GROQ_MODEL,
  DEFAULT_MODEL,
  runAgent,
  runGroqAgent,
  type AgentInput,
  type AgentResult,
} from "@frontdesk/core/agent";
import Groq from "groq-sdk";

/**
 * Which LLM answers customers, chosen by env so a client's budget decides
 * the model, not the code:
 *   LLM_PROVIDER=groq   (default) free open model on Groq, for building and pilots
 *   LLM_PROVIDER=claude Claude Haiku 5.5, for paying clients
 * Both run the same prompt, tools and booking flow and return the same result.
 */
export type Provider = "groq" | "claude";
export const provider: Provider = process.env.LLM_PROVIDER?.trim().toLowerCase() === "claude" ? "claude" : "groq";

// One client per server instance. maxRetries covers brief 429/5xx; the
// timeout keeps a stuck request from holding the widget open forever.
const claude =
  provider === "claude" && process.env.ANTHROPIC_API_KEY ? new Anthropic({ maxRetries: 2, timeout: 60_000 }) : null;
const groq =
  provider === "groq" && process.env.GROQ_API_KEY
    ? new Groq({ apiKey: process.env.GROQ_API_KEY, maxRetries: 2, timeout: 60_000 })
    : null;

export const isAgentConfigured = () => claude !== null || groq !== null;

export function startAgent(input: Omit<AgentInput, "client" | "model">): AsyncGenerator<ChatEvent, AgentResult> {
  if (claude) return runAgent({ ...input, client: claude, model: process.env.FRONTDESK_MODEL || DEFAULT_MODEL });
  if (groq) return runGroqAgent({ ...input, client: groq, model: process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL });
  throw new Error("No LLM provider configured");
}

/** Customer-facing message for a provider error. Details go to the server log. */
export function friendlyError(err: unknown): string {
  if (
    err instanceof Anthropic.RateLimitError ||
    err instanceof Anthropic.InternalServerError ||
    err instanceof Groq.RateLimitError ||
    err instanceof Groq.InternalServerError
  ) {
    return "Abhi bahut log chat kar rahe hain. Ek minute mein dobara try kijiye.";
  }
  if (
    err instanceof Anthropic.AuthenticationError ||
    err instanceof Anthropic.PermissionDeniedError ||
    err instanceof Groq.AuthenticationError ||
    err instanceof Groq.PermissionDeniedError
  ) {
    return "Chat abhi setup ho rahi hai. Team ko message bhej diya gaya hai, woh jald reply karenge.";
  }
  return "Kuch gadbad ho gayi. Team ko bata diya gaya hai, please thodi der baad try kijiye.";
}
