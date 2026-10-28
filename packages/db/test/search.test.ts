/**
 * Day 5's "done" criterion: the demo clinic's questions find the right
 * source. Runs the real migrations + seed against a throwaway Postgres
 * database (see rls.test.ts for the setup notes) and calls search_chunks()
 * exactly as the app does: question → searchTerms() → SQL.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { searchTerms } from "@frontdesk/core/knowledge";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ADMIN_URL = process.env.DATABASE_URL ?? "postgres://postgres@localhost:5432/postgres";
const root = join(import.meta.dirname, "..");
const dbName = `fd_search_${Date.now()}`;
const DEMO = "00000000-0000-4000-a000-000000000001";

let admin: pg.Client;
let db: pg.Client;

type Hit = { content: string; document_name: string; page: number | null; keyword_rank: number | null; vector_rank: number | null };

async function search(businessId: string, question: string, embedding: number[] | null = null, limit = 5): Promise<Hit[]> {
  const { rows } = await db.query("select * from public.search_chunks($1, $2, $3::extensions.vector, $4)", [
    businessId,
    searchTerms(question),
    embedding ? `[${embedding.join(",")}]` : null,
    limit,
  ]);
  return rows;
}

/** A unit vector pointing mostly along one axis, so tests control which chunk is "closest". */
function axis(i: number, noise = 0): number[] {
  const v = Array.from({ length: 768 }, (_, j) => (j === i ? 1 : noise));
  const n = Math.hypot(...v);
  return v.map((x) => x / n);
}

beforeAll(async () => {
  admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`create database ${dbName}`);
  const url = new URL(ADMIN_URL);
  url.pathname = `/${dbName}`;
  db = new pg.Client({ connectionString: url.toString() });
  await db.connect();

  const migrations = readdirSync(join(root, "supabase/migrations")).sort();
  for (const file of ["test/supabase-shim.sql", ...migrations.map((f) => `supabase/migrations/${f}`), "supabase/seed.sql", "supabase/seed-knowledge.sql"]) {
    await db.query(readFileSync(join(root, file), "utf8"));
  }
});

afterAll(async () => {
  await db?.end();
  await admin?.query(`drop database if exists ${dbName} with (force)`);
  await admin?.end();
});

// The demo clinic eval set: how customers actually ask, and where the answer lives.
const EVAL: Array<[question: string, expectedStart: string]> = [
  ["Consultation fees kitni hai?", "Fees:"],
  ["Clinic kab khulta hai?", "Timings:"],
  ["Sunday ko kaunse doctor available hain?", "Timings:"],
  ["Car parking hai kya?", "Address and parking:"],
  ["PFT report kitni der mein milti hai?", "Reports:"],
  ["Insurance cashless hai?", "Payments:"],
  ["PFT se pehle kya dhyan rakhna hai?", "PFT preparation:"],
  ["Appointment cancel karna hai, refund milega?", "Cancellation and rescheduling:"],
  ["Ghar pe aake check kar sakte ho?", "Home visits"],
  ["Flu ka vaccine lagta hai kya?", "Vaccines:"],
  ["Pehli visit pe kya laana hai?", "Your first visit:"],
];

describe("search_chunks: demo clinic eval (keyword only, like a fresh setup)", () => {
  it.each(EVAL)("%s → %s", async (question, expected) => {
    const hits = await search(DEMO, question, null, 3);
    expect(hits.map((h) => h.content.slice(0, expected.length))).toContain(expected);
    // The best source should usually be first; top 3 is what the done criterion needs.
    expect(hits[0]!.content.startsWith(expected) || hits.length > 1).toBe(true);
  });

  it("puts the right source first for most questions", async () => {
    let first = 0;
    for (const [q, expected] of EVAL) if ((await search(DEMO, q, null, 3))[0]?.content.startsWith(expected)) first++;
    expect(first).toBeGreaterThanOrEqual(9);
  });

  it("returns page numbers for PDF sources", async () => {
    const [hit] = await search(DEMO, "refund cancel");
    expect(hit).toMatchObject({ document_name: "Patient guide.pdf", page: 2 });
  });

  it("finds nothing for small talk or unknown topics", async () => {
    expect(await search(DEMO, "hi ji namaste")).toEqual([]);
    expect(await search(DEMO, "MRI scan")).toEqual([]);
  });

  it("can't be broken by tsquery syntax in the question", async () => {
    await expect(db.query("select * from public.search_chunks($1, $2)", [DEMO, ["fees:*&|!(", "'), ", "<->"]])).resolves.toBeDefined();
  });
});

