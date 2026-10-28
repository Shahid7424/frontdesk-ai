import { describe, expect, it } from "vitest";
import { decodeSlotId, findFreeSlots } from "../src/agent";
import { clinic } from "./fixtures";

// Monday 2 Nov 2026, 08:00 IST
const mondayMorning = new Date("2026-11-02T08:00:00+05:30");

describe("findFreeSlots", () => {
  it("offers slots inside both shifts and none during the break", () => {
    const slots = findFreeSlots(clinic, "gp", "2026-11-02", [], mondayMorning);
    const times = slots.map((s) => new Date(s.startsAt).toISOString());
    expect(times[0]).toBe(new Date("2026-11-02T09:00:00+05:30").toISOString());
    // last morning start leaves room for 15 min before 13:30
    expect(times).toContain(new Date("2026-11-02T13:15:00+05:30").toISOString());
    expect(times).not.toContain(new Date("2026-11-02T14:00:00+05:30").toISOString());
    expect(times.at(-1)).toBe(new Date("2026-11-02T20:45:00+05:30").toISOString());
  });

  it("skips times that are too soon and times that overlap a booking", () => {
    const now = new Date("2026-11-02T09:10:00+05:30");
    const busy = [{ staffId: "mehta", startsAt: "2026-11-02T10:00:00+05:30", endsAt: "2026-11-02T10:30:00+05:30" }];
    const times = findFreeSlots(clinic, "gp", "2026-11-02", busy, now).map((s) => new Date(s.startsAt).getTime());
    expect(Math.min(...times)).toBe(new Date("2026-11-02T09:45:00+05:30").getTime()); // 30 min lead
    expect(times).not.toContain(new Date("2026-11-02T10:00:00+05:30").getTime());
    expect(times).not.toContain(new Date("2026-11-02T10:15:00+05:30").getTime());
    expect(times).toContain(new Date("2026-11-02T10:30:00+05:30").getTime());
  });

  it("uses a staff member's own hours on days they override (Sunday: only Dr. Mehta)", () => {
    const sunday = "2026-11-01";
    expect(findFreeSlots(clinic, "chest", sunday, [], mondayMorning)).toHaveLength(0);
    const gp = findFreeSlots(clinic, "gp", sunday, [], new Date("2026-10-31T08:00:00+05:30"));
    expect(gp[0]!.staffName).toBe("Dr. Anjali Mehta");
    expect(new Date(gp.at(-1)!.startsAt).getTime()).toBe(new Date("2026-11-01T12:45:00+05:30").getTime());
  });

  it("encodes slot ids the server can decode back", () => {
    const [slot] = findFreeSlots(clinic, "chest", "2026-11-02", [], mondayMorning);
    expect(decodeSlotId(slot!.id)).toEqual({ serviceId: "chest", staffId: "kulkarni", startsAt: new Date(slot!.startsAt) });
  });
});
