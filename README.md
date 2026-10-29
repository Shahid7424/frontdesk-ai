# Swagat AI

Swagat AI is an AI receptionist for Indian businesses: clinics, agencies, salons, coaching centres. Customers ask questions in Hinglish in a website chat; Swagat AI answers from the business's own data (with sources), books slots without double-booking, and sends UPI payment links. The owner watches everything from a dashboard and can take over any chat.

**Status:** Day 13, ready to deploy. Frontend, Supabase (schema, RLS, magic-link auth, onboarding), the AI chat, the knowledge base with cited answers, the embeddable widget, an end-to-end eval suite, the owner dashboard on live data (inbox with replies to the customer, bookings, overview) and booking advances through Razorpay Payment Links are built, the owner edits profile, team, services, prices and hours from Settings, customers cancel or move bookings in the chat, owners get email alerts, errors reach Sentry, and a security pass is done (SECURITY.md). DEPLOY.md has the Vercel steps. The model is pluggable: a free open model on Groq by default, Claude Haiku 5.5 for paying clients. It answers from each business's own data, checks real availability, holds slots in Postgres, and every reply's tokens and cost are saved and traced in Langfuse.

## What's in here

```
frontdesk-ai/
├─ apps/
│  ├─ web/                 Next.js 15 (App Router): landing, demo, dashboard, API
│  │  ├─ app/(marketing)/      landing page
│  │  ├─ app/demo/             fictional clinic site with the real widget embedded
│  │  ├─ app/(dashboard)/      overview, inbox, bookings, knowledge base, channels, settings
│  │  ├─ app/api/chat/         streaming chat endpoint (Claude agent; mock for the demo clinic without a key)
│  │  ├─ lib/agent/            DB loading, persistence, slot holds, Langfuse tracing
│  │  ├─ lib/knowledge/        PDF/text ingestion, embeddings, hybrid search
│  │  ├─ lib/inngest/          background ingestion job (inline fallback without Inngest)
│  │  ├─ app/api/inngest/      Inngest endpoint
│  │  ├─ app/api/chat/updates/ staff replies and notices for the widget (polled)
│  │  ├─ app/api/razorpay/     payment webhook
│  │  ├─ lib/payments/         Razorpay links, webhook signature, booking confirmation
│  │  ├─ lib/data/             dashboard queries (through RLS)
│  │  ├─ app/api/widget-config/ public widget settings per business
│  │  └─ lib/mock/             demo clinic data + scripted mock agent
│  └─ widget/              Preact + Vite → one widget.js file (12 KB gzipped)
└─ packages/
   ├─ core/                chat protocol shared by widget, dashboard and API
   │  ├─ src/agent/           agent for Claude and Groq: prompt, tools, slot finder, cost (DB-free, unit tested)
   │  └─ src/knowledge/       chunking, Hinglish search terms, citation filter, Gemini embeddings
   ├─ db/                  Supabase migrations, seed, generated types, RLS tests
   └─ evals/               golden-set evals against the running app (npm run eval)
      ├─ supabase/migrations/  schema, RLS, onboarding function
      ├─ supabase/seed.sql     demo clinic (powers /demo)
      ├─ supabase/seed-knowledge.sql  demo clinic documents (the RAG eval set)
      ├─ test/rls.test.ts      tenant isolation + double-booking tests
      └─ test/search.test.ts   hybrid search: 11 demo questions, isolation, permissions
examples/
├─ clinic-site/            a separate "customer website" to test the embed on another origin
└─ sample-docs/            a sample PDF to upload
```

## Run it

Step-by-step VS Code setup (Hinglish, beginner friendly): see [SETUP.md](SETUP.md).

```bash
npm install
npm run dev        # builds the widget in watch mode + starts Next on :3000
```

Open:
- `http://localhost:3000` landing page
- `http://localhost:3000/demo` chat with the demo clinic (try "Kal appointment chahiye")
- `http://localhost:3000/dashboard` owner dashboard

`npm run build` and `npm run typecheck` run across all workspaces through Turborepo.

### With Supabase (real login and data)

Without Supabase keys the app runs in **demo mode** (mock data, no login). To turn on auth and the database:

**Option A: Supabase cloud (no Docker)**
1. Create a project at supabase.com (region: Mumbai).
2. Link and push the schema:
   ```bash
   cd packages/db
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push          # runs the migrations
   ```
   Load the demo clinic once by pasting `supabase/seed.sql` into the SQL editor.
3. Project Settings → API: copy the URL, `anon` key and `service_role` key into `apps/web/.env.local` (see `.env.example`).
4. Authentication → URL Configuration: set Site URL to `http://localhost:3000` and add `http://localhost:3000/auth/callback` to Redirect URLs.

