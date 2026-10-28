import { describe, expect, it } from "vitest";
import { dayInText, resolveDay } from "../src/agent/dates";

const MON = "2026-10-26";

describe("resolveDay", () => {
  it.each([
    ["2026-11-03", "2026-11-03"],
    ["today", MON],
    ["tomorrow", "2026-10-27"],
    ["day_after_tomorrow", "2026-10-28"],
    ["Saturday", "2026-10-31"],
    ["monday", MON],
    ["kal", "2026-10-27"],
  ])("%s → %s", (input, expected) => expect(resolveDay(input, MON)).toBe(expected));

  it("returns null for nonsense", () => expect(resolveDay("soon", MON)).toBeNull());
});

describe("dayInText", () => {
  it.each([
    ["Kal appointment chahiye", "2026-10-27"],
    ["kl shaam ko milega?", "2026-10-27"],
    ["parso ka slot", "2026-10-28"],
    ["Can I come the day after tomorrow?", "2026-10-28"],
    ["aaj 5 baje", MON],
    ["शनिवार को आ सकते हैं?", "2026-10-31"],
    ["कल डॉक्टर मिलेंगे?", "2026-10-27"],
  ])("%s → %s", (text, expected) => expect(dayInText(text, MON)).toBe(expected));

  it("is null when the message names no day or two days", () => {
    expect(dayInText("general", MON)).toBeNull();
    expect(dayInText("kal nahi, parso", MON)).toBeNull();
  });
});
