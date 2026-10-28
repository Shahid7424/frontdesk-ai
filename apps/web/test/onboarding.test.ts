import { describe, expect, it } from "vitest";
import { isIndianPhone, settingsFromSetup, settingsSchema, toFormHours, toUpdatePayload } from "@/lib/onboarding";

describe("isIndianPhone", () => {
  it.each(["98765 43210", "+91 98765 43210", "+91-9876543210", "020 2729 1234", "(020) 27291234", "02027291234"])("accepts %s", (p) => {
    expect(isIndianPhone(p)).toBe(true);
  });
  it.each(["12345", "0000000000", "98765 4321", "call 9876543210", "+1 415 555 0100"])("rejects %s", (p) => {
    expect(isIndianPhone(p)).toBe(false);
  });
});

describe("settings form", () => {
  const S1 = "00000000-0000-4000-a001-000000000001";
  const SV = "00000000-0000-4000-a002-000000000001";
  const setup = {
    staff: [{ id: S1, name: "Dr. Mehta", title: null }],
    services: [{ id: SV, name: "General consultation", durationMin: 15, pricePaise: 50000, staffIds: [S1, "inactive-staff"] }],
    hours: [
      { weekday: 1, start: "17:00", end: "21:00", staffId: null },
      { weekday: 1, start: "09:00", end: "13:30", staffId: null },
      { weekday: 0, start: "10:00", end: "13:00", staffId: S1 },
    ],
  };
  const business = { name: "Sunrise", vertical: "clinic" as const, area: null, address: null, phone: "020 2729 1234" };

  it("round-trips the saved setup into the update payload", () => {
    const input = settingsFromSetup(business, setup);
    expect(input.hours[1]).toEqual({ open: true, shifts: [{ start: "09:00", end: "13:30" }, { start: "17:00", end: "21:00" }] });
    // Staff-only hours aren't part of the form, so Sunday reads closed for the business.
    expect(input.hours[0]).toEqual({ open: false, shifts: [] });
    expect(input.services[0]!.staffKeys).toEqual([S1]);

    const payload = toUpdatePayload(settingsSchema.parse(input));
    expect(payload.staff).toEqual([{ key: S1, id: S1, name: "Dr. Mehta", title: "" }]);
    expect(payload.services).toEqual([{ id: SV, name: "General consultation", duration_min: 15, price_paise: 50000, staff_keys: [S1] }]);
    expect(payload.hours).toEqual([
      { weekday: 1, start_time: "09:00", end_time: "13:30" },
      { weekday: 1, start_time: "17:00", end_time: "21:00" },
    ]);
  });

  it("keeps new rows without ids, so they're inserted", () => {
    const input = settingsFromSetup(business, setup);
    input.staff.push({ key: "tmp1", name: "Dr. Rao", title: "" });
    input.services.push({ name: "Dressing", durationMin: 15, priceRupees: 199.5, staffKeys: ["tmp1"] });
    const payload = toUpdatePayload(settingsSchema.parse(input));
    expect(payload.staff[1]).toEqual({ key: "tmp1", name: "Dr. Rao", title: "" });
    expect(payload.services[1]).toEqual({ name: "Dressing", duration_min: 15, price_paise: 19950, staff_keys: ["tmp1"] });
  });

  it("rejects ids that aren't uuids", () => {
    const input = settingsFromSetup(business, setup);
    input.services[0]!.id = "x'; drop table services;--";
    expect(settingsSchema.safeParse(input).success).toBe(false);
  });

  it("orders shifts and drops staff-only rules", () => {
    expect(toFormHours(setup.hours).filter((d) => d.open)).toHaveLength(1);
  });
});
