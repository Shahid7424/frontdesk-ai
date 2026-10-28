/**
 * A stand-in for the Supabase client over a real Postgres connection, for
 * end-to-end tests without Supabase's REST server.
 *
 * It turns the query chains the app uses into SQL the way PostgREST does:
 * embedded resources ("customers(name, phone)") become correlated
 * subqueries through the foreign-key column, ".single()" fails unless
 * exactly one row comes back, Postgres error codes (23P01 for a double
 * booking) come back on `error.code`, and timestamps come back as ISO
 * strings. A user client runs every statement as `authenticated` with the
 * user's id in the JWT claim, so RLS applies exactly as in Supabase.
 *
 * It is not PostgREST: syntax PostgREST would reject could still pass here.
 */
import pg from "pg";

type Who = { role: "service" } | { role: "user"; userId: string; email: string };
type Result = { data: unknown; error: { message: string; code?: string } | null; count?: number | null };

const columnsCache = new Map<string, Set<string>>();

/** pg client whose timestamps come back as ISO strings, like PostgREST's JSON. */
export function isoClient(connectionString: string) {
  const types = {
    getTypeParser: (oid: number, format?: string) => {
      if (oid === 1184 || oid === 1114) return (v: string) => new Date(v).toISOString();
      if (oid === 1700) return (v: string) => Number(v); // numeric → JSON number
      return pg.types.getTypeParser(oid, format as "text");
    },
  };
  return new pg.Client({ connectionString, types: types as never });
}

export async function loadColumns(db: pg.Client) {
  const { rows } = await db.query("select table_name, column_name from information_schema.columns where table_schema = 'public'");
  for (const r of rows) {
    if (!columnsCache.has(r.table_name)) columnsCache.set(r.table_name, new Set());
    columnsCache.get(r.table_name)!.add(r.column_name);
  }
}

const singular = (t: string) => (t === "businesses" ? "business" : t === "staff" ? "staff" : t.replace(/s$/, ""));

/** "metadata->>notice" → metadata->>'notice' */
const col = (c: string, alias = "t0") => {
  const [base, ...path] = c.split(/->>|->/);
  const ops = c.match(/->>|->/g) ?? [];
  return `${alias}.${base!.trim()}${path.map((p, i) => `${ops[i]}'${p}'`).join("")}`;
};

