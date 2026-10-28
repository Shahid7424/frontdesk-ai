import type Groq from "groq-sdk";
import { describe, expect, it } from "vitest";
import type { ChatEvent } from "../src";
import { runGroqAgent } from "../src/agent";
import { clinic } from "./fixtures";

type Sent = { messages: Groq.Chat.ChatCompletionMessageParam[]; tools?: Groq.Chat.ChatCompletionTool[] };
type Turn = { text?: string; toolCall?: { name: string; arguments: string } };

/** Replays scripted turns as Groq streaming chunks (tool arguments split in two) and records requests. */
function fakeGroq(turns: Turn[]) {
  const requests: Sent[] = [];
  const client = {
    chat: {
      completions: {
        async create(params: Sent) {
          requests.push(structuredClone(params));
          const turn = turns.shift()!;
          const chunks: unknown[] = [];
          for (const w of (turn.text ?? "").split(/(?= )/).filter(Boolean)) chunks.push({ choices: [{ index: 0, delta: { content: w } }] });
          if (turn.toolCall) {
            const { name, arguments: args } = turn.toolCall;
            const half = Math.floor(args.length / 2);
            chunks.push({ choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: `call_${requests.length}`, function: { name, arguments: args.slice(0, half) } }] } }] });
            chunks.push({ choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: args.slice(half) } }] } }] });
          }
          chunks.push({
            choices: [{ index: 0, delta: {}, finish_reason: turn.toolCall ? "tool_calls" : "stop" }],
            x_groq: { id: "req", usage: { prompt_tokens: 1500, completion_tokens: 30, total_tokens: 1530 } },
          });
          return {
            async *[Symbol.asyncIterator]() {
              yield* chunks;
            },
          };
        },
      },
    },
  } as unknown as Groq;
  return { client, requests };
}

async function collect(gen: ReturnType<typeof runGroqAgent>) {
  const events: ChatEvent[] = [];
  let next = await gen.next();
  while (!next.done) {
    events.push(next.value);
    next = await gen.next();
  }
  return { events, result: next.value };
}

const base = { business: clinic, now: new Date("2026-11-02T08:00:00+05:30"), getBusy: async () => [] };
const textOf = (events: ChatEvent[]) => events.map((e) => (e.type === "text" ? e.delta : "")).join("");

describe("runGroqAgent", () => {
  it("streams text with usage and zero cost", async () => {
    const { client, requests } = fakeGroq([{ text: "Clinic 9 se 8 baje tak khula hai." }]);
    const { events, result } = await collect(runGroqAgent({ ...base, client, history: [{ role: "user", content: "Timings?" }] }));
    expect(textOf(events)).toBe("Clinic 9 se 8 baje tak khula hai.");
    expect(result).toMatchObject({ model: "openai/gpt-oss-120b", costUsd: 0, usage: { input_tokens: 1500, output_tokens: 30 } });
    expect(requests[0]!.messages[0]).toMatchObject({ role: "system" });
    expect(requests[0]!.tools?.map((t) => t.function?.name)).toEqual(["check_availability", "show_booking", "cancel_booking", "reschedule_booking", "handoff_to_human"]);
  });

  it("joins streamed tool arguments, emits slots and sends a tool message back", async () => {
    const { client, requests } = fakeGroq([
      { toolCall: { name: "check_availability", arguments: JSON.stringify({ service_id: "chest", date: "2026-11-02" }) } },
      { text: "Ye slots khaali hain." },
    ]);
    const { events, result } = await collect(runGroqAgent({ ...base, client, history: [{ role: "user", content: "Aaj slot?" }] }));
    const slots = events.find((e) => e.type === "slots");
    expect(slots?.type === "slots" && slots.items.length).toBe(6);
    expect(result.toolCalls).toEqual([{ name: "check_availability", input: { service_id: "chest", date: "2026-11-02" } }]);
    const sent = requests[1]!.messages;
    expect(sent.at(-2)).toMatchObject({ role: "assistant", tool_calls: [{ id: "call_1" }] });
    expect(sent.at(-1)).toMatchObject({ role: "tool", tool_call_id: "call_1" });
  });

  it("turns bad tool arguments into an error result instead of crashing", async () => {
    const { client, requests } = fakeGroq([
      { toolCall: { name: "check_availability", arguments: '{"service_id":"botox","date":"2026-11-02"}' } },
      { text: "Ye service available nahi hai." },
    ]);
    const { result } = await collect(runGroqAgent({ ...base, client, history: [{ role: "user", content: "Botox?" }] }));
    expect(result.text).toBe("Ye service available nahi hai.");
    expect(requests[1]!.messages.at(-1)).toMatchObject({ role: "tool", content: expect.stringContaining("Error") });
  });

  it("maps an unknown handoff reason to other", async () => {
    const { client } = fakeGroq([
      { toolCall: { name: "handoff_to_human", arguments: '{"reason":"angry","summary":"Refund chahiye"}' } },
      { text: "Team se baat karwa rahi hoon." },
    ]);
    const { events, result } = await collect(runGroqAgent({ ...base, client, history: [{ role: "user", content: "Refund do" }] }));
    expect(events).toContainEqual({ type: "handoff", reason: "other" });
    expect(result.handoff).toEqual({ reason: "other", summary: "Refund chahiye" });
  });
});

