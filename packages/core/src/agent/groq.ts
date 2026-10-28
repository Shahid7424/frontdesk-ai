import type Groq from "groq-sdk";
import { CitationFilter } from "../knowledge/citations";
import { LinkFilter } from "./links";
import type { ChatEvent } from "../protocol";
import { citedSources } from "./grounding";
import { executeTool, type ToolContext } from "./execute";
import { emptyUsage } from "./pricing";
import { replyLanguage } from "./language";
import { buildSystemPrompt, buildTurnContext } from "./prompt";
import { MAX_TURNS, turnContext, type AgentInput, type AgentResult } from "./run";
import { buildTools } from "./tools";

/**
 * Open model on Groq's free tier: good enough to build and demo with, at
 * zero cost. Override with GROQ_MODEL; any Groq model with tool use works.
 */
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";

export type GroqAgentInput = Omit<AgentInput, "client"> & { client: Groq };

type ToolCall = { id: string; name: string; arguments: string };

/**
 * Same receptionist as runAgent (same prompt, same tools, same events and
 * result shape), over Groq's OpenAI-style chat completions API. The route
 * doesn't know which provider answered.
 */
export async function* runGroqAgent(input: GroqAgentInput): AsyncGenerator<ChatEvent, AgentResult> {
  const { client, business, now } = input;
  const model = input.model ?? DEFAULT_GROQ_MODEL;

  // Claude tool definitions → OpenAI function format. The JSON schemas are
  // identical, including the service_id enum. `strict` is Claude-specific,
  // so tool arguments are validated in executeTool instead.
  const allTools = buildTools(business);
  const tools: Groq.Chat.ChatCompletionTool[] = (business.services.length ? allTools : allTools.slice(1)).map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description ?? "", parameters: t.input_schema as Record<string, unknown> },
  }));

  const messages: Groq.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: `${buildSystemPrompt(business)}\n\n${turnContext(input)}` },
    ...input.history.filter((m) => m.content.trim()).map((m) => ({ role: m.role, content: m.content })),
  ];

  const ctx: ToolContext = { ...input };
  const result: AgentResult = {
    text: "",
    model,
    citations: [],
    usage: emptyUsage(),
    costUsd: 0, // free tier
    toolCalls: [],
    handoff: null,
    stopReason: null,
  };

  const filter = new CitationFilter();
  const links = new LinkFilter();

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const stream = await client.chat.completions.create({
      model,
      messages,
      tools,
      tool_choice: "auto",
      max_completion_tokens: 2048,
      // A receptionist should give the same answer to the same question; the
      // default (1.0) sometimes answers from a document and sometimes hands off.
      temperature: 0.2,
      stream: true,
      // gpt-oss reasons before answering; receptionist questions need little of it.
      ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" as const } : {}),
    });

    let turnText = "";
    const calls: ToolCall[] = [];
    let finish: string | null = null;

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      const delta = choice?.delta;
      if (delta?.content) {
        let shown = !turnText && result.text ? "\n\n" : "";
        turnText += delta.content;
        shown += links.push(filter.push(delta.content));
        if (shown) {
          result.text += shown;
          yield { type: "text", delta: shown };
        }
      }
      // Tool calls arrive in pieces, keyed by index.
      for (const tc of delta?.tool_calls ?? []) {
        const call = (calls[tc.index] ??= { id: "", name: "", arguments: "" });
        if (tc.id) call.id = tc.id;
        if (tc.function?.name) call.name += tc.function.name;
        if (tc.function?.arguments) call.arguments += tc.function.arguments;
      }
      if (choice?.finish_reason) finish = choice.finish_reason;
      const usage = chunk.x_groq?.usage ?? (chunk as { usage?: Groq.CompletionUsage | null }).usage;
      if (usage) {
        result.usage.input_tokens += usage.prompt_tokens;
        result.usage.output_tokens += usage.completion_tokens;
      }
    }

    const tail = links.push(filter.end()) + links.end();
    if (tail) {
      result.text += tail;
      yield { type: "text", delta: tail };
    }

    result.stopReason = finish;
    if (finish !== "tool_calls" || !calls.length) break;

    messages.push({
      role: "assistant",
      content: turnText || null,
      tool_calls: calls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.arguments } })),
    });

    for (const call of calls) {
      let args: unknown;
      let content: string;
      try {
        args = JSON.parse(call.arguments || "{}");
        result.toolCalls.push({ name: call.name, input: args });
        const out = await executeTool(call.name, args, ctx);
        for (const e of out.events) {
          if (e.type === "handoff") result.handoff = { reason: e.reason, summary: String((args as { summary?: string }).summary ?? "") };
          yield e;
        }
        content = out.content;
      } catch (err) {
        // Open models occasionally send bad JSON or an unknown id; let them retry.
        content = `Error: ${(err as Error).message}`;
      }
      messages.push({ role: "tool", tool_call_id: call.id, content });
    }
  }

  result.citations = citedSources(filter, input.knowledge, result.text);
  if (result.citations.length) yield { type: "citations", items: result.citations };
  return result;
}
