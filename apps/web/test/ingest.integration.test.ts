/**
 * Ingestion and search, end to end against a real Postgres with the real
 * migrations: ingestDocument() → chunks rows (with vectors) → status
 * flips → searchKnowledge() through search_chunks().
 *
 * Supabase's REST layer isn't available here, so the Supabase client is
 * replaced by a small stand-in that turns the exact query chains our code
 * uses into SQL (and RPC calls into named-argument SQL calls, the way
 * PostgREST does, so a renamed parameter fails this test).
 *
 * Needs DATABASE_URL like packages/db's tests; skipped without it.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { normalize, type Embedder } from "@frontdesk/core/knowledge";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { makePdf } from "./make-pdf";

const ADMIN_URL = process.env.DATABASE_URL;
const dbRoot = join(import.meta.dirname, "../../../packages/db");
const dbName = `fd_ingest_${Date.now()}`;
let admin: pg.Client;
let db: pg.Client;
const files = new Map<string, Uint8Array>();

/** Bag-of-words vectors: texts sharing words point the same way. Enough to test the plumbing. */
const fakeEmbedder: Embedder = {
  model: "fake-embedding",
  async embed(texts) {
    return texts.map((t) => {
      const v = Array.from({ length: 768 }, () => 0.001);
      for (const w of t.toLowerCase().match(/[a-z]+/g) ?? []) {
        let h = 0;
        for (const c of w) h = (h * 31 + c.charCodeAt(0)) % 768;
        v[h]! += 1;
      }
      return normalize(v);
    });
  },
};

vi.mock("@/lib/knowledge/embedder", () => ({ embedder: fakeEmbedder }));
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: () => fakeSupabase() }));

type Filter = [column: string, value: unknown];