describe("date handling", () => {
  it("books the day the customer said earlier, even if the model sends today", async () => {
    // Mon 26 Oct: "Kal appointment chahiye" → "Which service?" → "general" → model passes today's date.
    const { client } = fakeGroq([
      { toolCall: { name: "check_availability", arguments: JSON.stringify({ service_id: "gp", date: "2026-11-02" }) } },
      { text: "Kal ke slots neeche hain." },
    ]);
    const { events } = await collect(
      runGroqAgent({
        ...base,
        client,
        history: [
          { role: "user", content: "Kal appointment chahiye" },
          { role: "assistant", content: "Kaun si service?" },
          { role: "user", content: "general" },
        ],
      }),
    );
    const slots = events.find((e) => e.type === "slots");
    expect(slots?.type === "slots" && slots.items.every((s) => s.label.startsWith("Tue, 3 Nov"))).toBe(true);
  });

  it("lets the model resolve words like 'tomorrow' itself", async () => {
    const { client } = fakeGroq([
      { toolCall: { name: "check_availability", arguments: JSON.stringify({ service_id: "gp", date: "tomorrow" }) } },
      { text: "Ye slots hain." },
    ]);
    const { events } = await collect(runGroqAgent({ ...base, client, history: [{ role: "user", content: "next available?" }] }));
    const slots = events.find((e) => e.type === "slots");
    expect(slots?.type === "slots" && slots.items[0]!.label).toMatch(/^Tue, 3 Nov/);
  });
});

describe("handoff and booking follow-ups", () => {
  it("hands off only once per conversation", async () => {
    const { client, requests } = fakeGroq([
      { toolCall: { name: "handoff_to_human", arguments: '{"reason":"unknown_answer","summary":"Degree"}' } },
      { text: "" },
    ]);
    const { events, result } = await collect(
      runGroqAgent({ ...base, client, handedOff: true, history: [{ role: "user", content: "payment link do" }] }),
    );
    expect(events.some((e) => e.type === "handoff")).toBe(false);
    expect(result.handoff).toBeNull();
    expect(requests[0]!.messages[0]!.content).toContain("Staff were already notified");
  });

  it("show_booking re-sends the payment card", async () => {
    const payment = { bookingId: "a1", url: "/pay/a1?amount=50000", amountInPaise: 50000, expiresInMinutes: 10 };
    const { client, requests } = fakeGroq([{ toolCall: { name: "show_booking", arguments: "{}" } }, { text: "Ye raha payment link." }]);
    const { events } = await collect(
      runGroqAgent({
        ...base,
        client,
        history: [{ role: "user", content: "payment link do" }],
        getBooking: async () => ({ status: "pending_payment", bookingId: "a1", serviceId: "svc", label: "Mon, 2 Nov, 8:45 pm", serviceName: "General consultation", staffName: "Dr. Mehta", payment, reheld: true }),
      }),
    );
    expect(events).toContainEqual({ type: "payment_link", link: payment });
    expect(requests[1]!.messages.at(-1)).toMatchObject({ role: "tool", content: expect.stringContaining("renewed") });
  });

  it("never shows a link the model made up next to the payment card", async () => {
    const payment = { bookingId: "a1", url: "/pay/a1?amount=50000", amountInPaise: 50000, expiresInMinutes: 10 };
    const { client } = fakeGroq([
      { toolCall: { name: "show_booking", arguments: "{}" } },
      { text: "Here is your payment link: https://payment.link/xyz123\n\nPlease complete the payment to confirm your appointment." },
    ]);
    const { events, result } = await collect(
      runGroqAgent({
        ...base,
        client,
        history: [{ role: "user", content: "payment link do" }],
        getBooking: async () => ({ status: "pending_payment", bookingId: "a1", serviceId: "svc", label: "Mon, 2 Nov, 8:45 pm", serviceName: "General consultation", staffName: "Dr. Mehta", payment, reheld: false }),
      }),
    );
    expect(textOf(events)).toBe("Here is your payment link: \n\nPlease complete the payment to confirm your appointment.");
    expect(result.text).not.toMatch(/http|payment\.link/);
    expect(events).toContainEqual({ type: "payment_link", link: payment });
  });
});

