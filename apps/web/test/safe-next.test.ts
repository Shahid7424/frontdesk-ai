import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/safe-next";

describe("safeNext", () => {
  it.each(["/dashboard", "/dashboard/inbox?c=1", "/onboarding", "/dashboard/bookings#today"])("keeps %s", (p) => {
    expect(safeNext(p)).toBe(p);
  });

  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "/\t/evil.com", "/\n/evil.com", "javascript:alert(1)", "", null, undefined])("refuses %j", (p) => {
    expect(safeNext(p)).toBe("/dashboard");
    // Whatever comes back stays on this site.
    expect(new URL(safeNext(p), "https://app.test").origin).toBe("https://app.test");
  });
});
