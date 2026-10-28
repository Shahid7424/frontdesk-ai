import { describe, expect, it } from "vitest";
import type { ChatEvent } from "../src";
import { runGroqAgent } from "../src/agent";
import { buildSystemPrompt, buildTurnContext } from "../src/agent/prompt";
import {
  CitationFilter,
  chunkPages,
  geminiEmbedder,
  quickAnswerChunk,
  retrievalQuery,
  searchTerms,
  stripCitations,
  type KnowledgeHit,
} from "../src/knowledge";
import { clinic } from "./fixtures";

describe("chunkPages", () => {
  it("keeps short documents in one chunk", () => {
    const chunks = chunkPages(["Fees: ₹500.\n\nTimings: 9 to 1."]);
    expect(chunks).toEqual([{ index: 0, content: "Fees: ₹500.\nTimings: 9 to 1.", page: null }]);
  });

  it("splits long text near the size limit, on paragraph boundaries, with a sentence of overlap", () => {
    const para = (n: number) => `Topic ${n} heading. ${"Some detail about this topic. ".repeat(8).trim()} Last line of ${n}.`;
    const chunks = chunkPages([[1, 2, 3, 4, 5].map(para).join("\n\n")], { maxChars: 600 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.content.length).toBeLessThanOrEqual(600);
    // The next chunk starts with the last sentence of the previous one.
    expect(chunks[1]!.content.startsWith(chunks[0]!.content.split(/(?<=\.)\s/).at(-1)!)).toBe(true);
    expect(chunks.map((c) => c.index)).toEqual(chunks.map((_, i) => i));
  });

  it("records the page a chunk starts on and skips empty pages", () => {
    const chunks = chunkPages(["Rate card. Consultation ₹500.", "   ", "Physiotherapy ₹700 per session."], {
      paged: true,
      maxChars: 40,
    });
    expect(chunks.map((c) => c.page)).toEqual([1, 3]);
  });

  it("hard-splits a giant sentence with no punctuation", () => {
    const chunks = chunkPages([Array.from({ length: 400 }, (_, i) => `word${i}`).join(" ")], { maxChars: 300 });
    expect(chunks.every((c) => c.content.length <= 300)).toBe(true);
    expect(chunks.map((c) => c.content).join(" ")).toContain("word399");
  });

  it("joins PDF lines and hyphenated words", () => {
    const [c] = chunkPages(["Follow-up within seven days is com-\nplimentary for all\npatients."]);
    expect(c!.content).toBe("Follow-up within seven days is complimentary for all patients.");
  });

  it("makes a titled single chunk from a quick answer", () => {
    expect(quickAnswerChunk(" Parking ", "Two-wheeler parking\nin front.")).toEqual({
      index: 0,
      content: "Parking: Two-wheeler parking in front.",
      page: null,
    });
  });
});

describe("searchTerms", () => {
  it("drops Hinglish filler and adds synonyms", () => {
    expect(searchTerms("Consultation fees kitni hai?")).toEqual(["consultation", "fees", "fee", "charge", "price", "cost", "rate"]);
    expect(searchTerms("parking hai kya")).toEqual(["parking", "park"]);
  });

  it("keeps Devanagari words", () => {
    expect(searchTerms("फीस कितनी है")).toContain("फीस");
  });

  it("returns nothing for pure small talk", () => {
    expect(searchTerms("hi ji namaste")).toEqual([]);
  });

  it("joins a short follow-up to the question before it", () => {
    expect(retrievalQuery(["Clinic timings kya hain?", "aur sunday?"])).toBe("Clinic timings kya hain? aur sunday?");
    expect(retrievalQuery(["Timings?", "PFT report kitni der mein milti hai"])).toBe("PFT report kitni der mein milti hai");
  });
});

describe("CitationFilter", () => {
  const run = (deltas: string[]) => {
    const f = new CitationFilter();
    const text = deltas.map((d) => f.push(d)).join("") + f.end();
    return { text, cited: [...f.cited] };
  };

  it("removes markers and the space before them", () => {
    expect(run(["Fees ₹500 hai [1]. Follow-up free hai [1, 3]."])).toEqual({
      text: "Fees ₹500 hai. Follow-up free hai.",
      cited: [1, 3],
    });
  });

  it("handles a marker split across deltas, character by character", () => {
    const input = "Reports 30 minute mein milte hain [2].";
    expect(run(input.split(""))).toEqual({ text: "Reports 30 minute mein milte hain.", cited: [2] });
  });

  it("understands the 【1†source】 style open models use", () => {
    expect(run(["Parking basement mein hai【3†L1-L2】."])).toEqual({ text: "Parking basement mein hai.", cited: [3] });
  });

  it("leaves real brackets alone", () => {
    expect(run(["Timings [Mon-Sat] 9 to 1, [", "note] closed Sunday"]).text).toBe("Timings [Mon-Sat] 9 to 1, [note] closed Sunday");
    expect(stripCitations("Chest [x-ray]").text).toBe("Chest [x-ray]");
  });

  it("keeps whitespace between words and paragraphs", () => {
    expect(run(["Haan ", "ji.", "\n\n", "Aur kuch?"]).text).toBe("Haan ji.\n\nAur kuch?");
  });
});

describe("geminiEmbedder", () => {
  it("batches requests, sets task type and dimensions, and normalises vectors", async () => {
    const calls: Array<{ url: string; body: { requests: Array<{ taskType: string; outputDimensionality: number }> } }> = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      calls.push({ url, body });
      return new Response(JSON.stringify({ embeddings: body.requests.map(() => ({ values: [3, 4] })) }));
    }) as typeof fetch;
    const embedder = geminiEmbedder({ apiKey: "k", fetch: fakeFetch });
    const vectors = await embedder.embed(Array.from({ length: 150 }, (_, i) => `t${i}`), "query");
    expect(calls).toHaveLength(2);
    expect(calls[0]!.url).toContain("gemini-embedding-001:batchEmbedContents");
    expect(calls[0]!.body.requests[0]).toMatchObject({ taskType: "RETRIEVAL_QUERY", outputDimensionality: 768 });
    expect(vectors).toHaveLength(150);
    expect(vectors[0]).toEqual([0.6, 0.8]);
  });

  it("marks rate limits as retryable and bad keys as not", async () => {
    const status = (code: number) => (async () => new Response("nope", { status: code })) as unknown as typeof fetch;
    await expect(geminiEmbedder({ apiKey: "k", fetch: status(429) }).embed(["a"], "document")).rejects.toMatchObject({ retryable: true });
    await expect(geminiEmbedder({ apiKey: "k", fetch: status(400) }).embed(["a"], "document")).rejects.toMatchObject({ retryable: false });
  });
});

