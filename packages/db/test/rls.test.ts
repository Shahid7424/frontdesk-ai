/**
 * Tenant isolation tests: Day 2's "done" criterion is that two owners can
 * log in and never see each other's data. These run the real migrations
 * against a throwaway Postgres database and act as each user the same way
 * Supabase does (role `authenticated` + the JWT `sub` claim).
 *
 * DATABASE_URL must point at a Postgres 15+ server with pgvector installed
 * (CI uses the pgvector/pgvector Docker image). The test creates and drops
 * its own database, so it never touches real data.
 */
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ADMIN_URL = process.env.DATABASE_URL ?? "postgres://postgres@localhost:5432/postgres";
const root = join(import.meta.dirname, "..");
const dbName = `fd_test_${Date.now()}`;

let admin: pg.Client;
let db: pg.Client;

const A = randomUUID();
const B = randomUUID();
const C = randomUUID();
let bizA: string;
let bizB: string;

const DEMO_BUSINESS = "00000000-0000-4000-a000-000000000001";

function setupPayload(name: string) {
  return {
    business: { name, slug: `${name.toLowerCase().replace(/\W+/g, "-")}-${Math.random().toString(36).slice(2, 6)}`, vertical: "clinic" },
    staff: [{ key: "s1", name: "Dr. One" }],
    services: [{ name: "Consultation", duration_min: 15, price_paise: 50000, staff_keys: ["s1"] }],
    hours: [{ weekday: 1, start_time: "09:00", end_time: "13:00" }],
  };
}

/** Runs fn inside a transaction as the given user (or anon when null). */
async function as<T>(user: string | null, fn: (q: pg.Client["query"]) => Promise<T>, commit = false): Promise<T> {
  await db.query("begin");
  try {
    await db.query(`set local role ${user ? "authenticated" : "anon"}`);
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [user ?? ""]);
    const result = await fn(db.query.bind(db));
    await db.query(commit ? "commit" : "rollback");
    return result;
  } catch (err) {
    await db.query("rollback");
    throw err;
  }
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
  const files = [
    "test/supabase-shim.sql",
    ...migrations.map((f) => `supabase/migrations/${f}`),
    "supabase/seed.sql",
    "supabase/seed-knowledge.sql",
  ];
  for (const file of files) await db.query(readFileSync(join(root, file), "utf8"));

  await db.query("insert into auth.users (id, email) values ($1, 'a@test.in'), ($2, 'b@test.in'), ($3, 'c@test.in')", [A, B, C]);

  bizA = await as(A, async (q) => (await q("select public.create_business_with_setup($1) as id", [setupPayload("Clinic A")])).rows[0].id, true);
  bizB = await as(B, async (q) => (await q("select public.create_business_with_setup($1) as id", [setupPayload("Clinic B")])).rows[0].id, true);
});

afterAll(async () => {
  await db?.end();
  await admin?.query(`drop database if exists ${dbName} with (force)`);
  await admin?.end();
});

describe("tenant isolation", () => {
  it("an owner sees only their own business", async () => {
    const rows = await as(A, async (q) => (await q("select id from public.businesses")).rows);
    expect(rows.map((r) => r.id)).toEqual([bizA]);
  });

  it("an owner sees only their own services, staff and hours", async () => {
    const counts = await as(A, async (q) =>
      (
        await q(`select
          (select count(*) from public.services where business_id <> $1)::int as foreign_services,
          (select count(*) from public.staff where business_id <> $1)::int as foreign_staff,
          (select count(*) from public.availability_rules where business_id <> $1)::int as foreign_hours,
          (select count(*) from public.services)::int as own_services`, [bizA])
      ).rows[0],
    );
    expect(counts).toEqual({ foreign_services: 0, foreign_staff: 0, foreign_hours: 0, own_services: 1 });
  });

  it("an owner cannot write into another business", async () => {
    await expect(
      as(A, (q) => q("insert into public.staff (business_id, name) values ($1, 'Intruder')", [bizB])),
    ).rejects.toThrow(/row-level security/);
  });

  it("an owner cannot update another business", async () => {
    const updated = await as(A, async (q) => (await q("update public.businesses set name = 'Hacked' where id = $1", [bizB])).rowCount);
    expect(updated).toBe(0);
  });

  it("the anon key cannot read any table", async () => {
    await expect(as(null, (q) => q("select * from public.businesses"))).rejects.toThrow(/permission denied/);
    await expect(as(null, (q) => q("select * from public.chunks"))).rejects.toThrow(/permission denied/);
  });

  it("the ownerless demo business is invisible to everyone signed in", async () => {
    const rows = await as(B, async (q) => (await q("select id from public.businesses where id = $1", [DEMO_BUSINESS])).rows);
    expect(rows).toHaveLength(0);
  });
});