describe("cancel and reschedule", () => {
  const booked = {
    status: "confirmed" as const,
    bookingId: "b1",
    serviceId: clinic.services[0]!.id,
    label: "Tue, 3 Nov, 10:00 am",
    serviceName: clinic.services[0]!.name,
    staffName: "Dr. Mehta",
  };

  it("asks first, and cancels only when the customer confirmed", async () => {
    let cancelled = 0;
    const cancelBooking = async () => {
      cancelled++;
      return { status: "cancelled" as const, label: booked.label, serviceName: booked.serviceName, staffName: booked.staffName, paid: false };
    };
    const ask = fakeGroq([{ toolCall: { name: "cancel_booking", arguments: JSON.stringify({ customer_confirmed: false }) } }, { text: "Tue 10 am wali booking cancel karun?" }]);
    await collect(runGroqAgent({ ...base, client: ask.client, history: [{ role: "user", content: "booking cancel karo" }], findBooking: async () => booked, cancelBooking }));
    expect(cancelled).toBe(0);
    expect(ask.requests[1]!.messages.at(-1)).toMatchObject({ role: "tool", content: expect.stringContaining("ask them to confirm") });

    const yes = fakeGroq([{ toolCall: { name: "cancel_booking", arguments: JSON.stringify({ customer_confirmed: true }) } }, { text: "Cancel ho gayi." }]);
    await collect(runGroqAgent({ ...base, client: yes.client, history: [{ role: "user", content: "haan" }], findBooking: async () => booked, cancelBooking }));
    expect(cancelled).toBe(1);
    expect(yes.requests[1]!.messages.at(-1)).toMatchObject({ role: "tool", content: expect.stringContaining("\"status\":\"cancelled\"") });
  });

  it("sends a booking it can't find to the team", async () => {
    const { client, requests } = fakeGroq([{ toolCall: { name: "cancel_booking", arguments: JSON.stringify({ customer_confirmed: true }) } }, { text: "ok" }]);
    await collect(runGroqAgent({ ...base, client, history: [{ role: "user", content: "kal wali booking cancel" }], findBooking: async () => ({ status: "none" }) }));
    expect(requests[1]!.messages.at(-1)).toMatchObject({ role: "tool", content: expect.stringContaining("handoff_to_human") });
  });

  it("offers new slots for the same service, marked to move the booking", async () => {
    const { client } = fakeGroq([{ toolCall: { name: "reschedule_booking", arguments: JSON.stringify({ date: "tomorrow" }) } }, { text: "Naya time tap kijiye." }]);
    const { events } = await collect(runGroqAgent({ ...base, client, history: [{ role: "user", content: "kal ka time kar do" }], findBooking: async () => booked }));
    const slots = events.find((e) => e.type === "slots");
    expect(slots && slots.type === "slots" && slots.items.length).toBeGreaterThan(0);
    expect(slots && slots.type === "slots" && slots.items.every((s) => s.rescheduleOf === "b1" && s.serviceId === booked.serviceId)).toBe(true);
  });
});

describe("reply language", () => {
  const systemOf = async (history: { role: "user" | "assistant"; content: string }[], language?: "auto" | "en" | "hinglish" | "hi") => {
    const { client, requests } = fakeGroq([{ text: "ok" }]);
    await collect(runGroqAgent({ ...base, client, history, language }));
    return String(requests[0]!.messages[0]!.content);
  };

  it("keeps Hinglish when the customer just says okay", async () => {
    expect(await systemOf([{ role: "user", content: "Kal appointment chahiye" }, { role: "assistant", content: "Ji" }, { role: "user", content: "okay" }])).toContain("Reply in Hinglish");
  });
  it("detects English and Devanagari", async () => {
    expect(await systemOf([{ role: "user", content: "What are your timings on Saturday?" }])).toContain("Reply in simple English");
    expect(await systemOf([{ role: "user", content: "कल डॉक्टर मिलेंगे?" }])).toContain("Devanagari");
  });
  it("uses the language picked in the widget", async () => {
    expect(await systemOf([{ role: "user", content: "Kal appointment chahiye" }], "en")).toContain("Reply in simple English");
  });
});

describe("reply language edge cases", () => {
  const lang = async (history: { role: "user" | "assistant"; content: string }[]) => {
    const { client, requests } = fakeGroq([{ text: "ok" }]);
    await collect(runGroqAgent({ ...base, client, history }));
    return String(requests[0]!.messages[0]!.content);
  };
  it.each(["payment link do", "abhi share karo", "okay", "2 Nov"])("keeps Hinglish for %s", async (text) => {
    expect(await lang([{ role: "user", content: "Kal appointment chahiye" }, { role: "assistant", content: "Ji" }, { role: "user", content: text }])).toContain(
      "Reply in Hinglish",
    );
  });
  it("switches to English when the customer does", async () => {
    expect(await lang([{ role: "user", content: "Kal appointment chahiye" }, { role: "assistant", content: "Ji" }, { role: "user", content: "Do you have parking?" }])).toContain(
      "Reply in simple English",
    );
  });
});
