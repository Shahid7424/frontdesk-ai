import { describe, expect, it } from "vitest";
import { LinkFilter, stripLinks } from "../src/agent/links";

/** Streams text through the filter in pieces of `size` characters. */
function streamed(text: string, size: number) {
  const f = new LinkFilter();
  let out = "";
  for (let i = 0; i < text.length; i += size) out += f.push(text.slice(i, i + size));
  return out + f.end();
}

describe("LinkFilter", () => {
  it.each([
    ["Here is your link: https://payment.link/xyz123 please pay.", "Here is your link: please pay."],
    ["Pay here: http://rzp.io/abc", "Pay here: "],
    ["Visit www.sunriseclinic.in for details.", "Visit for details."],
    ["Link: payment.link/xyz123\n\nThanks!", "Link: \n\nThanks!"],
    ["[Pay now](https://x.com/pay) ya card dabaiye.", "[Pay ya card dabaiye."],
    ["(https://pay.example.com/a1)", ""],
  ])("drops the link in %j", (input, expected) => {
    expect(stripLinks(input)).toBe(expected);
  });

  it.each([
    "Fees ₹500 hai. Clinic 9:30 se 8 baje tak khula hai.",
    "Dr. Mehta kal 10:00 baje free hain, slot tap kijiye.",
    "Report 24/7 helpline par milegi: +91 98765 43210.",
    "e.g. kal ya parso, jo aapko theek lage.",
  ])("keeps ordinary text: %j", (text) => {
    expect(stripLinks(text)).toBe(text);
  });

  it("drops markdown bold, even split across deltas", () => {
    const text = "Please tap the **Pay** button on the __card__ below.";
    for (const size of [1, 2, 5, 100]) expect(streamed(text, size)).toBe("Please tap the Pay button on the card below.");
  });

  it("catches a link split across stream deltas", () => {
    const text = "Payment link: https://payment.link/xyz123\n\nCard par tap kijiye.";
    for (const size of [1, 2, 3, 7, 13]) expect(streamed(text, size)).toBe("Payment link: \n\nCard par tap kijiye.");
  });
});
