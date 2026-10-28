# Security review (Day 13, before launch)

This records what was checked before the first deploy, what was fixed, and the risks accepted for now.

## Fixed in this pass

| Issue | Fix |
|---|---|
| **Open redirect after login.** `?next=/\evil.com` passed the "starts with `/`, not `//`" check, and browsers read `\` as `/`, so a crafted login link could land the owner on another site right after signing in. | `lib/safe-next.ts` allows only plain path characters. It is used by the login page and the auth callback, and is tested with backslash, tab, newline and `javascript:` inputs. |
| **No browser security headers.** | Every response sends `X-Frame-Options: DENY`, `frame-ancestors 'none'` (the dashboard can't be framed for clickjacking), `nosniff`, a strict referrer policy, a permissions policy and HSTS. The widget is unaffected because it is a script, not a frame. |
| **Error monitoring would have sent patient data.** Sentry's defaults collect request bodies and headers, and chat requests carry names, phone numbers and messages. | `lib/sentry-options.ts` turns off bodies, headers, cookies, query strings, user info, SQL values and AI inputs and outputs. Only the error and a label leave the server. |
| **Owner alert emails could carry HTML from customers.** | Every value in an alert email is HTML-escaped (tested with `<b>` in a customer message). |

## Checked and fine

**Secrets**
- The service-role key is read only in `lib/supabase/server.ts` (`server-only`). The production client bundle was scanned for key names and key patterns, and none were found.
- No keys are committed: `.env*.local` is ignored, and git was scanned for Anthropic, Groq, Razorpay, Resend and JWT key patterns.

**Tenant isolation**
- RLS is on for every table, with membership as the only way in (`packages/db/test/rls.test.ts`).
- Dashboard reads and server actions use the owner's own Supabase session, so RLS applies and not just our code.
- `update_business_setup()` is `security definer`. It checks `is_owner`, and it rejects staff or service ids that belong to another business (tested).

**Public endpoints**
- `/api/chat` validates every field with zod and size limits.
- It rate limits per IP and per business before any DB or LLM work, and honours the owner's allowed domains.
- Booking ids from the browser must be UUIDs and must belong to the business. A booking id works as a bearer secret, which is the same model as the payment link.
- `/api/chat/updates` needs a UUID conversation id plus the slug, has its own rate limit, and returns only staff replies and system notices.

**Payments**
- The Razorpay webhook verifies `X-Razorpay-Signature` on the raw body with a constant-time compare before parsing. Unsigned requests get 401 (tested).
- Confirmation is idempotent.
- The test payment page refuses to run in production or when Razorpay keys are set.

**The AI agent**
- `business_id` is never a tool argument, and service ids are an enum.
- `cancel_booking` reaches only the customer's own booking, and only after the customer confirms. Prompt-injection cases are in the eval suite.
- The model can't put links in replies: a stream filter drops them.

**Uploads**
- PDFs are checked by magic bytes, limited to 10 MB, and stored under the business's own path. File names are cleaned.

**Auth**
- Magic links only. The middleware uses `getUser()`, which verifies the JWT, not `getSession()`.
- Next.js 15.5.28 includes the fix for the middleware bypass (CVE-2025-29927).

## Accepted for now

- **`npm audit` reports 4 items.**
  - PostCSS inside Next.js: used only at build time on our own CSS.
  - zod 3 inside the Inngest SDK: it validates Inngest's own signed payloads, and our code uses zod 4.6.7, which is patched.
  - The fixes need major upgrades (Next 16, Inngest 0.x). Revisit with the Next 16 upgrade.
- **Rate limits are per server process without Upstash.** On Vercel, set the Upstash keys (DEPLOY.md, Step 3) so the limits are shared.
- **A customer on a new device can't cancel or reschedule by themselves.** They have no proof the booking is theirs (no OTP yet), so the AI hands them to the team. An OTP over WhatsApp would close this once WhatsApp is set up.
- **No Content-Security-Policy for scripts yet.** Next.js inline scripts need nonces, which would make every page dynamic. The framing, sniffing and referrer headers are in place; a full CSP is a later step.

## Before each release

`npm run typecheck && npm test` with `DATABASE_URL` set. This also runs the RLS tests and the end-to-end flow tests against real Postgres. Then run `npm run eval` against a deployed preview.
