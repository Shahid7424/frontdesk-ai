import { describe, expect, it } from "vitest";
import { allowedDomains, isOriginAllowed, normalizeDomain } from "@/lib/embed";
import { checkChatLimits, clientIp } from "@/lib/rate-limit";

describe("allowed websites", () => {
  it("normalises what owners type", () => {
    expect(normalizeDomain("https://www.GreenLeaf.in/contact")).toBe("greenleaf.in");
    expect(normalizeDomain("book.greenleaf.in")).toBe("book.greenleaf.in");
    expect(normalizeDomain("localhost")).toBe("localhost");
    expect(normalizeDomain("not a domain")).toBeNull();
    expect(normalizeDomain("clinic")).toBeNull();
  });

  it("allows any site until the owner adds a domain", () => {
    expect(isOriginAllowed("https://anything.com", [], "localhost:3000")).toBe(true);
  });

  it("allows listed domains, their subdomains and www, and blocks others", () => {
    const list = ["greenleaf.in"];
    expect(isOriginAllowed("https://greenleaf.in", list, null)).toBe(true);
    expect(isOriginAllowed("https://www.greenleaf.in", list, null)).toBe(true);
    expect(isOriginAllowed("https://book.greenleaf.in", list, null)).toBe(true);
    expect(isOriginAllowed("https://evilgreenleaf.in", list, null)).toBe(false);
    expect(isOriginAllowed("https://greenleaf.in.evil.com", list, null)).toBe(false);
    expect(isOriginAllowed("null", list, null)).toBe(false);
  });

  it("always allows our own app and non-browser callers", () => {
    expect(isOriginAllowed("http://localhost:3000", ["greenleaf.in"], "localhost:3000")).toBe(true);
    expect(isOriginAllowed(null, ["greenleaf.in"], "localhost:3000")).toBe(true);
  });

  it("reads the list from business settings defensively", () => {
    expect(allowedDomains({ allowed_domains: ["a.in", 3, "b.in"] })).toEqual(["a.in", "b.in"]);
    expect(allowedDomains(null)).toEqual([]);
    expect(allowedDomains(["a.in"])).toEqual([]);
  });
});

describe("chat rate limits (in-memory fallback)", () => {
  it("blocks the 21st message a minute from one IP, but not other IPs", async () => {
    for (let i = 0; i < 20; i++) expect((await checkChatLimits("1.1.1.1", "biz-a")).ok).toBe(true);
    const blocked = await checkChatLimits("1.1.1.1", "biz-a");
    expect(blocked).toMatchObject({ ok: false, rule: "ipMinute" });
    expect(blocked.retryAfter).toBeGreaterThan(0);
    expect((await checkChatLimits("2.2.2.2", "biz-a")).ok).toBe(true);
  });

  it("takes the first x-forwarded-for address", () => {
    expect(clientIp(new Request("http://x", { headers: { "x-forwarded-for": "9.9.9.9, 10.0.0.1" } }))).toBe("9.9.9.9");
    expect(clientIp(new Request("http://x"))).toBe("local");
  });
});