const hits: KnowledgeHit[] = [
  { id: "11", source: "Clinic FAQ", page: null, content: "Reports: PFT reports are ready in 30 minutes." },
  { id: "12", source: "Rate card.pdf", page: 2, content: "Parking: two-wheelers in front, cars in the basement." },
];

describe("grounded answers", () => {
  it("keeps the knowledge out of the cached system prompt", () => {
    const system = buildSystemPrompt(clinic);
    expect(system).not.toContain("PFT reports");
    const turn = buildTurnContext({ now: new Date(), language: "hinglish", handedOff: false, knowledge: hits });
    expect(turn).toContain("[2] (Rate card.pdf, page 2)");
    expect(buildTurnContext({ now: new Date(), language: "hinglish", handedOff: false, knowledge: [] })).toContain("No document matched");
  });

  it("streams clean text and emits only the cited sources", async () => {
    const { client } = fakeGroq("Car parking basement mein hai [2].");
    const events: ChatEvent[] = [];
    const gen = runGroqAgent({
      client,
      business: clinic,
      now: new Date(),
      getBusy: async () => [],
      history: [{ role: "user", content: "Parking hai?" }],
      knowledge: hits,
    });
    let next = await gen.next();
    while (!next.done) {
      events.push(next.value);
      next = await gen.next();
    }
    expect(events.map((e) => (e.type === "text" ? e.delta : "")).join("")).toBe("Car parking basement mein hai.");
    expect(next.value.text).toBe("Car parking basement mein hai.");
    expect(events.find((e) => e.type === "citations")).toEqual({
      type: "citations",
      items: [{ id: "12", title: "Rate card.pdf · p. 2", snippet: "Parking: two-wheelers in front, cars in the basement." }],
    });
  });

  it("ignores citation numbers that don't exist", async () => {
    const { client } = fakeGroq("Haan ji [7].");
    const gen = runGroqAgent({ client, business: clinic, now: new Date(), getBusy: async () => [], history: [{ role: "user", content: "?" }], knowledge: hits });
    let next = await gen.next();
    while (!next.done) next = await gen.next();
    expect(next.value.citations).toEqual([]);
  });
});

/** One-turn Groq stand-in that streams the text a few characters at a time. */
function fakeGroq(text: string) {
  const client = {
    chat: {
      completions: {
        async create() {
          const chunks: unknown[] = (text.match(/.{1,3}/gs) ?? []).map((c) => ({ choices: [{ index: 0, delta: { content: c } }] }));
          chunks.push({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] });
          return {
            async *[Symbol.asyncIterator]() {
              yield* chunks;
            },
          };
        },
      },
    },
  } as unknown as Parameters<typeof runGroqAgent>[0]["client"];
  return { client };
}

describe("citations without markers (open models)", () => {
  const sources: KnowledgeHit[] = [
    { id: "1", source: "clinic-guide.pdf", page: 1, content: "Parking: Two-wheeler parking is available in front. Car parking is in the basement, free for 2 hours." },
    {
      id: "2",
      source: "clinic-guide.pdf",
      page: 2,
      content:
        "Cancellation policy: You can cancel or reschedule free of charge up to 2 hours before your appointment. Advance payments are refunded to the original payment method within 5 to 7 working days.",
    },
  ];
  const run = async (text: string) => {
    const { client } = fakeGroq(text);
    const gen = runGroqAgent({ client, business: clinic, now: new Date(), getBusy: async () => [], history: [{ role: "user", content: "?" }], knowledge: sources });
    let next = await gen.next();
    while (!next.done) next = await gen.next();
    return next.value.citations.map((c) => c.title);
  };

  it("credits the source the answer clearly used", async () => {
    expect(
      await run(
        "Ji, aapko cancellation ke 2 ghante pehle tak free mein cancel karne par advance payment wapas mil jaata hai, jo 5-7 kaam ke dinon mein original method se refund ho jaata hai.",
      ),
    ).toEqual(["clinic-guide.pdf · p. 2"]);
  });

  it("credits nothing for a don't-know answer", async () => {
    expect(await run("Iske liye humein team se confirm karna padega, aapke query ko forward kar diya hai.")).toEqual([]);
  });

  it("prefers the model's own markers when it gives them", async () => {
    expect(await run("Basement mein car parking hai [1].")).toEqual(["clinic-guide.pdf · p. 1"]);
  });
});
