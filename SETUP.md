# FrontDesk AI: VS Code setup (step by step)

Do kadam hain: **Part A** se app demo mode mein chal jayegi (10 minute). **Part B** optional hai: real login aur database ke liye Supabase (15 minute).

---

## Part A: App ko demo mode mein chalana

### 1. Ye cheezein install honi chahiye (ek baar)

| Tool | Kaise check karein | Kahan se lein |
|---|---|---|
| **Node.js 22 LTS** | `node -v` → `v22.x.x` aana chahiye | https://nodejs.org (LTS wala) |
| **npm 10+** | `npm -v` | Node ke saath aata hai |
| **VS Code** | | https://code.visualstudio.com |
| Git (optional) | `git --version` | https://git-scm.com |

Node 18 ya 20 ho to 22 install karo. Node versions badalne ke liye `nvm` (Mac/Linux) ya `nvm-windows` use kar sakte ho.

### 2. Zip extract karo

1. `frontdesk-ai.zip` download karo.
2. Right click → **Extract All** (Windows) ya double click (Mac).
3. Andar ek `frontdesk-ai` folder milega. Isko kisi simple path par rakho, jaise `D:\projects\frontdesk-ai` ya `~/projects/frontdesk-ai`. Path mein spaces na hon to better hai.

### 3. VS Code mein folder kholo

VS Code → **File → Open Folder…** → `frontdesk-ai` folder chuno (wahi jisme `package.json` aur `README.md` hain, uske andar wala koi folder nahi).

"Do you trust the authors?" pooche to **Yes** karo.

Recommended extensions (Extensions tab mein search karo):
- **Tailwind CSS IntelliSense** (classes ka autocomplete)
- **ESLint**
- **Pretty TypeScript Errors** (optional)

### 4. Terminal kholo aur dependencies install karo

