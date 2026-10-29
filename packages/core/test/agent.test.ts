import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import type { ChatEvent } from "../src";
import { buildSystemPrompt, runAgent } from "../src/agent";
import { clinic } from "./fixtures";

type Turn = { text?: string; toolUse?: { name: string; input: unknown }; usage?: Partial<Anthropic.Usage> };

/** A stand-in for client.messages.stream that replays scripted turns and records requests. */
function fakeClient(turns: Turn[]) {
  const requests: Anthropic.MessageStreamParams[] = [];
  const client = {
    messages: {
      stream(params: Anthropic.MessageStreamParams) {
        requests.push(structuredClone(params));
        const turn = turns.shift()!;
        const content: Anthropic.ContentBlock[] = [];
        if (turn.text) content.push({ type: "text", text: turn.text, citations: null } as Anthropic.TextBlock);
        if (turn.toolUse) content.push({ type: "tool_use", id: `tu_${requests.length}`, ...turn.toolUse } as Anthropic.ToolUseBlock);
        const events = (turn.text ?? "").split(" ").map((w, i) => ({
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: (i ? " " : "") + w },
        }));
        return {
          async *[Symbol.asyncIterator]() {
            if (turn.text) yield* events;
          },
          finalMessage: async () => ({
            content,
            stop_reason: turn.toolUse ? "tool_use" : "end_turn",
            usage: { input_tokens: 100, output_tokens: 20, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, ...turn.usage },
          }),
        };
      },
    },
  } as unknown as Anthropic;
  return { client, requests };
}

async function collect(gen: AsyncGenerator<ChatEvent, unknown>) {
  const events: ChatEvent[] = [];
  let next = await gen.next();
  while (!next.done) {
    events.push(next.value);
    next = await gen.next();
  }
  return { events, result: next.value as Awaited<ReturnType<typeof runAgent>> extends AsyncGenerator<unknown, infer R> ? R : never };
}

const base = { business: clinic, now: new Date("2026-11-02T08:00:00+05:30"), getBusy: async () => [] };

describe("runAgent", () => {
  it("streams text and reports usage and cost", async () => {
    const { client } = fakeClient([{ text: "General consultation ₹500 hai.", usage: { input_tokens: 2000, output_tokens: 40, cache_read_input_tokens: 1000 } }]);
    const { events, result } = await collect(
      runAgent({ ...base, client, history: [{ role: "user", content: "Fees kitni hai?" }] }) as never,
    );
    expect(events.filter((e) => e.type === "text").map((e) => (e as { delta: string }).delta).join("")).toBe(
      "General consultation ₹500 hai.",
    );
    expect(result.usage).toMatchObject({ input_tokens: 2000, output_tokens: 40, cache_read_input_tokens: 1000 });
    // 2000*0.1 + 1000*0.01 + 40*0.5 per million
    expect(result.costUsd).toBeCloseTo(0.00023, 6);
  });

  it("runs check_availability, emits slots, and sends the tool result back", async () => {
    const { client, requests } = fakeClient([
      { toolUse: { name: "check_availability", input: { service_id: "chest", date: "2026-11-02" } } },
      { text: "Ye slots khaali hain, ek tap kijiye." },
    ]);
    const { events, result } = await collect(
      runAgent({ ...base, client, history: [{ role: "user", content: "Aaj Dr. Kulkarni milenge?" }] }) as never,
    );
    const slots = events.find((e) => e.type === "slots");
    expect(slots && slots.type === "slots" && slots.items.length).toBe(6);
    expect(result.toolCalls).toHaveLength(1);
    const second = requests[1]!.messages.at(-1)!;
    expect(Array.isArray(second.content) && second.content[0]).toMatchObject({ type: "tool_result", tool_use_id: "tu_1" });
  });

  it("marks a handoff", async () => {
    const { client } = fakeClient([
      { toolUse: { name: "handoff_to_human", input: { reason: "complaint", summary: "Long wait last visit" } } },
      { text: "Team jaldi reply karegi." },
    ]);
    const { events, result } = await collect(
      runAgent({ ...base, client, history: [{ role: "user", content: "Bahut wait karna pada" }] }) as never,
    );
    expect(events).toContainEqual({ type: "handoff", reason: "complaint" });
    expect(result.handoff).toEqual({ reason: "complaint", summary: "Long wait last visit" });
  });

  it("caches the business prompt and keeps the time outside the cached block", async () => {
    const { client, requests } = fakeClient([{ text: "Hi" }]);
    await collect(runAgent({ ...base, client, history: [{ role: "user", content: "hi" }] }) as never);
    const system = requests[0]!.system as Anthropic.TextBlockParam[];
    expect(system[0]!.cache_control).toEqual({ type: "ephemeral" });
    expect(system[0]!.text).not.toMatch(/2026/);
    expect(system[1]!.text).toMatch(/2026-11-02/);
    expect(buildSystemPrompt(clinic)).toBe(buildSystemPrompt(structuredClone(clinic)));
  });

  it("states the payment policy so 'advance or after?' needs no handoff", () => {
    expect(buildSystemPrompt({ ...clinic, paymentPolicy: "advance_online" })).toMatch(/Payment:\nPaid services: the full price is paid online in advance/);
    expect(buildSystemPrompt({ ...clinic, paymentPolicy: "pay_at_visit" })).toMatch(/Payment:\nNo advance payment\. .*at or after the appointment/);
    expect(buildSystemPrompt(clinic)).toMatch(/Payment:\nNot provided\./);
  });

  it("keeps clinic-only rules out of other businesses", () => {
    const agency = { ...clinic, vertical: "other" as const, name: "Digital Marketing" };
    expect(buildSystemPrompt(agency)).not.toMatch(/doctor|diagnos|medicine|108|clinic/i);
    expect(buildSystemPrompt(clinic)).toMatch(/diagnose/);
  });

  it("merges consecutive same-role messages and drops a leading assistant turn", async () => {
    const { client, requests } = fakeClient([{ text: "ok" }]);
    await collect(
      runAgent({
        ...base,
        client,
        history: [
          { role: "assistant", content: "Namaste!" },
          { role: "user", content: "hi" },
          { role: "user", content: "fees?" },
        ],
      }) as never,
    );
    expect(requests[0]!.messages).toEqual([{ role: "user", content: "hi\n\nfees?" }]);
  });
});
