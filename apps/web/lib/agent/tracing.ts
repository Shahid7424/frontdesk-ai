import "server-only";
import type { AgentResult } from "@frontdesk/core/agent";
import { Langfuse } from "langfuse";

/**
 * Langfuse tracing, on only when its keys are set. One trace per customer
 * message, grouped into a Langfuse session per conversation, with token
 * usage and the cost we computed (Langfuse may not know new model prices).
 */
const langfuse =
  process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY
    ? new Langfuse({
        publicKey: process.env.LANGFUSE_PUBLIC_KEY,
        secretKey: process.env.LANGFUSE_SECRET_KEY,
        baseUrl: process.env.LANGFUSE_BASEURL ?? "https://cloud.langfuse.com",
      })
    : null;

export async function traceChat(input: {
  businessSlug: string;
  conversationId: string;
  question: string;
  startedAt: Date;
  result: AgentResult;
}) {
  if (!langfuse) return;
  const { result } = input;
  const trace = langfuse.trace({
    name: "chat",
    sessionId: input.conversationId,
    tags: [input.businessSlug, "web"],
    input: input.question,
    output: result.text,
    metadata: { handoff: result.handoff, toolCalls: result.toolCalls },
  });
  trace.generation({
    name: "receptionist",
    model: result.model,
    startTime: input.startedAt,
    endTime: new Date(),
    input: input.question,
    output: result.text,
    usageDetails: {
      input: result.usage.input_tokens,
      output: result.usage.output_tokens,
      cache_read_input_tokens: result.usage.cache_read_input_tokens,
      cache_creation_input_tokens: result.usage.cache_creation_input_tokens,
    },
    costDetails: { total: result.costUsd },
    metadata: { stopReason: result.stopReason },
  });
  await langfuse.flushAsync();
}