function fakeSupabase() {
  const table = (name: string) => {
    let op: "select" | "insert" | "update" | "delete" = "select";
    let cols = "*";
    let payload: Record<string, unknown> | Record<string, unknown>[] = {};
    let single = false;
    const filters: Filter[] = [];

    const run = async () => {
      const params: unknown[] = [];
      const p = (v: unknown) => (params.push(v), `$${params.length}`);
      const where = filters.length ? ` where ${filters.map(([c, v]) => `${c} = ${p(v)}`).join(" and ")}` : "";
      let sql: string;
      if (op === "select") sql = `select ${cols} from public.${name}${where}`;
      else if (op === "delete") sql = `delete from public.${name}${where}`;
      else if (op === "update") {
        const sets = Object.entries(payload).map(([k, v]) => `${k} = ${p(v)}`);
        sql = `update public.${name} set ${sets.join(", ")}${where}`;
      } else {
        const rows = Array.isArray(payload) ? payload : [payload];
        const keys = Object.keys(rows[0]!);
        sql = `insert into public.${name} (${keys.join(", ")}) values ${rows.map((r) => `(${keys.map((k) => p(r[k])).join(", ")})`).join(", ")}`;
      }
      try {
        const { rows } = await db.query(sql, params);
        return { data: single ? (rows[0] ?? null) : rows, error: null };
      } catch (err) {
        return { data: null, error: { message: (err as Error).message } };
      }
    };

    const q = {
      select: (c = "*") => ((cols = c), q),
      insert: (v: typeof payload) => ((op = "insert"), (payload = v), q),
      update: (v: Record<string, unknown>) => ((op = "update"), (payload = v), q),
      delete: () => ((op = "delete"), q),
      eq: (c: string, v: unknown) => (filters.push([c, v]), q),
      maybeSingle: () => ((single = true), q),
      then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) => run().then(resolve, reject),
    };
    return q;
  };

  return {
    from: table,
    async rpc(fn: string, args: Record<string, unknown>) {
      // PostgREST calls functions with named arguments, exactly like this.
      const keys = Object.keys(args);
      const sql = `select * from public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}${k === "p_embedding" ? "::extensions.vector" : ""}`).join(", ")})`;
      try {
        return { data: (await db.query(sql, keys.map((k) => args[k]))).rows, error: null };
      } catch (err) {
        return { data: null, error: { message: (err as Error).message } };
      }
    },
    storage: {
      from: () => ({
        async download(path: string) {
          const f = files.get(path);
          return f ? { data: new Blob([f as Uint8Array<ArrayBuffer>]), error: null } : { data: null, error: { message: "Object not found" } };
        },
      }),
    },
  };
}

const BIZ = "00000000-0000-4000-a000-000000000001"; // the seeded demo clinic

async function addDoc(fields: Record<string, unknown>): Promise<string> {
  const keys = Object.keys(fields);
  const { rows } = await db.query(
    `insert into public.documents (business_id, ${keys.join(", ")}) values ($1, ${keys.map((_, i) => `$${i + 2}`).join(", ")}) returning id`,
    [BIZ, ...keys.map((k) => fields[k])],
  );
  return rows[0].id;
}

describe.skipIf(!ADMIN_URL)("ingestion and search (Postgres)", () => {
  beforeAll(async () => {
    admin = new pg.Client({ connectionString: ADMIN_URL });
    await admin.connect();
    await admin.query(`create database ${dbName}`);
    const url = new URL(ADMIN_URL!);
    url.pathname = `/${dbName}`;
    db = new pg.Client({ connectionString: url.toString() });
    await db.connect();
    const migrations = readdirSync(join(dbRoot, "supabase/migrations")).sort();
    for (const f of ["test/supabase-shim.sql", ...migrations.map((m) => `supabase/migrations/${m}`), "supabase/seed.sql", "supabase/seed-knowledge.sql"]) {
      await db.query(readFileSync(join(dbRoot, f), "utf8"));
    }
  });

  afterAll(async () => {
    await db?.end();
    await admin?.query(`drop database if exists ${dbName} with (force)`);
    await admin?.end();
  });

  it("learns a quick answer: one chunk with a vector, document ready", async () => {
    const { ingestDocument } = await import("@/lib/knowledge/ingest");
    const id = await addDoc({ name: "Wheelchair access", kind: "text", content: "Wheelchair ramp at the side gate, lift to the 2nd floor." });
    expect(await ingestDocument(BIZ, id)).toEqual({ chunks: 1, embedded: true });

    const doc = (await db.query("select status, chunk_count, embedding_model, attempts, error from public.documents where id = $1", [id])).rows[0];
    expect(doc).toEqual({ status: "ready", chunk_count: 1, embedding_model: "fake-embedding", attempts: 1, error: null });
    const chunk = (await db.query("select content, embedding is not null as has_vector from public.chunks where document_id = $1", [id])).rows[0];
    expect(chunk).toEqual({ content: "Wheelchair access: Wheelchair ramp at the side gate, lift to the 2nd floor.", has_vector: true });
  });

  it("learns a PDF with page numbers, and re-indexing replaces chunks instead of adding", async () => {
    const { ingestDocument, storagePath } = await import("@/lib/knowledge/ingest");
    const id = await addDoc({ name: "Monsoon notice.pdf", kind: "pdf" });
    const path = storagePath(BIZ, id);
    await db.query("update public.documents set storage_path = $1 where id = $2", [path, id]);
    files.set(path, makePdf([["Monsoon timings: the evening OPD closes at 8 pm in July."], ["Nebulizer sessions need no appointment."]]));

    expect((await ingestDocument(BIZ, id)).chunks).toBe(2);
    expect((await ingestDocument(BIZ, id)).chunks).toBe(2);
    const { rows } = await db.query("select page from public.chunks where document_id = $1 order by chunk_index", [id]);
    expect(rows.map((r) => r.page)).toEqual([1, 2]);
  });

  it("finds new knowledge through search_chunks, with the PDF page for the citation", async () => {
    const { searchKnowledge } = await import("@/lib/knowledge/search");
    const hits = await searchKnowledge(BIZ, ["Nebulizer ke liye appointment chahiye?"]);
    expect(hits[0]).toMatchObject({ source: "Monsoon notice.pdf", page: 2, content: expect.stringContaining("Nebulizer") });

    const wheelchair = await searchKnowledge(BIZ, ["wheelchair le ke aa sakte hain?"]);
    expect(wheelchair[0]?.source).toBe("Wheelchair access");
  });

  it("marks a scanned PDF as failed with a reason the owner can act on", async () => {
    const { ingestDocument, markFailed, storagePath } = await import("@/lib/knowledge/ingest");
    const id = await addDoc({ name: "Scan.pdf", kind: "pdf" });
    const path = storagePath(BIZ, id);
    await db.query("update public.documents set storage_path = $1 where id = $2", [path, id]);
    files.set(path, makePdf([[""]]));

    const err = await ingestDocument(BIZ, id).catch((e: unknown) => e);
    expect((err as Error).name).toBe("PermanentIngestError");
    await markFailed(BIZ, id, err);
    const doc = (await db.query("select status, error from public.documents where id = $1", [id])).rows[0];
    expect(doc.status).toBe("failed");
    expect(doc.error).toMatch(/looks scanned/);
  });
});
