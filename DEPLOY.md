# Swagat AI ko live karna (Vercel)

Ye guide kal ke deploy ke liye hai. Poora kaam lagbhag 45 minute ka hai. Sab free plans par chalta hai.

Shuru karne se pehle ye ready rakho:
- Supabase project, jisme saari migrations chal chuki hon (Part L tak). Check karne ke liye: `cd packages/db` karke `npx supabase db push` chalao. "Remote database is up to date" aana chahiye.
- `.env.local` ki saari keys, jo abhi local mein chal rahi hain.
- GitHub account.

---

## Step 1: Code GitHub par daalo (private repo)

1. github.com → **New repository** → naam `frontdesk-ai` rakho → **Private** chuno → **Create repository**.
2. Project folder mein terminal kholo aur ye commands chalao:

```bash
git init
git add .
git commit -m "Swagat AI"
git branch -M main
git remote add origin https://github.com/<aapka-username>/frontdesk-ai.git
git push -u origin main
```

`.env.local` GitHub par **nahi** jayegi, kyunki `.gitignore` use rok deta hai. Push ke baad GitHub par check kar lo ki `.env.local` wahan nahi dikh rahi.

---

## Step 2: Vercel project banao

1. vercel.com → **Sign up with GitHub**.
2. **Add New → Project** → apna `frontdesk-ai` repo **Import** karo.
3. **Root Directory** ke saamne **Edit** dabao aur `apps/web` chuno. Ye sabse zaroori step hai.
4. Framework apne aap **Next.js** aa jayega. Build command `apps/web/vercel.json` se aati hai, isliye use mat chhedo.
5. **Environment Variables** khol ke neeche wali list daalo (Step 3). Phir **Deploy** dabao.

Pehla deploy 3-4 minute leta hai. Ant mein aapko `https://swagat-ai.vercel.app` jaisa URL milega.

---

## Step 3: Environment variables

Vercel → Project → **Settings → Environment Variables** mein ye daalo. Values wahi hain jo `.env.local` mein hain.

**Zaroori:**

| Naam | Kahan se |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | wahi |
| `SUPABASE_SERVICE_ROLE_KEY` | wahi (secret hai, kisi ko mat dikhana) |
| `LLM_PROVIDER` | `groq` |
| `GROQ_API_KEY` | console.groq.com |
| `NEXT_PUBLIC_APP_URL` | aapka Vercel URL, jaise `https://swagat-ai.vercel.app` (aakhir mein `/` nahi lagana) |

**Live ke liye strongly recommended:**

| Naam | Kyun |
|---|---|
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Vercel par kai servers chalte hain. Iske bina rate limit har server ka alag hota hai, to koi spam karke Groq ka quota khatam kar sakta hai. console.upstash.com → Create Database (free) → REST API. |
| `RESEND_API_KEY` | owner ko email alerts (Part N) |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | errors ka pata chalne ke liye (Part N) |
| `GEMINI_API_KEY` | documents ki meaning-based search |

**Optional:** `LANGFUSE_*`, `ANTHROPIC_API_KEY` (Claude ke liye), `RAZORPAY_*` (Step 6), Inngest (Step 7).

`NEXT_PUBLIC_` wale variables badalne ke baad **Redeploy** karna padta hai: Deployments → latest deployment → ⋯ → **Redeploy**.

---

## Step 4: Supabase mein live URL allow karo (login ke liye)

Supabase → **Authentication → URL Configuration**:
- **Site URL**: `https://swagat-ai.vercel.app`
- **Redirect URLs** mein add karo: `https://swagat-ai.vercel.app/auth/callback`
- `http://localhost:3000/auth/callback` bhi rehne do, taaki local bhi chalta rahe.

Ye nahi kiya to magic link wapas localhost par le jayega.

---

## Step 5: Live site check karo (smoke test)