describe("onboarding", () => {
  it("creates the business, owner membership, staff, services and hours together", async () => {
    const setup = await as(A, async (q) =>
      (
        await q(`select
          (select role from public.members where business_id = $1 and user_id = $2) as role,
          (select count(*) from public.service_staff)::int as links,
          (select count(*) from public.availability_rules)::int as hours`, [bizA, A])
      ).rows[0],
    );
    expect(setup).toEqual({ role: "owner", links: 1, hours: 1 });
  });

  it("rejects a second business for the same owner (double submit)", async () => {
    await expect(
      as(A, (q) => q("select public.create_business_with_setup($1)", [setupPayload("Clinic A again")])),
    ).rejects.toThrow(/already_onboarded/);
  });

  it("is all-or-nothing when part of the payload is invalid", async () => {
    const bad = setupPayload("Clinic C");
    bad.services[0]!.staff_keys = ["does-not-exist"];
    await expect(as(C, (q) => q("select public.create_business_with_setup($1)", [bad]), true)).rejects.toThrow(/unknown_staff_key/);
    const leftovers = await db.query("select count(*)::int as n from public.members where user_id = $1", [C]);
    expect(leftovers.rows[0].n).toBe(0);
  });

  it("refuses anonymous callers", async () => {
    await expect(as(null, (q) => q("select public.create_business_with_setup($1)", [setupPayload("Anon")]))).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe("settings", () => {
  /** A's current setup, as the settings form would send it back. */
  async function current() {
    return as(A, async (q) => {
      const staff = (await q("select id, name, title from public.staff where business_id = $1 and active order by created_at", [bizA])).rows;
      const services = (
        await q(
          `select s.id, s.name, s.duration_min, s.price_paise, array(select staff_id::text from public.service_staff x where x.service_id = s.id) as staff_keys
           from public.services s where business_id = $1 and active order by created_at`,
          [bizA],
        )
      ).rows;
      return {
        business: { name: "Clinic A", vertical: "clinic", area: "", address: "", phone: "" },
        staff: staff.map((s) => ({ key: s.id, id: s.id, name: s.name, title: s.title ?? "" })),
        services,
        hours: [{ weekday: 1, start_time: "09:00", end_time: "13:00" }],
      };
    });
  }
  const save = (user: string, target: string, payload: unknown) =>
    as(user, (q) => q("select public.update_business_setup($1, $2)", [target, payload]), true);

  it("edits profile, prices and hours, and adds staff and services in place", async () => {
    const p = await current();
    const serviceId = p.services[0].id;
    p.business.name = "Clinic A Renamed";
    p.business.area = "Kondhwa";
    p.services[0].price_paise = 70000;
    p.staff.push({ key: "new1", name: "Dr. Two", title: "Dentist" } as never);
    p.services.push({ name: "Cleaning", duration_min: 30, price_paise: 100000, staff_keys: ["new1"] });
    p.hours = [
      { weekday: 1, start_time: "10:00", end_time: "14:00" },
      { weekday: 2, start_time: "10:00", end_time: "14:00" },
    ];
    await save(A, bizA, p);

    const after = await as(A, async (q) => ({
      biz: (await q("select name, area from public.businesses where id = $1", [bizA])).rows[0],
      services: (await q("select id, name, price_paise from public.services where business_id = $1 and active order by created_at", [bizA])).rows,
      hours: (await q("select weekday, start_time::text from public.availability_rules where business_id = $1 order by weekday", [bizA])).rows,
      cleaningStaff: (await q("select st.name from public.service_staff x join public.staff st on st.id = x.staff_id join public.services s on s.id = x.service_id where s.name = 'Cleaning' and s.business_id = $1", [bizA])).rows,
    }));
    expect(after.biz).toEqual({ name: "Clinic A Renamed", area: "Kondhwa" });
    expect(after.services[0]).toMatchObject({ id: serviceId, price_paise: 70000 });
    expect(after.services.map((s) => s.name)).toEqual(["Consultation", "Cleaning"]);
    expect(after.hours).toEqual([
      { weekday: 1, start_time: "10:00:00" },
      { weekday: 2, start_time: "10:00:00" },
    ]);
    expect(after.cleaningStaff).toEqual([{ name: "Dr. Two" }]);
  });

  it("deactivates removed staff and services instead of deleting them", async () => {
    const p = await current();
    const removed = p.staff.find((s) => s.name === "Dr. Two")!;
    p.staff = p.staff.filter((s) => s !== removed);
    p.services = p.services.filter((s) => s.name !== "Cleaning");
    await save(A, bizA, p);
    const rows = await as(A, async (q) => ({
      staff: (await q("select active from public.staff where id = $1", [removed.id])).rows[0],
      cleaning: (await q("select active from public.services where business_id = $1 and name = 'Cleaning'", [bizA])).rows[0],
      links: (await q("select count(*)::int as n from public.service_staff where staff_id = $1", [removed.id])).rows[0].n,
    }));
    expect(rows).toEqual({ staff: { active: false }, cleaning: { active: false }, links: 0 });
  });

  it("refuses another business's owner, and another business's row ids", async () => {
    const p = await current();
    await expect(save(B, bizA, p)).rejects.toThrow(/not_owner/);
    const theirs = await as(B, async (q) => (await q("select id from public.services where business_id = $1", [bizB])).rows[0].id);
    p.services[0].id = theirs;
    await expect(save(A, bizA, p)).rejects.toThrow(/unknown_service/);
    // Nothing changed for B.
    const b = await as(B, async (q) => (await q("select name from public.services where id = $1", [theirs])).rows[0]);
    expect(b).toEqual({ name: "Consultation" });
  });
});

describe("bookings", () => {
  async function ids(user: string, business: string) {
    return as(user, async (q) => {
      const { rows } = await q(
        "select s.id as service_id, st.id as staff_id from public.services s, public.staff st where s.business_id = $1 and st.business_id = $1 limit 1",
        [business],
      );
      return rows[0] as { service_id: string; staff_id: string };
    });
  }

  it("cannot reference another tenant's staff, even with a valid id", async () => {
    const own = await ids(A, bizA);
    const other = await ids(B, bizB);
    await expect(
      as(A, (q) =>
        q(
          `insert into public.appointments (business_id, service_id, staff_id, starts_at, ends_at, source)
           values ($1, $2, $3, '2026-11-02 10:00+05:30', '2026-11-02 10:15+05:30', 'web')`,
          [bizA, own.service_id, other.staff_id],
        ),
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it("blocks overlapping appointments for the same staff member", async () => {
    const own = await ids(A, bizA);
    await expect(
      as(A, async (q) => {
        const insert = (start: string, end: string) =>
          q(
            `insert into public.appointments (business_id, service_id, staff_id, starts_at, ends_at, source, status)
             values ($1, $2, $3, $4, $5, 'web', 'confirmed')`,
            [bizA, own.service_id, own.staff_id, start, end],
          );
        await insert("2026-11-02 10:00+05:30", "2026-11-02 10:15+05:30");
        await insert("2026-11-02 10:10+05:30", "2026-11-02 10:25+05:30");
      }),
    ).rejects.toThrow(/appointments_no_overlap/);
  });

  it("lets a cancelled slot be booked again, and back-to-back slots coexist", async () => {
    const own = await ids(A, bizA);
    await as(A, async (q) => {
      const insert = (start: string, end: string, status: string) =>
        q(
          `insert into public.appointments (business_id, service_id, staff_id, starts_at, ends_at, source, status)
           values ($1, $2, $3, $4, $5, 'web', $6)`,
          [bizA, own.service_id, own.staff_id, start, end, status],
        );
      await insert("2026-11-03 10:00+05:30", "2026-11-03 10:15+05:30", "cancelled");
      await insert("2026-11-03 10:00+05:30", "2026-11-03 10:15+05:30", "confirmed");
      await insert("2026-11-03 10:15+05:30", "2026-11-03 10:30+05:30", "pending_payment");
    });
  });
});