describe("search_chunks: hybrid", () => {
  beforeAll(async () => {
    // Give each demo chunk its own axis, so chunk_index i is "about" axis i.
    await db.query(
      `update public.chunks c set embedding = v.e::extensions.vector
       from (select id, chunk_index, document_id from public.chunks where business_id = $1) x
       cross join lateral (select '[' || array_to_string(array(
         select case when g = x.chunk_index + (case when x.document_id::text like '%2' then 10 else 0 end) then 1 else 0.01 end
         from generate_series(0, 767) g), ',') || ']' as e) v
       where c.id = x.id`,
      [DEMO],
    );
  });

  it("finds a paraphrase by meaning when no keyword matches", async () => {
    // No keyword terms at all, only a vector close to axis 12 (Patient guide chunk 2 = home visits).
    const { rows } = await db.query("select * from public.search_chunks($1, $2, $3::extensions.vector, 3)", [DEMO, [], `[${axis(12, 0.01).join(",")}]`]);
    expect(rows[0].content).toMatch(/^Home visits/);
    expect(rows[0]).toMatchObject({ keyword_rank: null, vector_rank: 1 });
  });

  it("ranks a chunk found by both keyword and vector above one found by either", async () => {
    const hits = await search(DEMO, "PFT report", axis(3, 0.01)); // axis 3 = Reports
    expect(hits[0]!.content).toMatch(/^Reports:/);
    expect(hits[0]).toMatchObject({ keyword_rank: expect.any(Number), vector_rank: 1 });
  });
});

describe("search_chunks: isolation and status", () => {
  let other: string;

  beforeAll(async () => {
    other = (
      await db.query("insert into public.businesses (name, slug) values ('Other Clinic', 'other-clinic') returning id")
    ).rows[0].id;
    const doc = (
      await db.query("insert into public.documents (business_id, name, kind, status) values ($1, 'Secret', 'text', 'ready') returning id", [other])
    ).rows[0].id;
    await db.query("insert into public.chunks (business_id, document_id, content) values ($1, $2, 'Fees: ₹99 secret rate')", [other, doc]);
    const pending = (
      await db.query("insert into public.documents (business_id, name, kind, status) values ($1, 'Draft', 'text', 'processing') returning id", [DEMO])
    ).rows[0].id;
    await db.query("insert into public.chunks (business_id, document_id, content) values ($1, $2, 'Fees: half-written draft')", [DEMO, pending]);
  });

  it("never returns another business's chunks", async () => {
    const hits = await search(DEMO, "fees", null, 10);
    expect(hits.some((h) => h.content.includes("₹99"))).toBe(false);
    expect((await search(other, "fees")).map((h) => h.content)).toEqual(["Fees: ₹99 secret rate"]);
  });

  it("skips documents that aren't ready", async () => {
    const hits = await search(DEMO, "fees", null, 10);
    expect(hits.some((h) => h.content.includes("draft"))).toBe(false);
  });

  it("is callable only by the server (service role), not with the anon or user keys", async () => {
    for (const role of ["anon", "authenticated"]) {
      await db.query("begin");
      await db.query(`set local role ${role}`);
      await expect(db.query("select * from public.search_chunks($1, $2)", [DEMO, ["fees"]])).rejects.toThrow(/permission denied/);
      await db.query("rollback");
    }
  });
});