**Option B: local Supabase (Docker)**
```bash
npm run db:start -w @frontdesk/db   # prints API URL + keys; emails go to Mailpit at :54324
npm run db:reset -w @frontdesk/db   # re-applies migrations + seed
```

Then `npm run dev`, open `/login`, sign in with the magic link, and you'll land in onboarding.

### AI model and Langfuse

Add to `apps/web/.env.local`:

```env
# free (default)
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_...
# or paid
# LLM_PROVIDER=claude
# ANTHROPIC_API_KEY=sk-ant-...
# optional: per-message cost traces
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_BASEURL=https://cloud.langfuse.com
```

Without a key for the chosen provider the demo clinic falls back to the scripted mock, and real businesses get a polite "the team will reply" message with the conversation flagged for the inbox.

### Tests

```bash
npm test -w @frontdesk/core   # agent on both providers: slots, tool loop, cost, caching (no DB, no API key)
DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npm test
```
Runs the migrations against a throwaway database and checks that two owners can't see or touch each other's data, that the anon key can read nothing, that onboarding is all-or-nothing, and that overlapping bookings are rejected. It also runs the demo clinic's 11 Hinglish questions through hybrid search (each must find its source in the top 3), and ingests text and PDFs end to end against the real schema (`apps/web/test/ingest.integration.test.ts`). CI runs this on every push.

### Evals

```bash
npm run dev          # terminal 1, with an LLM key and Supabase configured
npm run eval         # terminal 2: 34 cases against the demo clinic → packages/evals/results/latest.md
```

34 golden cases covering facts, document answers with sources, English/Hindi/Hinglish, "I don't know" without inventing, handoff, medical safety, booking honesty and prompt injection. 11 are critical (safety, injection, never confirming an unpaid booking) and must all pass; the overall bar is 90%. `--repeat 3` checks consistency, `--only <id|category>` runs a subset. The grader is plain code, unit tested against a correct and a wrong answer for every case, so it runs in CI without an API key.

## Key decisions (and why)

**1. The widget is a separate Preact app, not a React component.**
It runs on other people's websites, so it must be tiny and must not clash with their code. Preact keeps it ~12 KB gzipped; one `<script>` tag embeds it. It renders inside a **Shadow DOM**, so the host site's CSS can't break the widget and our CSS can't leak into their site.

**2. Our own NDJSON chat protocol (`packages/core/protocol.ts`).**
The API streams one JSON event per line: `text`, `citations`, `slots`, `payment_link`, `handoff`, `done`. Plain text streaming can't carry "here are 5 bookable slots" or "this answer came from the rate card", and the Vercel AI SDK's `useChat` is React-only. Typed events let the UI render slot buttons and payment cards, and the mock backend can be swapped for Claude without touching the UI.

**3. Structured actions instead of parsing text.**
When a customer taps a slot, the widget sends `action: { type: "book_slot", slotId }` with the message. The server never has to guess which slot "11:15 wala" means.

**4. Mock data has the same shape as the real tables.**
`lib/mock/*` mirrors the planned Supabase schema (`businesses`, `services`, `conversations`, `appointments`, ...). Moving to real queries changes the data source, not the components.

**5. Validation and safety at the edge, even in the mock.**
`/api/chat` validates every request with Zod (message length, history size), so nobody can send a huge payload we'd later pay tokens for. The widget fails quietly: if config can't load, it simply doesn't render, and never breaks the host page.

**6. Honest UX for AI.**
Answers show their source. When the AI doesn't know, it says so and offers a human instead of guessing. The inbox makes "Needs you" conversations obvious and lets the owner take over with one click.

**7. Built for Indian users.**
Hinglish detection in replies, ₹ formatting with `en-IN`, all times in `Asia/Kolkata`, UPI-first payment card, a DPDP-style consent line in the widget, and 16px inputs on mobile so iOS doesn't zoom.

**8. Tenant isolation lives in the database, not in our code.**
Every table has `business_id`, and RLS shows a user only the rows of businesses they're a member of. On top of that, child rows reference parents by `(id, business_id)`, so an appointment can't point at another clinic's doctor even if a server bug passes the wrong id. The anon key gets no table access at all; the widget goes through our API.

**9. Double-booking is impossible at the DB level.**
`appointments` has an exclusion constraint (`btree_gist`, `tstzrange` overlap per staff member) on live bookings. Two customers racing for 11:15 can't both win, no matter how the app code behaves. Cancelled slots free up automatically.

**10. Onboarding is one transaction.**
`create_business_with_setup(payload)` creates the business, owner membership, staff, services and hours atomically. A dropped connection can't leave a half-created business, and a double-clicked submit is rejected (`already_onboarded`). Zod validates on the client for UX and again in the Server Action for safety.

**11. Passwordless auth, verified on the server.**
Magic links mean no passwords for clinic staff to forget and none for us to store. Middleware uses `getUser()` (verifies the JWT with Supabase) rather than `getSession()` (trusts the cookie), and the `?next=` redirect only accepts same-site paths.