Live URL par ek-ek karke ye check karo:
1. `/login` → apna email daalo → magic link se login hona chahiye → dashboard khulega.
2. Dashboard → Settings: business ki details dikhni chahiye, ek price badal ke save karo.
3. `/try/shahid-q9en` → chat karo: "fees kitni hai", phir "kal appointment chahiye" → slot tap → naam aur number.
4. Razorpay ke bina live site par booking **seedha confirm** hoti hai, kyunki test payment page production mein band hai. Bookings page par confirmed booking dikhni chahiye.
5. "doctor se baat karni hai" likho → Inbox mein chat aaye, aur `RESEND_API_KEY` hai to email bhi aaye.
6. Dashboard → **Channels** → embed code copy karo → apni ya kisi test website mein paste karo → bubble aana chahiye.
7. Apne computer se eval chalao, live site par:

```bash
npm run eval -- --url https://swagat-ai.vercel.app --business shahid-q9en
```

---

## Step 6 (optional): Razorpay live par

Pehle **test keys** ke saath live site par try karo:
1. Vercel env mein `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` aur `RAZORPAY_WEBHOOK_SECRET` daalo, phir redeploy karo.
2. Razorpay → Settings → **Webhooks** → Add:
   - URL: `https://swagat-ai.vercel.app/api/razorpay/webhook`
   - Events: `payment_link.paid`, `payment_link.expired`, `payment_link.cancelled`
   - Secret: wahi jo `RAZORPAY_WEBHOOK_SECRET` mein daala
3. Booking karo, `success@razorpay` UPI se pay karo. Booking confirm ho jani chahiye.

Asli paise ke liye Razorpay KYC complete karo, live keys lo, aur live mode mein naya webhook banao.

---

## Step 7 (optional): Inngest (bade PDFs ke liye)

Inngest ke bina bhi PDF upload chalta hai: upload ke turant baad server PDF padhta hai (60 second tak). Bade PDFs ya retries chahiye to:
Vercel → Project → **Integrations** → **Inngest** → Install. Ye `INNGEST_EVENT_KEY` aur `INNGEST_SIGNING_KEY` apne aap set kar deta hai. Phir redeploy karo.

---

## Step 8 (optional): Apna domain

Vercel → Project → **Settings → Domains** → domain add karo (jaise `app.swagatai.in`) → jo DNS record Vercel bataye wo apne domain provider par daalo.
Uske baad `NEXT_PUBLIC_APP_URL`, Supabase ke URLs aur Razorpay webhook, teeno ko naye domain par update karo, phir redeploy.

---

## Deploy ke baad roz ka kaam

- **Code update:** `git add . && git commit -m "..." && git push` karo. Vercel apne aap naya deploy kar deta hai.
- **Nayi migration aaye:** `cd packages/db && npx supabase db push`, aur ye code push karne se **pehle** karo.
- **Errors:** Sentry email karega. Vercel → Project → **Logs** mein bhi `[chat]`, `[alerts]`, `[razorpay]` waali lines dikhti hain.
- **Groq free limit:** din ke 1000 requests. Ek clinic ke liye kaafi hain. Zyada traffic aaye to Groq Developer plan lo (bahut sasta), ya ek clinic ko `LLM_PROVIDER=claude` par daalo.

## Agar kuch na chale

| Problem | Solution |
|---|---|
| Build fail: "Cannot find module @frontdesk/core" | Root Directory `apps/web` hai? Build command badli to nahi? |
| Login link localhost par le jaata hai | Step 4 nahi hua, ya Site URL galat hai. |
| Chat mein "Kuch gadbad ho gayi" | Vercel → Logs mein `[chat] agent failed` dekho. Zyadatar `GROQ_API_KEY` missing hoti hai, ya Groq ki daily limit khatam ho jaati hai. |
| Embed code mein localhost likha hai | `NEXT_PUBLIC_APP_URL` set karo aur redeploy karo. |
| Widget kisi site par nahi khulta | Settings → Channels → Allowed websites mein us site ka domain hai? |
| Razorpay se pay kiya par booking confirm nahi hui | Razorpay → Webhooks mein delivery status dekho. URL aur secret sahi hain? Tab tak Bookings se "Mark paid" kar sakte ho. |
