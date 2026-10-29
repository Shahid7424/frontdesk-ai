import {
  ArrowRight,
  BadgeIndianRupee,
  BellRing,
  BookOpenCheck,
  CalendarClock,
  ChartNoAxesColumn,
  Check,
  Code2,
  Dumbbell,
  FileUp,
  GraduationCap,
  Hand,
  Languages,
  Megaphone,
  MessageCircle,
  PhoneMissed,
  Repeat,
  Scissors,
  ShieldCheck,
  Smile,
  Sparkles,
  Stethoscope,
  UserX,
  UtensilsCrossed,
} from "lucide-react";
import { HeroChat } from "@/components/marketing/hero-chat";
import { Verticals } from "@/components/marketing/verticals";
import { ButtonLink } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <IndustryStrip />
      <Problems />
      <HowItWorks />
      <Features />
      <section id="industries" className="scroll-mt-24 py-20 sm:py-28">
        <div className="container-page">
          <SectionTitle
            eyebrow="Made for your business"
            title={
              <>
                One receptionist, <Accent>trained on you</Accent>
              </>
            }
            body="Swagat AI learns your services, prices and timings, so a clinic gets clinic answers, an agency gets agency answers and a salon gets salon answers."
          />
          <div className="mt-12">
            <Verticals />
          </div>
        </div>
      </section>
      <Trust />
      <Faq />
      <FinalCta />
    </>
  );
}

/** One or two words of a headline in the display serif. */
function Accent({ children }: { children: React.ReactNode }) {
  return <span className="text-gradient pr-1 font-serif font-normal tracking-normal italic">{children}</span>;
}

