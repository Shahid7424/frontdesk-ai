import Anthropic from "@anthropic-ai/sdk";
import { CitationFilter } from "../knowledge/citations";
import { LinkFilter } from "./links";
import type { KnowledgeHit } from "../knowledge/types";
import type { ChatEvent, ChatLanguage, ChatMessage, Citation } from "../protocol";
import { citedSources } from "./grounding";
import { addUsage, costUsd, emptyUsage, type Usage } from "./pricing";
import { replyLanguage } from "./language";
import { buildSystemPrompt, buildTurnContext } from "./prompt";
import { executeTool, type ToolContext } from "./execute";
import { buildTools } from "./tools";
import type { BookingLookup, BusinessKnowledge, BusyInterval, CancelOutcome } from "./types";

export const DEFAULT_MODEL = "claude-haiku-5-5";

/** Model round trips per customer message. Two tool calls plus an answer is the normal worst case. */
export const MAX_TURNS = 4;

export interface AgentInput {
  client: Anthropic;
  business: BusinessKnowledge;
  /** Plain-text history, oldest first. The last message is the customer's. */
  history: ChatMessage[];
  now: Date;
  /** Live appointments for these staff in [from, to). Injected so the agent stays DB-free. */
  getBusy: (staffIds: string[], from: string, to: string) => Promise<BusyInterval[]>;
  model?: string;
  /** Widget language choice; "auto" (default) mirrors the customer. */
  language?: ChatLanguage;
  /** Staff were already notified in this conversation. */
  handedOff?: boolean;
  getBooking?: () => Promise<BookingLookup>;
  findBooking?: () => Promise<BookingLookup>;
  cancelBooking?: () => Promise<CancelOutcome>;
  /** Knowledge-base search results for this message, numbered [1..n] in the prompt. */
  knowledge?: KnowledgeHit[];
}

export interface AgentResult {
  /** The reply as the customer saw it, citation markers removed. */
  text: string;
  /** Sources the reply cited. */
  citations: Citation[];
  model: string;
  usage: Usage;
  costUsd: number;
  toolCalls: Array<{ name: string; input: unknown }>;
  handoff: { reason: string; summary: string } | null;
  stopReason: string | null;
}

/**
 * Runs the receptionist for one customer message and streams ChatEvents
 * (text deltas, slots, handoff) as they happen. The generator's return
 * value has the full text, token usage and cost for persistence/tracing.
 *
 * Only the final text of each turn is stored, so earlier turns come back as
 * plain text and no thinking blocks are ever replayed across requests.
 */
export async function* runAgent(input: AgentInput): AsyncGenerator<ChatEvent, AgentResult> {
  const { client, business, now } = input;
  const model = input.model ?? DEFAULT_MODEL;
  const tools = business.services.length ? buildTools(business) : buildTools(business).slice(1);

  const system: Anthropic.TextBlockParam[] = [
    // Stable per business, so tools + this block are served from cache after the first message.
    { type: "text", text: buildSystemPrompt(business), cache_control: { type: "ephemeral" } },
    // Changes every request, so it sits after the cache breakpoint.
    { type: "text", text: turnContext(input) },
  ];

  const messages = toMessageParams(input.history);
  const ctx: ToolContext = { ...input };
  const result: AgentResult = {
    text: "",
    model,
    citations: [],
    usage: emptyUsage(),
    costUsd: 0,
    toolCalls: [],
    handoff: null,
    stopReason: null,
  };
  const filter = new CitationFilter();
  const links = new LinkFilter();

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const stream = client.messages.stream({
      model,
      max_tokens: 2048, // thinking counts toward this; replies themselves are short
      // Receptionist answers are simple lookups, so low effort keeps latency
      // and cost down. Adaptive thinking still kicks in when it's needed.
      output_config: { effort: "low" },
      system,
      tools,
      tool_choice: { type: "auto" },
      messages,
    });

    let turnHasText = false;
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        // Separate text from different turns ("Ek second..." then the answer).
        let delta = !turnHasText && result.text ? "\n\n" : "";
        turnHasText = true;
        delta += links.push(filter.push(event.delta.text));
        if (delta) {
          result.text += delta;
          yield { type: "text", delta };
        }
      }
    }
    const tail = links.push(filter.end()) + links.end();
    if (tail) {
      result.text += tail;
      yield { type: "text", delta: tail };
    }

    const message = await stream.finalMessage();
    result.usage = addUsage(result.usage, message.usage);
    result.stopReason = message.stop_reason;

    if (message.stop_reason === "refusal") {
      const fallback = "Maaf kijiye, main is sawaal mein madad nahi kar sakti. Kya main aapki baat team se karwa doon?";
      result.text += (result.text ? "\n\n" : "") + fallback;
      yield { type: "text", delta: fallback };
      break;
    }
    if (message.stop_reason !== "tool_use") break;

    // Thinking and tool_use blocks go back unchanged within this request's loop.
    messages.push({ role: "assistant", content: message.content });
    const results: Anthropic.ToolResultBlockParam[] = [];

    for (const block of message.content) {
      if (block.type !== "tool_use") continue;
      result.toolCalls.push({ name: block.name, input: block.input });
      try {
        const { content, events } = await executeTool(block.name, block.input, ctx);
        for (const e of events) {
          if (e.type === "handoff") result.handoff = { reason: e.reason, summary: String((block.input as { summary?: string }).summary ?? "") };
          yield e;
        }
        results.push({ type: "tool_result", tool_use_id: block.id, content });
      } catch (err) {
        results.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: `Error: ${(err as Error).message}`,
          is_error: true,
        });
      }
    }
    // All results for one assistant turn go back in a single user message.
    messages.push({ role: "user", content: results });
  }

  result.citations = citedSources(filter, input.knowledge, result.text);
  if (result.citations.length) yield { type: "citations", items: result.citations };
  result.costUsd = costUsd(model, result.usage);
  return result;
}

/** Per-message context shared by both providers. */
export function turnContext(input: AgentInput | Omit<AgentInput, "client">): string {
  return buildTurnContext({
    now: input.now,
    language: replyLanguage(input.history, input.language),
    handedOff: Boolean(input.handedOff),
    knowledge: input.knowledge,
  });
}

/** The API needs alternating roles starting with the user. */
export function toMessageParams(history: ChatMessage[]): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = [];
  for (const m of history) {
    if (!m.content.trim()) continue;
    const last = out.at(-1);
    if (last && last.role === m.role) last.content = `${last.content as string}\n\n${m.content}`;
    else if (out.length || m.role === "user") out.push({ role: m.role, content: m.content });
  }
  return out;
}