VS Code mein **Terminal → New Terminal** (shortcut: ``Ctrl + ` ``). Terminal ka path `frontdesk-ai` hona chahiye.

```bash
npm install
```

1-2 minute lagenge. Saare apps aur packages ki dependencies ek saath install hoti hain (npm workspaces).

### 5. App chalao

```bash
npm run dev
```

Ye do cheezein saath chalata hai (Turborepo ke through):
- `apps/widget` → chat widget build karta hai aur file badalne par dobara build karta hai
- `apps/web` → Next.js dev server, http://localhost:3000 par

Terminal mein `Ready` dikhe to browser mein kholo:

| URL | Kya dikhega |
|---|---|
| http://localhost:3000 | Landing page |
| http://localhost:3000/demo | Demo clinic site + chat widget (neeche right mein bubble) |
| http://localhost:3000/dashboard | Owner dashboard (demo data) |
| http://localhost:3000/onboarding | Business setup form |

Widget mein try karo: "Kal appointment chahiye" → slot chuno → payment card aayega.

Band karna ho to terminal mein `Ctrl + C`.

### 6. Baaki useful commands

```bash
npm run build       # production build (sab workspaces)
npm run typecheck   # TypeScript errors check
```

Abhi tak `.env.local` ki zaroorat nahi hai. Bina keys ke app **demo mode** mein chalti hai: mock data, koi login nahi.

---

## Part B (optional): Supabase se real login aur database

Isse magic link login, onboarding ka data save hona, aur har clinic ka alag data (RLS) chalu ho jayega.

### 1. Supabase project banao

1. https://supabase.com par sign up karo (GitHub se login sabse aasaan hai).
2. **New project** → naam `frontdesk-ai`, region **Mumbai (ap-south-1)**, ek strong database password daalo aur use password manager mein save karo.
3. Project banne mein 1-2 minute lagte hain.

### 2. Database mein tables banao (migrations)

VS Code terminal mein (pehle `npm run dev` ko `Ctrl + C` se band karo, ya naya terminal kholo):

```bash
cd packages/db
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push
cd ../..
```

- `supabase login` browser kholega, wahan allow karo.
- `<PROJECT_REF>` tumhare project URL mein hota hai: `https://supabase.com/dashboard/project/<PROJECT_REF>`. Ye 20 letters ka id hai.
- `link` database password maangega, step 1 wala.
- `db push` teeno migrations chalayega (tables, RLS, onboarding function).

Demo clinic data ke liye: Supabase dashboard → **SQL Editor** → **New query** → `packages/db/supabase/seed.sql` ka poora content paste karo → **Run**.

### 3. Keys ko `.env.local` mein daalo

1. Supabase dashboard → **Project Settings → API**.
2. VS Code mein `apps/web` folder ke andar ek nayi file banao: **`.env.local`**.
3. Isme ye likho (values dashboard se copy karo):

```env
NEXT_PUBLIC_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
SUPABASE_SERVICE_ROLE_KEY=<service_role secret key>
```

Dhyan rakho:
- `service_role` key secret hai. Ise kabhi chat mein paste mat karo, kabhi `NEXT_PUBLIC_` ke saath mat likho, aur kabhi git mein commit mat karo. `.env.local` pehle se `.gitignore` mein hai.
- File ka path exactly `apps/web/.env.local` hona chahiye, root folder mein nahi.

### 4. Login redirect allow karo

Supabase dashboard → **Authentication → URL Configuration**:
- **Site URL**: `http://localhost:3000`
- **Redirect URLs** mein add karo: `http://localhost:3000/auth/callback`

### 5. Chalao aur test karo

```bash
npm run dev
```

1. http://localhost:3000/login kholo → apna email daalo → **Email me a login link**.
2. Email mein link par click karo (usi browser mein jisme login start kiya tha).
3. Onboarding form aayega → apni clinic ki details bharo → **Launch my AI receptionist**.
4. Dashboard par tumhari clinic ka naam dikhega, aur Settings mein tumhari services aur timings.

Isolation test karna ho: incognito window mein dusre email se login karke dusri clinic banao. Dono ko sirf apni clinic dikhegi.

---

## Part C (Day 3): AI chat aur Langfuse cost tracking

Isse widget asli AI se jawab dega, tumhari business ki details (services, timings, team) se. Abhi ke liye **Groq ka free model** default hai, koi paisa nahi lagta. Jab kisi client ko bechoge aur unka budget hoga, tab sirf `.env.local` badal kar Claude (paid, better quality) par switch kar sakte ho, code nahi badalna.

### 1. Groq API key (free)

1. https://console.groq.com par sign up karo (Google ya GitHub se). Card ki zaroorat nahi.
2. Left menu → **API Keys → Create API Key** → naam `frontdesk-dev` → key copy karo (`gsk_` se shuru hoti hai, sirf ek baar dikhti hai).
3. Free tier mein per-minute aur per-day limits hain. Testing aur demo ke liye kaafi hai. Limit cross hui to chat mein "Ek minute mein dobara try kijiye" aayega.

Baad mein Claude chahiye ho (paid client ke liye): https://console.anthropic.com → Billing mein credits → Limits mein spend limit → API Keys → Create Key.

### 2. Langfuse keys (optional, par interview ke liye bahut kaam ka)

1. https://cloud.langfuse.com par sign up → naya project `frontdesk-ai`.
2. **Settings → API Keys → Create new API keys** → Public key aur Secret key copy karo.

### 3. `.env.local` mein add karo

Apni existing `apps/web/.env.local` file kholo (Supabase wali keys **waise hi rehne do**) aur neeche ye lines **add** karo:

```env
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_...
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_BASEURL=https://cloud.langfuse.com
```

Claude par switch karna ho to bas ye do lines badlo: `LLM_PROVIDER=claude` aur `ANTHROPIC_API_KEY=sk-ant-...`, phir `npm run dev` restart.

Langfuse ka region US chuna ho to `LANGFUSE_BASEURL=https://us.cloud.langfuse.com` likho. Ye keys bhi secret hain: chat mein paste mat karna, `NEXT_PUBLIC_` mat lagana.

### 4. Apni business ka widget test karo

`npm run dev` restart karo (env badalne par zaroori hai). Phir:

1. Login karo → Dashboard → **Channels** → **Try your widget**. Ek page khulega (`/try/<tumhara-slug>`) jisme tumhari business ka chat bubble hai.
2. Chat mein puchho: "Timings kya hai?", "Kal appointment chahiye", "Fees kitni hai?". Jawab tumhari onboarding wali services aur timings se aayega.
3. `/demo` Sunrise demo clinic hai. Seed chalaya ho aur key daali ho to ye bhi asli AI se chalega, warna scripted demo.
4. Supabase → **Table Editor → messages**: har AI reply ke saath `model`, `input_tokens`, `output_tokens`, `cost_usd` dikhega. Groq free hai to cost `0` aayega; Claude par asli cost. **conversations** mein `cost_usd` total.
5. Langfuse → **Tracing**: har message ka trace, tokens aur cost. **Sessions** mein poori conversation ek saath.
6. Widget mein slot tap karo → Supabase **appointments** mein `pending_payment` row aayegi (10 minute ka hold). Wahi slot dobara tap karo to "slot abhi kisi aur ne le liya" aayega.

---

## Part D (Day 4-6 upgrade): naye zip par shift karna

Ye zip poora project hai (Day 1 se Day 6 tak). Agar purana `frontdesk-ai` folder pehle se chal raha hai, to aise shift karo:

1. Purane folder mein `npm run dev` band karo (`Ctrl + C`).
2. Naya zip extract karo, naye folder mein (jaise `D:\projects\frontdesk-ai-v2`). Purana folder abhi delete mat karo.
3. **Sabse zaroori:** purane folder ki `apps/web/.env.local` file copy karke naye folder mein **same jagah** (`apps/web/.env.local`) paste karo. Isme tumhari Supabase, Groq aur Langfuse keys hain; zip mein ye file nahi hoti.
4. VS Code mein naya folder kholo, terminal mein:

```bash
npm install
```

Agar `Cannot find module @next/swc-...` ya `lightningcss` wala error aaye: `node_modules` folder aur `package-lock.json` delete karo, phir dobara `npm install`.

5. Database update (nayi migration: documents bucket, chunks ke page numbers, hybrid search function):

```bash
cd packages/db
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push
cd ../..
```

`db push` sirf nayi migration `20261027000001_knowledge.sql` chalayega, purana data safe rahega. Naya folder hai isliye `link` dobara karna padta hai (password wahi Supabase DB password).

6. Demo clinic ka knowledge (11 sawaalon ka eval data): Supabase → **SQL Editor** → **New query** → `packages/db/supabase/seed-knowledge.sql` ka poora content paste → **Run**. Ise dobara chalana safe hai.

7. `npm run dev` → http://localhost:3000 par login karke check karo ki dashboard pehle jaisa chal raha hai.

### Nayi keys (sab optional, sab free)

`apps/web/.env.local` mein neeche add karo, jo chahiye:

```env
# Meaning-based search (Day 5). Bina iske keyword search chalega.
GEMINI_API_KEY=AIza...

# Background jobs dashboard ke saath (Day 4). Bina iske upload ke baad turant same server par process hota hai.
INNGEST_DEV=1

# Rate limit sab servers par share karna ho (Vercel ke liye). Local par zaroori nahi.
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

- **Gemini key:** https://aistudio.google.com/apikey → **Create API key** → copy (`AIza` se shuru). Card nahi chahiye.
- **Inngest (optional):** `INNGEST_DEV=1` rakha hai to ek doosre terminal mein `npx inngest-cli@latest dev` chalao. http://localhost:8288 par har upload ka job, retries aur errors dikhenge. Interview mein dikhane ke liye achha hai. Na chalana ho to `INNGEST_DEV` line hata do.
- **Upstash (optional):** https://console.upstash.com → Create Database (Redis, region Mumbai) → **REST API** section se URL aur token.

Env badalne ke baad `npm run dev` restart karna mat bhoolna.

---

## Part E: Day 4 test karo (PDF aur quick answers se AI ko sikhana)

1. Login → Dashboard → **Knowledge base**.
2. **Documents** card mein `examples/sample-docs/clinic-guide.pdf` drag karo (ya click karke chuno). Ye ek sample 2 page ki clinic guide hai (parking, reports, cancellation, home visit).
3. Row pehle **Processing** dikhayegi, phir kuch second mein **Ready · N sections learned**. Page khud refresh hota hai. Done criterion: 1 minute ke andar Ready.
   - Gemini key nahi hai to "· keyword search" likha aayega. Key daalne ke baad us row par ↻ (Re-index) dabao.
4. **Quick answers** → **Add** → Topic: `Wheelchair`, Answer: `Wheelchair ramp side gate par hai, lift 2nd floor tak jaati hai.` → Save.
5. Supabase → **Table Editor**:
   - `documents`: tumhari PDF `ready` status ke saath, `embedding_model` = `gemini-embedding-001` (key ho to).
   - `chunks`: har section ek row, `page` column mein page number, `embedding` bhara hua (key ho to).
   - **Storage → documents** bucket mein PDF file `<business_id>/<document_id>.pdf`.
6. Galat file test: koi image ko `.pdf` rename karke upload karo → "isn't a PDF" error. Scanned (photo wali) PDF → **Failed** + wajah likhi aayegi, ↻ se retry.
7. Delete: row ke trash icon par 2 baar click (pehla click "Delete?" poochta hai). Chunks bhi saath mein delete ho jaate hain, AI turant use karna band kar deta hai.

---

## Part F: Day 5 test karo (sources ke saath jawab, nahi pata to team)

1. Knowledge base page ke upar **Test your AI** box mein puchho:
   - `Car parking hai kya?` → jawab ke neeche source chip: `clinic-guide.pdf · p. 1`
   - `Appointment cancel karne par refund milega?` → `clinic-guide.pdf · p. 2`
   - `Wheelchair le ke aa sakte hain?` → `Wheelchair`
2. Widget mein bhi same: Dashboard → **Channels** → **Try your widget**. Jawab ke neeche source chip par tap karo, wo text dikhega jahan se jawab aaya.
3. **Nahi pata to handoff:** puchho `MRI scan hota hai kya?` (ye kahin nahi likha). AI bolega ki ye jaankari uske paas nahi hai, aur "team notified" wala banner aayega. Dashboard → **Inbox** mein ye chat "needs human" mein dikhegi.
4. Supabase → `messages` table → AI wali row ka `metadata`: `retrieved` (search ne kaunse chunks diye) aur `citations` (jawab ne kaunse use kiye). Yahi aage evals (Day 7) mein kaam aayega.
5. Demo clinic ke 11 sawaal (Day 5 ka done criterion) automated test mein hain. Chalane ke liye Postgres + pgvector chahiye (Docker ho to `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres pgvector/pgvector:pg16`), phir:

```bash
set DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres
npm test
```

(PowerShell mein: `$env:DATABASE_URL="postgres://postgres:postgres@localhost:5432/postgres"`.) Docker nahi hai to ye step skip kar sakte ho; baaki tests (`npm test -w @frontdesk/core`) bina database ke chalte hain.

---

## Part G: Day 6 test karo (widget kisi bhi website par)

1. Dashboard → **Channels**. Snippet mein ab asli URL hai (`http://localhost:3000/widget.js` local par). Deploy ke baad Vercel ke env mein `NEXT_PUBLIC_APP_URL=https://<tumhara-domain>` set karna.
2. Ek "dusri website" chalao (sample clinic site, alag port par, taaki browser use alag website maane). `npm run dev` chalte hue, **naye terminal** mein:

```bash
npx serve examples/clinic-site -l 5500
```

3. Browser mein kholo: `http://localhost:5500/?business=<tumhara-slug>` (slug Channels snippet ke `data-business-id` mein hai). Green Leaf Clinic ki site par neeche right mein tumhara chat bubble aayega. "Book an appointment" button `window.FrontDesk.ask(...)` se chat kholta hai. Site ke ajeeb pink buttons widget ko affect nahi karte (Shadow DOM).
4. **Allowed websites:** Channels → Website chat ke neeche `example.com` add karo → 5500 wala page refresh → bubble nahi aayega (site allowed nahi hai). Ab `localhost` add karo → refresh → bubble wapas. Asli client ke liye unka domain daalna (jaise `pulmoplus.in`), taaki koi aur unka widget copy karke unka quota na kha sake. List khaali = har site allowed.
5. **Rate limit:** ek minute mein 20 se zyada messages bhejo → widget mein "Aap bahut jaldi messages bhej rahe hain" aayega. Limits: ek visitor 20/minute aur 300/din, ek business 3000/din (`CHAT_DAILY_LIMIT_PER_BUSINESS` se badal sakte ho).
6. Asli website par lagana: snippet copy karke site ke `</body>` se pehle paste. WordPress mein "Insert Headers and Footers" plugin, Wix mein Settings → Custom Code.

---

## Part H (Day 7-9 upgrade): naye zip par shift karna

Ye zip bhi poora project hai (Day 1 se Day 9 tak). Is baar **database mein koi nayi migration nahi hai**, to `supabase db push` ki zaroorat nahi.

1. Purane folder mein `npm run dev` band karo (`Ctrl + C`).
2. Naya zip naye folder mein extract karo (jaise `D:\projects\frontdesk-ai-v3`). Purana folder abhi delete mat karo.
3. Purane folder ki `apps/web/.env.local` copy karke naye folder mein **same jagah** paste karo.
4. Naye folder mein terminal:

```bash
npm install
npm run dev
```

(`@next/swc` ya `lightningcss` wala error aaye to `node_modules` aur `package-lock.json` delete karke dobara `npm install`.)

5. http://localhost:3000/dashboard par login karo. Ab Overview, Inbox aur Bookings par "Sample data" nahi likha hoga: wahan tumhari business ka asli data hai (shuru mein khaali ho sakta hai).

---

## Part I: Day 8 test karo (dashboard asli data par)

Do browser windows saath mein rakho: ek mein **customer** (tumhara widget), doosre mein **owner** (dashboard).

1. Customer window: Dashboard → **Channels** → **Try your widget** (ya `http://localhost:3000/try/shahid-q9en`). Likho `Kal appointment chahiye`, service batao, slot buttons aayenge.
2. Ek slot par tap karo. Ab seedha book nahi hoga: neeche **naam aur mobile number** ka form aayega. Galat number (jaise `12345`) daalo → "Sahi 10 digit mobile number daaliye". Sahi number daal ke **Slot hold karein** dabao → payment card aayega.
3. Owner window: **Bookings** → aaj/kal ke tab mein ye booking dikhegi, patient ka naam aur number ke saath, status "Awaiting payment". (Doosri baar booking karoge to form mein naam/number pehle se bhara milega.)
4. **Inbox**: ye chat list mein dikhegi (har 10 second mein khud refresh hoti hai). Chat kholo, right side mein patient ka phone, **Call** aur **WhatsApp** buttons.
5. **Owner reply:** Inbox mein reply likho, jaise `Namaste, main clinic se bol raha hoon`, Enter. Customer window mein 8-10 second ke andar ye message "Team" label ke saath aa jayega. Chat status "You're replying" ho jayega, aur ab AI customer ko jawab nahi dega.
6. **Hand back to AI** dabao → customer ab phir kuch puchhe to AI jawab dega. **Resolve** se chat close.
7. **Handoff:** customer window mein likho `mujhe kisi insaan se baat karni hai` → Inbox mein chat "Needs you" mein aayegi, aur left menu mein Inbox par number badge.
8. **Bookings actions:** "Mark paid" (advance cash/UPI mein mila), "Visited", "No-show", "Cancel" (do baar click: pehla click "Cancel booking?" poochta hai). Mark paid karte hi customer ki chat mein "Payment mil gaya! Aapki booking confirm hai" aa jayega.
9. **Overview**: Conversations, AI ne kitne khud handle kiye, bookings aur AI cost: sab pichhle 7 din ke asli numbers. Groq free par cost ₹0.00 dikhega.

---

## Part J: Day 9 test karo (payment)

Payment do tarah se chal sakta hai. Dashboard → **Settings** → **Payments** card mein choose karo:

- **Advance online:** paid service par slot kuch minute hold hota hai aur payment hote hi booking apne aap confirm.
- **Pay at the clinic:** har booking turant confirm, payment visit par. Jin clinics ke paas abhi Razorpay nahi hai unke liye yahi best hai.

### Bina Razorpay (local test)

1. Settings → Payments → **Advance online**.
2. Widget se booking karo → payment card → **Pay securely via UPI** dabao. Ek "Test mode · no real money moves" page khulega.
3. **Pay ₹500** dabao → "Booking confirmed". Ab ye sach mein database mein confirm hota hai: Bookings mein status **Confirmed**, aur chat mein 8-10 second mein "Payment mil gaya!" message.
4. Hold expire test: booking karke 10 minute kuch mat karo, phir payment page refresh → "This hold has expired". Chat mein `payment link bhejo` likho → slot abhi bhi free hai to hold renew hoke naya payment card aayega.
5. Settings → **Pay at the clinic** → nayi booking karo → koi payment card nahi, seedha "Booking confirm!".

Dhyan do: test payment page sirf local (`npm run dev`) par chalta hai. Live site par bina Razorpay keys ke bookings seedha confirm hoti hain, taaki koi customer bina paise diye "paid" na kar sake.

### Razorpay test mode ke saath (optional, KYC nahi chahiye)

1. https://dashboard.razorpay.com par sign up → upar **Test Mode** on → **Account & Settings → API Keys → Generate Test Key**.
2. `apps/web/.env.local` mein:

```env
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=koi-bhi-lamba-random-text
```

3. Webhook ke liye Razorpay ko tumhara local server dikhna chahiye. Naye terminal mein `npx cloudflared tunnel --url http://localhost:3000` chalao, jo `https://xxxx.trycloudflare.com` URL dega.
4. Razorpay → **Account & Settings → Webhooks → Add New Webhook**: URL `https://xxxx.trycloudflare.com/api/razorpay/webhook`, Secret wahi jo `RAZORPAY_WEBHOOK_SECRET` mein daala, events: `payment_link.paid`, `payment_link.expired`, `payment_link.cancelled`.
5. `npm run dev` restart → widget mein booking → payment card ab Razorpay ka asli link kholega (hold 20 minute ka hota hai, Razorpay ki minimum limit ki wajah se). Test UPI ID `success@razorpay` ya test card use karo.
6. Payment ke baad Razorpay tumhe wapas "confirming…" page par bhejega, jo kuch second mein "Booking confirmed" ho jayega. Bookings mein status Confirmed, chat mein "Payment mil gaya!".

Live clinic ke liye baad mein: Razorpay KYC → Live keys → Vercel env mein daalna → webhook live domain par.

---

## Part K: Day 7 evals (AI ka report card)

Ye 34 asli customer jaise sawaal demo clinic (Sunrise Family Clinic) se poochta hai, poore app ke through (widget jaisa hi: database, search, AI, booking), aur har jawab ko check karta hai: sahi fees/timings, sahi source, galat jaankari nahi, dawai nahi batana, emergency mein 108, prompt hacking se na bahakna, aur booking ko bina payment "confirm" na bolna. 11 sawaal **critical** hain: unme ek bhi fail hua to result FAIL.

1. Pehle `npm install` (naya package `packages/evals` aaya hai).
2. Settings → Payments mein **Advance online** rakho (ek eval payment card check karta hai). `.env.local` mein `GROQ_API_KEY` aur Supabase keys honi chahiye, aur demo clinic Supabase mein seed honi chahiye (`seed.sql` + `seed-knowledge.sql`, jo tum pehle kar chuke ho).
3. Terminal 1 mein `npm run dev`.
4. Terminal 2 mein:

```bash
npm run eval
```

5. Har sawaal par `PASS` ya `FAIL` aata jayega. Free Groq key par har message ke beech 15 second ka gap hai (free limit ~2 message per minute), to poora run **lagbhag 12-15 minute** leta hai. Groq limit lage to runner khud 60 second ruk ke wahi sawaal dobara chalata hai.
6. End mein score aata hai, aur poori report `packages/evals/results/latest.md` mein. Usme har fail ke saath AI ka asli jawab likha hota hai, taaki samajh aaye galti kahan hui.

Useful options:

```bash
npm run eval -- --only injection           # sirf ek category (facts, documents, language, unknown, handoff, medical, booking, injection)
npm run eval -- --only refund,parking      # sirf ye cases
npm run eval -- --repeat 3                 # har case 3 baar: consistency check (teeno baar pass hona chahiye)
npm run eval -- --gap 0                    # paid key (Groq Developer / Claude) par, bina gap ke
```

**Dhyan rakho:** free Groq key par din mein ~2 lakh tokens milte hain, aur ek poora eval run uska lagbhag aadha kha jata hai. Din mein ek full run kaafi hai; beech mein `--only` use karo.

**Report mujhe bhejna:** `latest.md` ka content yahan paste kar do. Jo fail honge unhe main prompt/code mein fix karunga, aur dobara run karke score improve karenge. Launch ke liye target: critical 100%, overall 90%+.

---

## Part L (Day 10): Settings se sab edit karo

> **Day 10-13 wala naya zip extract kiya hai?** To pehle `.env.local` purane folder se copy karo, phir project folder mein `npm install` chalao (Day 12 mein error monitoring ka naya package aaya hai). Uske baad neeche wala `db push` karo.

**Nayi migration hai** (`20261027000002_settings.sql`), isliye ek baar database update karna hai:

```bash
cd packages/db
npx supabase db push
cd ../..
```

Agar "not linked" bole to pehle `npx supabase link --project-ref <PROJECT_REF>` chalao (password wahi Supabase DB password). Purana data safe rahega.

Phir `npm run dev` restart karo aur test karo:

1. Dashboard → **Settings** kholo. Business profile, Team, Services & prices aur Opening hours ab sab edit hote hain.
2. "General consultation" ki price 500 se 650 karo. Neeche ek bar aayega, **Save changes** dabao. "Saved." dikhna chahiye.
3. `/try/<aapka-slug>` par refresh dabao aur poocho "consultation fees kitni hai?". AI ko ₹650 bolna chahiye. Slot book karo to payment card bhi ₹650 ka aana chahiye.
4. Ek naya service add karo (jaise "Dressing", ₹200) aur save karo. Phir chat mein us service ke liye slot maango.
5. Monday ki timing badlo (jaise 10:00 se 14:00), save karo, phir chat mein Monday ke slots maango. Naye time ke hisaab se aane chahiye.
6. Team mein se kisi ko hatao aur save karo. Unki purani bookings Bookings page par waise hi rahengi, bas naye slots unke saath nahi milenge.
7. Kuch galat bharo (jaise service ka naam khaali, ya closing time opening se pehle). Field ke neeche laal error aana chahiye aur kuch save nahi hoga.
8. Kuch badlo par save mat karo, phir **Discard** dabao. Sab purana wapas aa jana chahiye.

Dhyan rahe: timing badalne se pehle se booked appointments cancel nahi hote.

---

## Part M (Day 11): Chat se cancel aur time change

Is part ke liye koi nayi migration ya key nahi chahiye. `npm run dev` restart karo, `/try/<aapka-slug>` kholo aur refresh (↻) dabao.

**Cancel:**
1. "Kal appointment chahiye" likho, slot tap karo, naam aur number bharo.
2. Likho "ye booking cancel karni hai". AI pehle poochega ki kaunsi booking hai aur kya pakka cancel karni hai. Abhi cancel nahi honi chahiye.
3. Likho "haan". Ab booking cancel ho jayegi. Dashboard → Bookings mein status **Cancelled** dikhega, aur Inbox mein us chat par ek staff note hoga ("Customer cancelled ...").
4. Agar advance pay ho chuka tha (test payment page se pay karke try karo), to chat Inbox mein "Needs you" par aayegi aur note mein refund ki baat hogi. Refund apne aap nahi hota, clinic khud karegi.

**Time change (reschedule):**
1. Ek booking karo (pay bhi kar sakte ho).
2. Likho "is booking ka time parso kar do". Slot buttons aayenge.
3. Ek slot tap karo. Naam aur number ka form **nahi** aana chahiye. Message aayega "Ho gaya! Aapki booking ab ... par hai".
4. Bookings page par wahi booking naye time par dikhegi. Agar paid thi to paid hi rahegi, dobara payment nahi maanga jayega.

**Baad mein wapas aakar:** chat window band karo, ↻ se nayi chat shuru karo (same browser), phir likho "meri booking cancel karni hai". AI ko purani booking mil jayegi, kyunki browser booking yaad rakhta hai. Doosre phone se try karoge to AI team ko bata dega, kyunki wahan booking ka proof nahi hai.

---

## Part N (Day 12): Owner ko email alerts + error monitoring

### Email alerts (Resend, free)
1. https://resend.com par signup karo, **usi email se jis par alerts chahiye**. Resend ka test sender sirf isi email par mail bhejta hai.
2. Resend → **API Keys** → **Create API Key** → copy karo.
3. `.env.local` mein daalo: `RESEND_API_KEY=re_...`, phir `npm run dev` restart karo.
4. Dashboard → Settings → **Email alerts**. Email khaali chhodo (aapka login email use hoga) ya Resend wala email daalo, phir **Save alerts** dabao.

Test:
- Chat mein likho "mujhe doctor se baat karni hai". 1-2 minute mein "Customer waiting for a reply" wala email aana chahiye.
- Inbox se us chat mein reply karo, phir chat se customer ki taraf se jawab do. "New message in a chat you're handling" email aayega.
- Ek booking karke pay karo. "New booking" email aayega. Cancel ya time change karne par bhi email aayega.
- Settings mein "Also email me for new bookings..." off karo. Ab booking ke email band ho jayenge, par handoff aur refund wale email aate rahenge.

Key nahi daali to email nahi jayega, sirf terminal mein `[alerts] RESEND_API_KEY not set, would email ...` dikhega. Ye normal hai.

Apne domain se email bhejna (jaise alerts@aapkadomain.com) baad mein: Resend → Domains → domain verify karo, phir `ALERTS_FROM="FrontDesk AI <alerts@aapkadomain.com>"` set karo. Tab kisi bhi email par alert ja sakta hai.

### Error monitoring (Sentry, free)
1. https://sentry.io par signup karo, **Create Project** → platform **Next.js** chuno.
2. Project → Settings → **Client Keys (DSN)** → DSN copy karo.
3. `.env.local` mein dono jagah wahi DSN daalo: `SENTRY_DSN=...` aur `NEXT_PUBLIC_SENTRY_DSN=...`. Restart karo.

Ab live site par koi bhi error aaye (chat fail, payment webhook fail, page crash), wo Sentry mein dikhega aur Sentry email karega. Patient ka message, naam, number ya cookies Sentry ko **nahi** bheje jaate, sirf error.

---

## Part O (Day 13): Security check jo hua

Poori report `SECURITY.md` mein hai. Short mein:
- Login ke baad redirect wala ek bug fix kiya (`/\evil.com` jaisa link login ke baad doosri site par le ja sakta tha).
- Har page par security headers lag gaye (dashboard ko koi doosri site iframe mein nahi khol sakti).
- Koi secret key browser code mein nahi hai, aur repo mein bhi koi key commit nahi hai.
- Database: har table par RLS on hai. Naya settings function sirf owner chala sakta hai.
- Live deploy ke liye steps `DEPLOY.md` mein hain.

---

## Problems aur unke solutions

| Problem | Solution |
|---|---|
| `node: command not found` ya `npm` nahi chal raha | Node install ke baad VS Code poora band karke dobara kholo. |
| `npm install` mein `EBADENGINE` ya ajeeb errors | `node -v` check karo, 22 hona chahiye. |
| `Cannot find module @next/swc-...`, `turbo` ya `lightningcss` wala error (aksar Windows/Mac par) | Zip Linux par bana tha, to lockfile mein tumhare OS ke binaries miss ho sakte hain. Ek baar `node_modules` folder aur `package-lock.json` delete karo, phir `npm install`. |
| `Port 3000 is already in use` | Doosra dev server band karo, ya Next khud 3001 use karega. Login ke liye 3000 hi rakhna, kyunki redirect URL 3000 ka hai. |
| `/demo` par chat bubble nahi dikh raha | `npm run dev` root folder se chalao (sirf `apps/web` se nahi), taaki widget bhi build ho. Phir page refresh karo. |
| Login link "expired" bolta hai | Link sirf ek baar aur usi browser mein chalta hai. Naya link mangao. |
| Supabase email nahi aa raha | Spam folder dekho. Free plan par ek ghante mein sirf kuch emails jaate hain, thoda ruk ke try karo. |
| Login ke baad wapas `/login` par aa jata hai | Check karo ki `.env.local` mein URL aur anon key sahi hain, aur `npm run dev` restart kiya hai (env badalne par restart zaroori hai). |
| Chat mein "Aapka message team tak pahunch gaya hai" aata hai, AI jawab nahi deta | `GROQ_API_KEY` (ya Claude ke liye `ANTHROPIC_API_KEY`) `.env.local` mein nahi hai, ya `npm run dev` restart nahi kiya. |
| Chat mein "Chat abhi setup ho rahi hai" | API key galat hai (Claude ho to credits check karo). Terminal mein `[chat] agent failed` wala error dekho. |
| Langfuse mein trace nahi dikh raha | Keys aur `LANGFUSE_BASEURL` region check karo. Trace 5-10 second baad dikhta hai. |
| Upload ke baad "Storage isn't set up yet" | `npx supabase db push` nahi chala. Part D ka step 5 karo. |
| Document hamesha "Processing" par atka hai | `INNGEST_DEV=1` set hai par `npx inngest-cli@latest dev` nahi chal raha. Ya to wo chalao, ya `.env.local` se `INNGEST_DEV` hatao aur restart karke ↻ dabao. |
| "· keyword search" likha hai | `GEMINI_API_KEY` nahi hai, ya key daalne ke baad restart nahi kiya. Restart karke row par ↻ dabao. |
| Jawab mein source chip nahi aata | Sawaal business profile (timings, services) se answer hua: uska chip nahi aata, sirf documents ka aata hai. Agar document se tha, to Groq ka free model kabhi kabhi citation number chhod deta hai; Claude par ye zyada reliable hai. |
| 5500 wali site par bubble nahi aata | `npm run dev` chal raha hai? URL mein `?business=` sahi slug hai? Allowed websites mein list hai to `localhost` add karo. Browser console (F12) mein `[FrontDesk]` wala message dekho. |
| Widget mein "bahut jaldi messages" | Rate limit laga hai. 1 minute ruko, ya testing ke liye `npm run dev` restart karo (local limits memory mein hain). |
| `npm run eval` bolta hai "App mock mode mein hai" | `.env.local` mein `GROQ_API_KEY` ya Supabase keys missing hain, ya dev server restart nahi kiya. |
| Eval mein bahut saare "model provider busy" | Free Groq ki per-minute ya daily limit khatam. `--gap 30` se chalao, ya kal try karo, ya paid key lagao. |
| Slot tap karne par naam/number ka form aata hai | Ye naya hai (Day 8): clinic ko pata hona chahiye kaun aa raha hai. Ek baar bharne ke baad same browser mein yaad rehta hai. |
| Owner ka reply customer ko nahi dikh raha | Customer ki chat window khuli honi chahiye; reply 8-10 second mein aata hai. Chat band karke kholne par bhi aa jayega. |
| Payment page par "Test payments are off" | `RAZORPAY_KEY_ID` set hai (tab Razorpay ka link use hota hai), ya app production mode (`npm start`) mein hai. |
| Razorpay se pay kiya par booking "Awaiting payment" hi hai | Webhook nahi pahuncha: tunnel chal raha hai? Webhook URL aur secret sahi hain? Razorpay → Webhooks mein us event ka status dekho. Tab tak Bookings se "Mark paid" kar sakte ho. |
| Settings save par "Couldn't save" | Day 10 ki migration nahi chali. Part L ka `npx supabase db push` chalao. |
| Alert email nahi aaya | `RESEND_API_KEY` set hai aur restart kiya? Resend ka test sender sirf usi email par bhejta hai jisse Resend account bana; Settings mein wahi email daalo, ya Resend mein apna domain verify karo. Spam folder bhi dekho. |
| Reschedule par naam/number ka form aa gaya | AI ne `reschedule_booking` ki jagah naya booking wala tool chala diya. Ek baar aur saaf likho "meri booking ka time badlo", ya Claude model par try karo. |
| PowerShell mein "running scripts is disabled" | PowerShell admin mein ek baar chalao: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, ya VS Code terminal ko Command Prompt / Git Bash par switch karo. |

---

## Folder structure ek nazar mein

```
frontdesk-ai/
├─ apps/web/        Next.js app: landing, demo, dashboard, onboarding, API
├─ apps/widget/     Chat widget (Preact) → apps/web/public/widget.js
├─ packages/core/   Chat protocol + AI agent, Groq/Claude (prompt, tools, slots, cost)
├─ packages/db/     Supabase migrations, seed, RLS + search tests
├─ packages/evals/  AI report card: npm run eval
├─ examples/        Sample clinic website (widget test) aur sample PDF
├─ README.md        Architecture aur key decisions (interview ke liye)
├─ DEPLOY.md        Vercel par live karne ke steps
├─ SECURITY.md      Launch se pehle ka security check
└─ SETUP.md         Ye file
```
