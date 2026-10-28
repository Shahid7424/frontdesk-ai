import { describe, expect, it } from "vitest";
import { normalizeIndianMobile } from "../src";

describe("normalizeIndianMobile", () => {
  it.each([
    ["9822041118", "+919822041118"],
    ["98220 41118", "+919822041118"],
    ["+91-98220-41118", "+919822041118"],
    ["919822041118", "+919822041118"],
    ["09822041118", "+919822041118"],
  ])("%s → %s", (raw, expected) => {
    expect(normalizeIndianMobile(raw)).toBe(expected);
  });

  it.each(["", "12345", "5822041118", "98220411189", "+1 415 555 0100", "abcdefghij"])("rejects %j", (raw) => {
    expect(normalizeIndianMobile(raw)).toBeNull();
  });
});
