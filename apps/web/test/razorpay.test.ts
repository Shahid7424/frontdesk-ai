import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// razorpay.ts reads its keys when imported, so each test sets env first and imports fresh.
async function load(env: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return import("@/lib/payments/razorpay");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("verifyWebhookSignature", () => {
  const body = JSON.stringify({ event: "payment_link.paid", payload: {} });
  const sign = (secret: string) => createHmac("sha256", secret).update(body).digest("hex");

  it("accepts Razorpay's HMAC of the raw body", async () => {
    const { verifyWebhookSignature } = await load({ RAZORPAY_WEBHOOK_SECRET: "whsec" });
    expect(verifyWebhookSignature(body, sign("whsec"))).toBe(true);
  });

  it("rejects a wrong secret, a changed body, or no signature", async () => {
    const { verifyWebhookSignature } = await load({ RAZORPAY_WEBHOOK_SECRET: "whsec" });
    expect(verifyWebhookSignature(body, sign("other"))).toBe(false);
    expect(verifyWebhookSignature(`${body} `, sign("whsec"))).toBe(false);
    expect(verifyWebhookSignature(body, null)).toBe(false);
    expect(verifyWebhookSignature(body, "short")).toBe(false);
  });

  it("refuses everything when no secret is configured", async () => {
    const { verifyWebhookSignature } = await load({ RAZORPAY_WEBHOOK_SECRET: "" });
    expect(verifyWebhookSignature(body, sign(""))).toBe(false);
  });
});

describe("createPaymentLink", () => {
  let calls: Array<{ url: string; init: RequestInit }>;
  beforeEach(() => {
    calls = [];
  });

  it("sends amount, expiry, reference and no Razorpay SMS", async () => {
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ id: "plink_1", short_url: "https://rzp.io/l/abc" }), { status: 200 });
    });
    const { createPaymentLink, isRazorpayTestMode } = await load({ RAZORPAY_KEY_ID: "rzp_test_x", RAZORPAY_KEY_SECRET: "s" });
    const expiresAt = new Date(Date.now() + 20 * 60_000);
    const link = await createPaymentLink({
      appointmentId: "a1",
      businessId: "b1",
      amountPaise: 50000,
      description: "Clinic: consult",
      customer: { name: "Ravi", phone: "+919822041118" },
      expiresAt,
      callbackUrl: "https://app.example/pay/a1",
    });
    expect(link).toEqual({ id: "plink_1", shortUrl: "https://rzp.io/l/abc" });
    expect(isRazorpayTestMode).toBe(true);
    const sent = JSON.parse(String(calls[0]!.init.body));
    expect(calls[0]!.url).toBe("https://api.razorpay.com/v1/payment_links");
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from("rzp_test_x:s").toString("base64")}`);
    expect(sent).toMatchObject({
      amount: 50000,
      currency: "INR",
      reference_id: "a1",
      expire_by: Math.floor(expiresAt.getTime() / 1000),
      notify: { sms: false, email: false },
      customer: { name: "Ravi", contact: "+919822041118" },
      callback_method: "get",
    });
  });

  it("throws with Razorpay's reason on an error", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: { description: "expire_by too soon" } }), { status: 400 }));
    const { createPaymentLink } = await load({ RAZORPAY_KEY_ID: "rzp_test_x", RAZORPAY_KEY_SECRET: "s" });
    await expect(
      createPaymentLink({ appointmentId: "a", businessId: "b", amountPaise: 1, description: "", customer: { name: null, phone: null }, expiresAt: new Date(), callbackUrl: "x" }),
    ).rejects.toThrow(/expire_by too soon/);
  });
});

describe("paymentMode", () => {
  it("defaults to online and reads at_clinic", async () => {
    const { paymentMode } = await import("@/lib/payments/settings");
    expect(paymentMode(null)).toBe("online");
    expect(paymentMode({})).toBe("online");
    expect(paymentMode({ payment_mode: "at_clinic" })).toBe("at_clinic");
    expect(paymentMode({ payment_mode: "weird" })).toBe("online");
  });
});