function Hero() {
  return (
    <section className="relative -mt-[68px] overflow-hidden pt-[68px]">
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="bg-grid absolute inset-0" />
        <div className="absolute -top-40 right-[-10%] size-[620px] rounded-full bg-brand-300/40 blur-[120px]" />
        <div className="absolute top-40 -left-40 size-[420px] rounded-full bg-saffron-300/35 blur-[110px]" />
      </div>
      <div className="container-page grid items-center gap-16 pt-16 pb-20 sm:pt-24 lg:grid-cols-[1.12fr_1fr] lg:gap-10 lg:pb-28">
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/80 py-1 pr-3 pl-1 text-[13px] font-medium text-ink/70 shadow-soft ring-1 ring-black/[0.06] backdrop-blur">
            <span className="rounded-full bg-gradient-to-r from-brand-600 to-brand-800 px-2 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase">
              New
            </span>
            Replies in Hinglish, Hindi &amp; English
          </span>
          <h1 className="mt-7 text-[2.75rem] leading-[1.02] font-extrabold tracking-[-0.04em] text-balance sm:text-[4.1rem]">
            Every customer gets a warm <Accent>swagat.</Accent> Even at 11 PM.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-pretty text-ink/65">
            {BRAND.name} is the AI receptionist that chats with customers on your website, books appointments and
            collects UPI advances. 24×7, using only your own business information. WhatsApp is coming next.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/demo" size="lg" className="shadow-glow">
              Try the live demo <ArrowRight className="size-4" />
            </ButtonLink>
            <ButtonLink href="/dashboard" size="lg" variant="secondary" className="bg-white/80 backdrop-blur">
              See the owner dashboard
            </ButtonLink>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-ink/55">
            {["Live in one evening", "No app for customers", "DPDP consent built in"].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check className="size-3.5 text-brand-600" strokeWidth={3} /> {t}
              </li>
            ))}
          </ul>
          <dl className="mt-10 grid max-w-lg grid-cols-3 divide-x divide-black/[0.07] rounded-2xl bg-white/70 py-4 shadow-soft ring-1 ring-black/[0.06] backdrop-blur">
            {[
              ["24×7", "replies, even at 11 PM"],
              ["< 3 sec", "to the first answer"],
              ["1 line", "of code to go live"],
            ].map(([k, v]) => (
              <div key={k} className="px-4">
                <dt className="text-xl font-extrabold tracking-tight">{k}</dt>
                <dd className="mt-0.5 text-[12.5px] leading-snug text-ink/50">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <HeroChat />
      </div>
    </section>
  );
}

const industries = [
  { icon: Stethoscope, label: "Clinics" },
  { icon: Smile, label: "Dental care" },
  { icon: Megaphone, label: "Digital agencies" },
  { icon: Scissors, label: "Salons & spas" },
  { icon: GraduationCap, label: "Coaching" },
  { icon: Dumbbell, label: "Gyms & studios" },
  { icon: UtensilsCrossed, label: "Restaurants" },
];

function IndustryStrip() {
  return (
    <section aria-label="Industries" className="border-y border-black/[0.06] bg-white/70 py-6">
      <div className="container-page flex flex-col items-center gap-4 sm:flex-row sm:gap-8">
        <p className="shrink-0 text-xs font-semibold tracking-wider text-ink/40 uppercase">Built for</p>
        <div className="relative w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
          <ul className="flex w-max animate-marquee gap-3">
            {[...industries, ...industries].map(({ icon: Icon, label }, i) => (
              <li
                key={i}
                aria-hidden={i >= industries.length}
                className="flex items-center gap-2 rounded-full bg-canvas px-4 py-2 text-sm font-semibold text-ink/70 ring-1 ring-black/[0.05]"
              >
                <Icon className="size-4 text-brand-600" /> {label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function SectionTitle({ eyebrow, title, body }: { eyebrow: string; title: React.ReactNode; body?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold tracking-wider text-brand-700 uppercase ring-1 ring-brand-100">
        {eyebrow}
      </p>
      <h2 className="mt-4 text-3xl font-extrabold tracking-[-0.035em] text-balance sm:text-[2.75rem] sm:leading-[1.08]">
        {title}
      </h2>
      {body && <p className="mt-4 text-lg leading-relaxed text-pretty text-ink/60">{body}</p>}
    </div>
  );
}

function Problems() {
  const items = [
    {
      icon: PhoneMissed,
      title: "Messages go unanswered in rush hours",
      body: "When your team is busy with walk-ins and calls, the WhatsApp pings pile up and the customer books somewhere else.",
    },
    {
      icon: Repeat,
      title: "The same 20 questions, every single day",
      body: "Prices, timings, address, “discount milega?”. Your staff spends hours typing the same replies.",
    },
    {
      icon: UserX,
      title: "No-shows eat your empty slots",
      body: "Bookings made on a call with no advance and no reminder often don't turn up.",
    },
  ];
  return (
    <section className="py-20 sm:py-28">
      <div className="container-page">
        <SectionTitle eyebrow="Sound familiar?" title="Every missed message is a missed customer" />
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {items.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="group relative overflow-hidden rounded-3xl bg-white p-7 shadow-soft ring-1 ring-black/[0.06] transition hover:-translate-y-0.5 hover:shadow-lift"
            >
              <div
                aria-hidden
                className="absolute -top-16 -right-16 size-40 rounded-full bg-rose-100/70 blur-2xl transition group-hover:bg-rose-200/70"
              />
              <span className="relative grid size-11 place-items-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-100">
                <Icon className="size-5" />
              </span>
              <h3 className="relative mt-5 text-lg font-bold tracking-tight">{title}</h3>
              <p className="relative mt-2 leading-relaxed text-ink/60">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: FileUp,
      title: "Add your business info",
      body: "Services, prices, timings and team. Upload your rate card or FAQ PDF. Takes about 10 minutes.",
    },
    {
      icon: Code2,
      title: "Connect your website",
      body: "Paste one script tag on your site. WhatsApp Business connects next, on the same brain.",
    },
    {
      icon: MessageCircle,
      title: "Swagat AI handles the chats",
      body: "It answers, books slots and collects advances. You step in from the inbox whenever you want.",
    },
  ];
  return (
    <section id="how" className="scroll-mt-24 border-y border-black/[0.06] bg-white py-20 sm:py-28">
      <div className="container-page">
        <SectionTitle
          eyebrow="How it works"
          title={
            <>
              Live on your website <Accent>in one evening</Accent>
            </>
          }
        />
        <ol className="relative mt-16 grid gap-6 md:grid-cols-3">
          <div
            aria-hidden
            className="absolute top-12 right-[16%] left-[16%] hidden h-px bg-gradient-to-r from-transparent via-brand-300 to-transparent md:block"
          />
          {steps.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="relative text-center">
              <span className="relative mx-auto grid size-24 place-items-center rounded-[28px] bg-gradient-to-b from-white to-brand-50 shadow-soft ring-1 ring-brand-100">
                <Icon className="size-8 text-brand-700" strokeWidth={1.75} />
                <span className="absolute -top-2 -right-2 grid size-8 place-items-center rounded-full bg-ink text-xs font-bold text-white ring-4 ring-white">
                  {i + 1}
                </span>
              </span>
              <h3 className="mt-6 text-lg font-bold tracking-tight">{title}</h3>
              <p className="mx-auto mt-2 max-w-xs leading-relaxed text-ink/60">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="relative scroll-mt-24 overflow-hidden bg-ink py-20 text-white sm:py-28">
      <div aria-hidden className="absolute inset-0">
        <div className="absolute -top-40 left-1/2 size-[700px] -translate-x-1/2 rounded-full bg-brand-700/40 blur-[140px]" />
        <div className="absolute right-0 bottom-0 size-[360px] rounded-full bg-saffron-500/15 blur-[120px]" />
      </div>
      <div className="relative container-page">
        <div className="mx-auto max-w-2xl text-center">
          <p className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold tracking-wider text-brand-200 uppercase ring-1 ring-white/15">
            Features
          </p>
          <h2 className="mt-4 text-3xl font-extrabold tracking-[-0.035em] text-balance sm:text-[2.75rem] sm:leading-[1.08]">
            Everything a great receptionist does.{" "}
            <span className="font-serif font-normal tracking-normal text-saffron-300 italic">Minus the hold music.</span>
          </h2>
        </div>

        <div className="mt-14 grid gap-4 lg:grid-cols-3">
          {/* Big tile: grounded answers */}
          <Tile className="lg:col-span-2" icon={BookOpenCheck} title="Answers from your data, with sources">
            Every answer comes from your rate card, FAQ or PDFs. If it isn't there, Swagat AI says so instead of
            guessing.
            <div className="mt-6 flex flex-wrap gap-2">
              {["Rate card.pdf", "Services & prices", "FAQ: Parking", "Timings"].map((s) => (
                <span key={s} className="rounded-full bg-white/[0.06] px-3 py-1 text-xs text-white/70 ring-1 ring-white/10">
                  {s}
                </span>
              ))}
            </div>
          </Tile>
          <Tile icon={Languages} title="Speaks like your customers">
            “Kal shaam ka slot milega?” works just as well as formal English. Customers can switch to Hindi or English in one tap.
          </Tile>
          <Tile icon={CalendarClock} title="Books without double-booking">
            Real-time availability per team member. Two people can never get the same slot.
          </Tile>
          <Tile icon={BadgeIndianRupee} title="UPI payment links">
            Collect an advance by GPay, PhonePe or Paytm. The booking confirms itself when payment lands.
          </Tile>
          <Tile icon={Hand} title="You take over anytime">
            Complaints or tricky questions go to your inbox instantly, with an email alert.
          </Tile>
          <Tile className="lg:col-span-2" icon={ChartNoAxesColumn} title="See exactly what it does for you">
            Conversations handled, bookings made and what each conversation costs, on one clean dashboard.
            <div className="mt-6 flex h-16 items-end gap-1.5" aria-hidden>
              {[40, 62, 48, 75, 58, 88, 70, 95, 80, 100, 86, 92].map((h, i) => (
                <span
                  key={i}
                  className="flex-1 rounded-t-md bg-gradient-to-t from-brand-600/60 to-brand-300"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </Tile>
          <Tile icon={BellRing} title="Never miss a booking">
            The owner gets an email for every new booking, cancel, refund request and handoff.
          </Tile>
        </div>
      </div>
    </section>
  );
}

function Tile({
  icon: Icon,
  title,
  children,
  className = "",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-3xl bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-7 ring-1 ring-white/10 transition hover:ring-white/20 ${className}`}
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-300/50 to-transparent opacity-0 transition group-hover:opacity-100"
      />
      <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-b from-brand-500/30 to-brand-700/20 text-brand-200 ring-1 ring-brand-300/25">
        <Icon className="size-5" />
      </span>
      <h3 className="mt-5 text-lg font-bold tracking-tight">{title}</h3>
      <div className="mt-2 max-w-xl leading-relaxed text-white/60">{children}</div>
    </div>
  );
}

function Trust() {
  const points = [
    ["Never makes up prices", "Answers only from information you approved. Unsure? It hands over to you."],
    ["Your data stays yours", "Each business is fully isolated. Customer data is never used to train models."],
    ["Consent built in", "Customers see a clear consent line and can ask for their data to be deleted (DPDP Act ready)."],
    ["Safe actions only", "The AI can't edit your database directly. It can only use a few checked actions like booking a slot."],
  ];
  return (
    <section id="trust" className="scroll-mt-24 border-y border-black/[0.06] bg-white py-20 sm:py-28">
      <div className="container-page grid items-start gap-12 lg:grid-cols-[1fr_1.2fr]">
        <div className="lg:sticky lg:top-28">
          <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-900 text-white shadow-glow">
            <ShieldCheck className="size-7" />
          </span>
          <h2 className="mt-6 text-3xl font-extrabold tracking-[-0.035em] text-balance sm:text-[2.75rem] sm:leading-[1.08]">
            Built for businesses that handle <Accent>trust,</Accent> not just traffic.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink/60">
            Patients share health details. Parents share their kids' details. Clients share their budgets.{" "}
            {BRAND.name} is designed to be helpful without ever being reckless.
          </p>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          {points.map(([title, body]) => (
            <div key={title} className="rounded-3xl bg-canvas p-6 ring-1 ring-black/[0.05]">
              <dt className="flex items-center gap-2.5 font-bold tracking-tight">
                <span className="grid size-6 place-items-center rounded-full bg-emerald-500 text-white">
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
                {title}
              </dt>
              <dd className="mt-3 text-[15px] leading-relaxed text-ink/60">{body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function Faq() {
  const faqs = [
    [
      "Do my customers need to install anything?",
      "No. They chat in the bubble on your website, and soon on WhatsApp, which they already use.",
    ],
    [
      "What if the AI doesn't know the answer?",
      "It says it isn't sure and passes the conversation to you. You get an email and can reply from the dashboard.",
    ],
    [
      "Will it work for my kind of business?",
      "If customers ask you about services, prices, timings and bookings, yes. Clinics, agencies, salons, coaching centres and studios all use the same setup.",
    ],
    [
      "Can I use my existing WhatsApp number?",
      "WhatsApp is next on our roadmap. When it launches you can connect your WhatsApp Business number, and until then your website chat works on its own.",
    ],
    [
      "How much does it cost?",
      "Pilots are free while we onboard our first businesses. After that it's a simple monthly plan, and you'll see exactly what each conversation costs in your dashboard.",
    ],
  ];
  return (
    <section id="faq" className="scroll-mt-24 py-20 sm:py-28">
      <div className="container-page max-w-3xl">
        <SectionTitle eyebrow="FAQ" title="Questions owners ask us" />
        <div className="mt-12 space-y-3">
          {faqs.map(([q, a]) => (
            <details
              key={q}
              className="group rounded-2xl bg-white px-6 py-5 shadow-soft ring-1 ring-black/[0.06] open:ring-brand-200 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16.5px] font-semibold tracking-tight">
                {q}
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-50 text-lg leading-none text-brand-700 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 pr-10 leading-relaxed text-ink/60">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="pb-20 sm:pb-24">
      <div className="container-page">
        <div className="relative overflow-hidden rounded-[36px] bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 px-6 py-16 text-center text-white shadow-lift sm:px-12 sm:py-24">
          <div aria-hidden className="absolute inset-0">
            <div className="bg-grid absolute inset-0 opacity-40 invert" />
            <div className="absolute -top-24 left-1/2 size-[520px] -translate-x-1/2 rounded-full bg-brand-400/40 blur-[100px]" />
            <div className="absolute -right-20 -bottom-24 size-[320px] rounded-full bg-saffron-400/30 blur-[90px]" />
          </div>
          <div className="relative">
            <Sparkles className="mx-auto size-8 text-saffron-300" />
            <h2 className="mx-auto mt-5 max-w-2xl text-3xl font-extrabold tracking-[-0.035em] text-balance sm:text-5xl sm:leading-[1.05]">
              See it welcome a customer, <span className="font-serif font-normal tracking-normal italic">right now.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-white/70">
              Ask about prices, book a slot and see the payment step on a demo business. It takes one minute.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <ButtonLink href="/demo" size="lg" variant="secondary" className="ring-0">
                Open the demo <ArrowRight className="size-4" />
              </ButtonLink>
              <ButtonLink
                href={`mailto:${BRAND.contactEmail}?subject=${encodeURIComponent(`${BRAND.name} pilot`)}`}
                size="lg"
                className="bg-none bg-white/10 shadow-none ring-1 ring-white/25 hover:bg-white/15"
              >
                Join the free pilot
              </ButtonLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
