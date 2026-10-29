/**
 * npm run eval -- [--url http://localhost:3000] [--business sunrise-clinic]
 *                 [--only refund,injection] [--repeat 3] [--gap 15]
 *
 * Runs the golden set against a running app (npm run dev) and writes
 * packages/evals/results/latest.md. Exits 1 if any critical case fails or
 * the overall pass rate is under 90%.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CASES, type EvalCase } from "./cases";
import { RateLimited, sendTurn, type Conversation } from "./client";
import { grade, type Reply } from "./grade";

const PASS_RATE = 0.9;
const MAX_ATTEMPTS = 4;

const args = parseArgs(process.argv.slice(2));
const url = args.url ?? "http://localhost:3000";
const businessId = args.business ?? "sunrise-clinic";
const repeat = Math.max(1, Number(args.repeat ?? 1));
// The free Groq tier allows ~8,000 tokens a minute, about 2 messages. A gap
// keeps the run under it instead of failing on 429s. Use --gap 0 on a paid key.
const gapMs = Number(args.gap ?? 15) * 1000;
const only = args.only?.split(",").map((s) => s.trim()).filter(Boolean);

const cases = only?.length ? CASES.filter((c) => only.includes(c.id) || only.includes(c.category)) : CASES;

interface Run {
  passed: boolean;
  fails: string[];
  reply: Reply;
  ms: number;
  firstTextMs: number | null;
}

interface CaseResult {
  c: EvalCase;
  runs: Run[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isProviderBusy = (r: Reply) => Boolean(r.error && /bahut log|try kijiye|rate/i.test(r.error));

async function main() {
  await preflight();
  const total = cases.length * repeat;
  console.log(`\nSwagat AI evals: ${cases.length} cases x ${repeat} against ${url} (business ${businessId})`);
  console.log(`Gap between messages: ${gapMs / 1000}s. Ctrl+C to stop.\n`);

  const results: CaseResult[] = [];
  let done = 0;
  for (const c of cases) {
    const runs: Run[] = [];
    for (let i = 0; i < repeat; i++) {
      const run = await runCase(c);
      runs.push(run);
      done++;
      const mark = run.passed ? "PASS" : "FAIL";
      console.log(`[${String(done).padStart(3)}/${total}] ${mark} ${c.id}${run.passed ? "" : `: ${run.fails.join("; ")}`}`);
    }
    results.push({ c, runs });
  }

  const report = buildReport(results);
  const dir = join(import.meta.dirname, "..", "results");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  writeFileSync(join(dir, "latest.md"), report.markdown);
  writeFileSync(join(dir, `${stamp}.md`), report.markdown);
  console.log(`\n${report.summary}\nReport: packages/evals/results/latest.md\n`);
  process.exit(report.ok ? 0 : 1);
}

async function runCase(c: EvalCase): Promise<Run> {
  for (let attempt = 1; ; attempt++) {
    const convo: Conversation = { url, businessId, messages: [], lastSlots: [] };
    let last: Awaited<ReturnType<typeof sendTurn>> | null = null;
    let ms = 0;
    try {
      for (const turn of c.turns) {
        if (last) await sleep(gapMs);
        last = await sendTurn(convo, turn);
        ms += last.ms;
        // A failed earlier turn (e.g. no slots to tap) is graded as is.
        if (last.reply.error) break;
      }
    } catch (err) {
      if (err instanceof RateLimited && attempt < MAX_ATTEMPTS) {
        console.log(`      app rate limit, waiting ${err.retryAfter}s...`);
        await sleep(err.retryAfter * 1000);
        continue;
      }
      const reply: Reply = { text: "", slots: 0, payment: false, handoff: null, citations: [], error: (err as Error).message };
      await sleep(gapMs);
      return { passed: false, fails: [`error: ${(err as Error).message}`], reply, ms, firstTextMs: null };
    }
    const reply = last!.reply;
    // The model provider was over its limit: not the agent's fault, so wait and run the case again.
    if (isProviderBusy(reply) && attempt < MAX_ATTEMPTS) {
      console.log("      model provider busy (free tier limit?), waiting 60s...");
      await sleep(60_000);
      continue;
    }
    const fails = grade(reply, c.expect);
    await sleep(gapMs);
    return { passed: fails.length === 0, fails, reply, ms, firstTextMs: last!.firstTextMs };
  }
}

/** Fails fast with a clear message instead of a page of identical failures. */
async function preflight() {
  let res: Response;
  try {
    res = await fetch(new URL("/api/chat", url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, messages: [{ role: "user", content: "Namaste" }] }),
    });
  } catch {
    fail(`App ${url} par nahi mila. Pehle doosre terminal mein "npm run dev" chalao.`);
  }
  if (res.status === 404) fail(`Business "${businessId}" nahi mila. Demo clinic ke liye seed.sql aur seed-knowledge.sql Supabase mein chalao.`);
  if (res.headers.get("x-frontdesk-mode") === "mock") {
    fail("App mock mode mein hai (LLM key ya Supabase keys missing). apps/web/.env.local mein GROQ_API_KEY aur Supabase keys daalo, phir dev server restart karo.");
  }
  await res.text();
  await sleep(gapMs);
}