**12. One cached system prompt per business, with the clock outside the cache.**
The business's hours, services, team and FAQ are rendered deterministically into the first system block with `cache_control`. The current IST date/time goes in a second block after the breakpoint. Every message after the first one reads the big prefix from cache at 0.1x the input price; a timestamp inside it would break the cache on every request.

**13. Tools are narrow and can't leave the tenant.**
`check_availability` takes a `service_id` from a strict enum of that business's services, plus a date. `business_id` is never a tool argument: the server injects it, so a prompt injection can't make the model query another clinic. Slot times are computed in code and shown as buttons; the model is told not to read times out, so it can't invent one.

**14. The server trusts its own history, not the browser's.**
The widget sends its message list, but the model only sees the last 20 turns stored in Postgres for that conversation. A tampered request can't put words in the AI's mouth. A conversation id from another business is ignored and a new conversation starts.

**15. Slot taps are re-validated, then the DB has the final word.**
`book_slot` decodes the slot id, checks the service and staff belong to this business, re-runs the slot finder for that staff member, releases expired holds, then inserts a `pending_payment` appointment with a 10-minute hold. If two customers tap at once, the exclusion constraint rejects one (`23P01`) and that customer gets "slot just got taken". Tested with six parallel taps: exactly one booking.

**16. Cost is a first-class column.**
Each AI message stores model, billed input tokens (fresh + cache write + cache read), output tokens and USD cost computed from the published per-token prices; the conversation keeps a running total for the dashboard. Langfuse gets the same usage and cost, grouped by conversation, uploaded with `after()` so tracing never delays a reply.

**17. Haiku 5.5 with low effort for a receptionist.**
Most questions are lookups, so `output_config.effort: "low"` keeps latency and cost down while adaptive thinking still kicks in for harder turns. `FRONTDESK_MODEL` can switch models without a deploy; Day 11 adds automatic routing to Sonnet 5.5 for hard cases.

**18. The model is a setting, not a rewrite.**
`LLM_PROVIDER` picks Groq (free open model, default while building and piloting) or Claude (for clients who pay for quality). Both adapters share the prompt, the tool schemas, the tool executor and the event stream, and return the same result shape, so the route, the database and the widget don't know which model answered. Open models aren't schema-constrained like Claude's strict tools, so the shared executor validates every argument (unknown service, bad date, unknown handoff reason) and returns an error the model can recover from. Groq replies are stored with cost 0; Claude replies with their real cost.

**19. Ingestion is a background job that can't half-finish.**
Uploading stores the PDF in a private Storage bucket and returns at once; a job extracts text per page (`unpdf`), chunks it, embeds the chunks and flips the document to `ready`. It replaces the document's chunks rather than appending, so a retry or a Re-index never duplicates them. With Inngest configured the job gets retries with backoff (embedding 429s) and per-business concurrency; without it, it runs inline after the response, so local setup needs nothing. Failures a retry can't fix (scanned PDF, password, not a PDF) fail immediately with a message the owner can act on.

**20. Chunks follow the document, not a token counter.**
Clinic documents are short and list-like, so chunks follow paragraphs, stay around 900 characters, carry the previous chunk's last sentence for context, and never span pages, which keeps "Patient guide.pdf · p. 2" exact.

**21. Hybrid search, fused in one SQL function.**
`search_chunks()` runs keyword search (`tsvector` with the `simple` config, since English stemming hurts Hinglish) and vector search (pgvector HNSW, cosine) for one business, then merges them with Reciprocal Rank Fusion. Keywords catch exact things embeddings blur (PFT, ₹500, a doctor's name); vectors catch paraphrases keywords miss. Hinglish filler words are dropped and a small synonym map ("kharcha" → fees, "ghar" → home visit) keeps keyword-only mode useful. Embeddings are optional (Gemini's free `gemini-embedding-001` at 768 dims); without a key, search is keyword-only and everything else works. The function is executable only by the service role, never by browser keys.

**22. Retrieved text goes after the cache breakpoint.**
The top 5 chunks are sent with each message, after the cached business prompt, so uploading a document never invalidates the cache, and the prompt stays small no matter how big the knowledge base gets. Both providers get the same sources.

**23. Citations the model has to earn.**
Sources are numbered in the prompt and the model tags facts with `[2]`. A streaming filter strips the markers (even when split across chunks, and in the `【2†source】` style open models use) and the widget shows only the sources the answer actually cited, not everything search returned. Each AI message stores what was retrieved and what was cited, which is the raw data for RAG evals. If neither the profile nor the documents have the answer, the rule is: say so, and hand off to the team.