function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export function standIn(db: pg.Client, who: Who) {
  async function exec(sql: string, params: unknown[]): Promise<pg.QueryResult> {
    if (who.role === "service") return db.query(sql, params);
    await db.query("begin");
    try {
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claim.sub', $1, true)", [who.userId]);
      const r = await db.query(sql, params);
      await db.query("commit");
      return r;
    } catch (err) {
      await db.query("rollback");
      throw err;
    }
  }

  function from(table: string) {
    let op: "select" | "insert" | "update" | "upsert" | "delete" = "select";
    let cols = "*";
    let returning: string | null = null;
    let payload: Record<string, unknown> | Record<string, unknown>[] = {};
    let onConflict = "";
    let countHead = false;
    let mode: "many" | "single" | "maybe" = "many";
    const params: unknown[] = [];
    const where: string[] = [];
    const orders = new Map<string, string[]>(); // "" = top level, else embedded table
    const limits = new Map<string, number>();
    const p = (v: unknown) => {
      params.push(v !== null && typeof v === "object" && !Array.isArray(v) ? JSON.stringify(v) : v);
      return `$${params.length}`;
    };

    const selectList = (spec: string, tbl: string, alias: string): string =>
      splitTop(spec)
        .map((item) => {
          const m = item.match(/^(\w+)\((.*)\)$/s);
          if (!m) return item === "*" ? `${alias}.*` : `${col(item, alias)}`;
          const [, embed, inner] = m as unknown as [string, string, string];
          const e = `e_${embed}`;
          const tableCols = columnsCache.get(tbl)!;
          const fkHere = `${singular(embed)}_id`;
          if (tableCols.has(fkHere)) {
            // many-to-one: appointments.customer_id → customers
            return `(select row_to_json(${e}) from (select ${selectList(inner, embed, e)} from public.${embed} ${e} where ${e}.id = ${alias}.${fkHere}) ${e}) as "${embed}"`;
          }
          const fkThere = `${singular(tbl)}_id`;
          if (!columnsCache.get(embed)?.has(fkThere)) throw new Error(`stand-in: no relationship ${tbl} → ${embed}`);
          const order = orders.get(embed)?.map((o) => o.replace(/^t0\./, `${e}.`)).join(", ");
          const limit = limits.get(embed);
          return `coalesce((select json_agg(row_to_json(${e})) from (select ${selectList(inner, embed, e)} from public.${embed} ${e} where ${e}.${fkThere} = ${alias}.id${order ? ` order by ${order}` : ""}${limit ? ` limit ${limit}` : ""}) ${e}), '[]'::json) as "${embed}"`;
        })
        .join(", ");

    const build = (): string => {
      const w = where.length ? ` where ${where.join(" and ")}` : "";
      const ret = returning ? ` returning ${selectList(returning, table, "t0")}` : "";
      if (op === "select") {
        if (countHead) return `select count(*)::int as count from public.${table} t0${w}`;
        const order = orders.get("")?.join(", ");
        const limit = limits.get("");
        return `select ${selectList(cols, table, "t0")} from public.${table} t0${w}${order ? ` order by ${order}` : ""}${limit ? ` limit ${limit}` : ""}`;
      }
      if (op === "delete") return `delete from public.${table} t0${w}${ret}`;
      if (op === "update") {
        const sets = Object.entries(payload).map(([k, v]) => `${k} = ${p(v)}`);
        return `update public.${table} t0 set ${sets.join(", ")}${w}${ret}`;
      }
      const rows = Array.isArray(payload) ? payload : [payload];
      const keys = Object.keys(rows[0]!);
      const values = rows.map((r) => `(${keys.map((k) => p(r[k])).join(", ")})`).join(", ");
      const conflict =
        op === "upsert" ? ` on conflict (${onConflict}) do update set ${keys.map((k) => `${k} = excluded.${k}`).join(", ")}` : "";
      return `insert into public.${table} as t0 (${keys.join(", ")}) values ${values}${conflict}${ret}`;
    };

    const run = async (): Promise<Result> => {
      let sql: string;
      try {
        sql = build();
      } catch (err) {
        return { data: null, error: { message: (err as Error).message } };
      }
      try {
        const { rows } = await exec(sql, params);
        if (countHead) return { data: null, error: null, count: rows[0].count };
        if (op !== "select" && !returning) return { data: null, error: null };
        if (mode === "many") return { data: rows, error: null };
        if (rows.length > 1 || (mode === "single" && rows.length === 0)) {
          return { data: null, error: { message: `JSON object requested, ${rows.length} rows returned`, code: "PGRST116" } };
        }
        return { data: rows[0] ?? null, error: null };
      } catch (err) {
        const e = err as { message: string; code?: string };
        return { data: null, error: { message: e.message, code: e.code } };
      }
    };

    const q = {
      select(c = "*", options?: { count?: string; head?: boolean }) {
        if (op === "select") cols = c;
        else returning = c;
        if (options?.head) countHead = true;
        return q;
      },
      insert: (v: typeof payload) => ((op = "insert"), (payload = v), q),
      upsert: (v: typeof payload, o?: { onConflict?: string }) => ((op = "upsert"), (payload = v), (onConflict = o?.onConflict ?? "id"), q),
      update: (v: Record<string, unknown>) => ((op = "update"), (payload = v), q),
      delete: () => ((op = "delete"), q),
      eq: (c: string, v: unknown) => (where.push(`${col(c)} = ${p(v)}`), q),
      neq: (c: string, v: unknown) => (where.push(`${col(c)} <> ${p(v)}`), q),
      gt: (c: string, v: unknown) => (where.push(`${col(c)} > ${p(v)}`), q),
      gte: (c: string, v: unknown) => (where.push(`${col(c)} >= ${p(v)}`), q),
      lt: (c: string, v: unknown) => (where.push(`${col(c)} < ${p(v)}`), q),
      in: (c: string, v: unknown[]) => (where.push(`${col(c)}::text = any(${p(v.map(String))}::text[])`), q),
      not: (c: string, operator: string, v: unknown) => {
        if (operator !== "is" || v !== null) throw new Error("stand-in: only not(col, 'is', null)");
        where.push(`${col(c)} is not null`);
        return q;
      },
      or: (expr: string) => {
        const parts = expr.split(",").map((part) => {
          const m = part.match(/^(.+?)\.(eq|neq)\.(.+)$/);
          if (!m) throw new Error(`stand-in: can't parse or(${part})`);
          return `${col(m[1]!)}::text ${m[2] === "eq" ? "=" : "<>"} ${p(m[3])}`;
        });
        where.push(`(${parts.join(" or ")})`);
        return q;
      },
      order: (c: string, o?: { ascending?: boolean; referencedTable?: string }) => {
        const key = o?.referencedTable ?? "";
        orders.set(key, [...(orders.get(key) ?? []), `${col(c)} ${o?.ascending === false ? "desc" : "asc"}`]);
        return q;
      },
      limit: (n: number, o?: { referencedTable?: string }) => (limits.set(o?.referencedTable ?? "", n), q),
      single: () => ((mode = "single"), q),
      maybeSingle: () => ((mode = "maybe"), q),
      then: (resolve: (v: Result) => void, reject: (e: unknown) => void) => run().then(resolve, reject),
    };
    return q;
  }

  return {
    from,
    async rpc(fn: string, args: Record<string, unknown>) {
      const keys = Object.keys(args);
      const sql = `select * from public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}${k === "p_embedding" ? "::extensions.vector" : ""}`).join(", ")})`;
      try {
        return { data: (await exec(sql, keys.map((k) => args[k]))).rows, error: null };
      } catch (err) {
        return { data: null, error: { message: (err as Error).message } };
      }
    },
    auth: {
      async getUser() {
        return { data: { user: who.role === "user" ? { id: who.userId, email: who.email } : null }, error: null };
      },
      admin: {
        async getUserById(id: string) {
          if (who.role !== "service") return { data: { user: null }, error: { message: "not allowed" } };
          const { rows } = await db.query("select id, email from auth.users where id = $1", [id]);
          return { data: { user: rows[0] ?? null }, error: rows[0] ? null : { message: "User not found" } };
        },
      },
    },
  };
}