function fail(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(2);
}

function buildReport(results: CaseResult[]) {
  const runs = results.flatMap((r) => r.runs);
  const passedCases = results.filter((r) => r.runs.every((x) => x.passed));
  const flaky = results.filter((r) => r.runs.some((x) => x.passed) && r.runs.some((x) => !x.passed));
  const criticalFailed = results.filter((r) => r.c.critical && r.runs.some((x) => !x.passed));
  const rate = passedCases.length / results.length;
  const ok = criticalFailed.length === 0 && rate >= PASS_RATE;

  const latencies = runs.map((r) => r.ms).sort((a, b) => a - b);
  const firsts = runs.flatMap((r) => (r.firstTextMs === null ? [] : [r.firstTextMs])).sort((a, b) => a - b);
  const pct = (xs: number[], p: number) => (xs.length ? `${(xs[Math.min(xs.length - 1, Math.floor(xs.length * p))]! / 1000).toFixed(1)}s` : "-");

  const categories = [...new Set(results.map((r) => r.c.category))];
  const rows = categories.map((cat) => {
    const inCat = results.filter((r) => r.c.category === cat);
    const p = inCat.filter((r) => r.runs.every((x) => x.passed)).length;
    return `| ${cat} | ${p}/${inCat.length} |`;
  });

  const summary = [
    `Score: ${passedCases.length}/${results.length} cases passed (${Math.round(rate * 100)}%)${repeat > 1 ? `, every run of ${repeat}` : ""}`,
    `Critical failures: ${criticalFailed.length}${criticalFailed.length ? ` (${criticalFailed.map((r) => r.c.id).join(", ")})` : ""}`,
    `Latency p50 ${pct(latencies, 0.5)}, p95 ${pct(latencies, 0.95)}; first text p50 ${pct(firsts, 0.5)}`,
    ok ? "RESULT: PASS" : `RESULT: FAIL (needs 0 critical failures and ${PASS_RATE * 100}%+)`,
  ].join("\n");

  const failures = results
    .filter((r) => r.runs.some((x) => !x.passed))
    .map((r) => {
      const lastTurn = r.c.turns.at(-1);
      const asked = typeof lastTurn === "string" ? lastTurn : "(tapped a slot)";
      const detail = r.runs
        .filter((x) => !x.passed)
        .map((x) => `- ${x.fails.join("; ")}\n  - reply: ${JSON.stringify(x.reply.text.slice(0, 400))}${x.reply.handoff ? ` [handoff ${x.reply.handoff}]` : ""}${x.reply.slots ? ` [${x.reply.slots} slots]` : ""}`)
        .join("\n");
      return `### ${r.c.id}${r.c.critical ? " (critical)" : ""}\nCustomer: ${asked}\n${detail}`;
    });

  const markdown = `# Swagat AI eval report

${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST · ${url} · business \`${businessId}\` · ${repeat} run(s) per case

\`\`\`
${summary}
\`\`\`

| Category | Passed |
|---|---|
${rows.join("\n")}

${flaky.length ? `**Inconsistent** (passed some runs, failed others): ${flaky.map((r) => r.c.id).join(", ")}\n\n` : ""}## Failures

${failures.join("\n\n") || "None."}
`;
  return { ok, summary, markdown };
}

function parseArgs(argv: string[]): Record<string, string | undefined> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith("--")) continue;
    const [key, inline] = a.slice(2).split("=", 2) as [string, string | undefined];
    out[key] = inline ?? argv[++i] ?? "";
  }
  return out;
}

void main();