**24. The widget is safe to paste anywhere, and hard to abuse.**
One script tag, Shadow DOM, a guard against double inclusion, and a fallback for site builders that inject scripts late. Owners can lock the widget to their domains (checked on the config and chat endpoints; an empty list allows any site). Every chat request is rate limited before any DB or LLM work: per visitor IP (20/min, 300/day) and per business per day as a cost ceiling, shared across servers through Upstash Redis, or in memory when Redis isn't configured. The widget shows the limit message in the customer's chat.

**25. Evals run through the real app, graded by code.**
`npm run eval` talks to `/api/chat` exactly like the widget, so a case covers rate limits, Postgres, search, the model, tools and persistence, not just a prompt in isolation. Expected answers come from the seed data, so they are known exactly, and checks are regexes and events (slots shown, payment card, handoff reason, cited source, reply script) rather than an LLM judge: free, reproducible, and every failure names what was wrong. Rate limits from the free Groq tier are retried, not counted as failures. The app marks scripted-mock responses with `X-Frontdesk-Mode: mock`, so the runner refuses to grade the mock.

**26. The clinic always knows who is coming.**
Tapping a slot opens a small name + mobile form in the widget before anything is held; the number is normalised to +91XXXXXXXXXX (shared validator in `@frontdesk/core`, checked again on the server). Customers are one row per business and phone, so a returning patient isn't duplicated, and the chat is linked to them for the inbox. The details are remembered in the visitor's browser for next time; they are never copied into message metadata.

**27. Staff replies reach the customer by polling, not Realtime.**
While the widget is open it asks `/api/chat/updates` every 8 seconds (only when the tab is visible) for messages typed by staff and system notices such as "payment received". A random conversation UUID plus the business slug is the key, the endpoint returns nothing else, and it has its own per-IP limit so polling never eats the chat quota. Polling needs no Realtime setup on the clinic's Supabase plan and survives flaky mobile networks; the inbox refreshes the same way. Dashboard pages read through the owner's own Supabase session, so RLS (not our code) keeps tenants apart.

**28. Payments confirm bookings exactly once.**
A paid service with online advances gets a `pending_payment` hold and a Razorpay Payment Link (`reference_id` = appointment, 20-minute expiry because Razorpay's minimum is 15, recorded in `payments` with a unique link id). The webhook checks `X-Razorpay-Signature` on the raw body before parsing, and confirmation is idempotent, so Razorpay's retries are harmless. If money arrives after the hold lapsed and the slot is gone, the exclusion constraint refuses the booking, the payment is still recorded, and the chat lands in the inbox with a staff-only note to refund or rebook. Without Razorpay, development uses a test payment page that confirms through the same code path (refused in production), and the live site confirms bookings at once; clinics can also choose "pay at the clinic". Owners can mark an advance paid by hand, and the customer gets the confirmation in their chat either way.

**29. The AI never writes links or markdown.**
Payment links and slots reach the customer as cards and buttons, so any URL in the model's text can only be invented. Besides a prompt rule, a streaming filter drops links (whole words, held back until complete) and markdown bold from every reply, for both providers. It came from a live test where the model wrote a fake `payment.link` URL above the real card.

**30. Settings edit the same rows bookings point at.**
Profile, team, services, prices and hours are saved together through `update_business_setup()`, one owner-only transaction, so a half-saved setup can't happen. Existing staff and services are updated in place by id; removed ones are deactivated, never deleted, because appointments reference them. Business hours are replaced; hours set for one staff member are kept. The agent reads the setup fresh per message, so a new price applies to the next chat. The form reuses the onboarding fields.

**31. Cancelling and moving a booking proves ownership with the booking id.**
There is no customer login, so the widget remembers the ids of bookings made from that browser (an unguessable UUID, like the payment link) and sends them with each chat. `cancel_booking` asks the customer to confirm before it acts, and reaches only their booking. `reschedule_booking` shows slots that carry the booking id, so a tap moves the booking instead of creating one: same service, same price, the advance carries over, and the exclusion constraint still guards the new time. Paid cancellations aren't refunded automatically; the chat goes to the inbox with a note. On a new device the AI hands over to the team rather than trusting a phone number.

**32. Alerts are email first, sent after the response.**
Owners get an email (Resend) when the AI hands a chat over, when a customer answers staff, for bookings, cancellations and moves (switchable), and when a payment needs a refund or rebooking. Alerts run in `after()` and swallow their own failures, so email can never slow or break a chat or a payment webhook. Email was chosen over WhatsApp for launch: it is free and needs no Meta verification.

**33. Monitoring that keeps patients' data out.**
Every server error goes through one `reportError()` into Sentry when a DSN is set. Request bodies, headers, cookies, user info, SQL values and AI inputs are switched off, because a chat request carries names, numbers and symptoms.

## Next steps

Deploy (DEPLOY.md), then WhatsApp once Meta verification is through, OTP for managing bookings across devices, staff-specific hours in Settings, and a restaurant vertical.
