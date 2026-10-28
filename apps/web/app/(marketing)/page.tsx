import {
  ArrowRight,
  BadgeIndianRupee,
  BookOpenCheck,
  CalendarClock,
  ChartNoAxesColumn,
  Code2,
  FileUp,
  Hand,
  Languages,
  MessageCircle,
  PhoneMissed,
  Repeat,
  ShieldCheck,
  Sparkles,
  UserX,
} from "lucide-react";
import { HeroChat } from "@/components/marketing/hero-chat";
import { Verticals } from "@/components/marketing/verticals";
import { ButtonLink } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <Problems />
      <HowItWorks />
      <Features />
      <section className="py-20 sm:py-28">
        <div className="container-page">
          <SectionTitle
            eyebrow="Made for your business"
            title="Same receptionist, trained on your business"
            body="FrontDesk learns your services, prices and timings, so a salon gets salon answers and a clinic gets clinic answers."
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

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(50%_50%_at_80%_0%,var(--color-brand-100),transparent),radial-gradient(40%_40%_at_0%_30%,var(--color-saffron-100),transparent)]"
      />
      <div className="container-page grid items-center gap-14 pt-14 pb-20 sm:pt-20 lg:grid-cols-[1.1fr_1fr] lg:gap-10 lg:pb-28">
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-[13px] font-medium text-brand-800 shadow-soft ring-1 ring-brand-100">
            <Sparkles className="size-3.5" /> Pilot program open for Pune businesses
          </span>
          <h1 className="mt-6 text-[2.6rem] leading-[1.05] font-extrabold tracking-[-0.035em] text-balance sm:text-6xl">
            The receptionist that <span className="text-brand-700">never misses</span> a customer.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-pretty text-ink/70">
            FrontDesk AI answers questions in Hinglish on WhatsApp and your website, books appointments and sends
            UPI payment links. 24×7, using only your own business information.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/demo" size="lg">
              Try the live demo <ArrowRight className="size-4" />
            </ButtonLink>
            <ButtonLink href="/dashboard" size="lg" variant="secondary">
              See the owner dashboard
            </ButtonLink>
          </div>
          <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-black/[0.07] pt-6">
            {[
              ["24×7", "replies, even at 11 PM"],
              ["Hinglish", "the way customers type"],
              ["1 script tag", "to go live on your site"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-lg font-bold tracking-tight">{k}</dt>
                <dd className="mt-0.5 text-[13px] leading-snug text-ink/55">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <HeroChat />
      </div>
    </section>
  );
}

function SectionTitle({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-semibold tracking-wide text-brand-700 uppercase">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.03em] text-balance sm:text-[2.6rem] sm:leading-[1.1]">
        {title}
      </h2>
      {body && <p className="mt-4 text-lg leading-relaxed text-pretty text-ink/65">{body}</p>}
    </div>
  );
}

function Problems() {
  const items = [
    {
      icon: PhoneMissed,
      title: "Calls go unanswered during rush hours",
      body: "When the front desk is busy with walk-ins, the phone keeps ringing and the customer books somewhere else.",
    },
    {
      icon: Repeat,
      title: "The same 20 questions, every single day",
      body: "Fees, timings, address, parking. Your staff spends hours typing the same replies on WhatsApp.",
    },
    {
      icon: UserX,
      title: "No-shows eat your empty slots",
      body: "Bookings made on a call with no advance and no reminder often don't turn up.",
    },
  ];
  return (
    <section className="border-y border-black/[0.06] bg-white py-16 sm:py-20">
      <div className="container-page grid gap-8 md:grid-cols-3">
        {items.map(({ icon: Icon, title, body }) => (
          <div key={title}>
            <span className="grid size-11 place-items-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100">
              <Icon className="size-5" />
            </span>
            <h3 className="mt-4 text-lg font-bold tracking-tight">{title}</h3>
            <p className="mt-2 leading-relaxed text-ink/65">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: FileUp,
      title: "Add your business info",
      body: "Services, prices, timings and staff. Upload your rate card or FAQ PDF. Takes about 10 minutes.",
    },
    {
      icon: Code2,
      title: "Connect WhatsApp and your website",
      body: "Paste one script tag on your site and link your WhatsApp Business number.",
    },
    {
      icon: MessageCircle,
      title: "FrontDesk handles the chats",
      body: "It answers, books slots and collects advances. You step in from the inbox whenever you want.",
    },
  ];
  return (
    <section id="how" className="scroll-mt-20 py-20 sm:py-28">
      <div className="container-page">
        <SectionTitle eyebrow="How it works" title="Live on your website in one evening" />
        <ol className="relative mt-14 grid gap-6 md:grid-cols-3">
          {steps.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="relative rounded-3xl bg-white p-7 shadow-soft ring-1 ring-black/[0.06]">
              <div className="flex items-center justify-between">
                <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                  <Icon className="size-[22px]" />
                </span>
                <span className="text-5xl font-extrabold tracking-tighter text-black/[0.06]">0{i + 1}</span>
              </div>
              <h3 className="mt-6 text-lg font-bold tracking-tight">{title}</h3>
              <p className="mt-2 leading-relaxed text-ink/65">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Features() {
  const features = [
    {
      icon: BookOpenCheck,
      title: "Answers from your data, with sources",
      body: "Every answer comes from your rate card, FAQ or PDFs. If it isn't there, FrontDesk says so instead of guessing.",
    },
    {
      icon: CalendarClock,
      title: "Books without double-booking",
      body: "Real-time availability per staff member. Two people can never get the same slot.",
    },
    {
      icon: BadgeIndianRupee,
      title: "UPI payment links",
      body: "Collect an advance by GPay, PhonePe or Paytm. The booking confirms itself when payment lands.",
    },
    {
      icon: Languages,
      title: "Speaks Hinglish naturally",
      body: "“Kal shaam ka slot milega?” works just as well as formal English.",
    },
    {
      icon: Hand,
      title: "You take over anytime",
      body: "Complaints or tricky questions go to your inbox instantly. Reply from the dashboard or WhatsApp.",
    },
    {
      icon: ChartNoAxesColumn,
      title: "See what it's doing for you",
      body: "Conversations handled, bookings made, and what each conversation costs, on one dashboard.",
    },
  ];
  return (
    <section id="features" className="scroll-mt-20 bg-ink py-20 text-white sm:py-28">
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold tracking-wide text-brand-300 uppercase">Features</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.03em] text-balance sm:text-[2.6rem] sm:leading-[1.1]">
            Everything a great front desk does. Minus the hold music.
          </h2>
        </div>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-3xl bg-white/[0.04] p-7 ring-1 ring-white/10 transition-colors hover:bg-white/[0.07]"
            >
              <span className="grid size-11 place-items-center rounded-2xl bg-brand-500/15 text-brand-300 ring-1 ring-brand-400/20">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-5 text-lg font-bold tracking-tight">{title}</h3>
              <p className="mt-2 max-w-md leading-relaxed text-white/60">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
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
    <section id="trust" className="scroll-mt-20 py-20 sm:py-28">
      <div className="container-page grid items-start gap-12 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <span className="grid size-12 place-items-center rounded-2xl bg-brand-700 text-white shadow-sm shadow-brand-900/30">
            <ShieldCheck className="size-6" />
          </span>
          <h2 className="mt-6 text-3xl font-extrabold tracking-[-0.03em] text-balance sm:text-[2.6rem] sm:leading-[1.1]">
            Built for businesses that handle trust, not just traffic.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink/65">
            Clinics share health information. Parents share their kids' details. FrontDesk is designed so the AI is
            helpful without ever being reckless.
          </p>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          {points.map(([title, body]) => (
            <div key={title} className="rounded-2xl bg-white p-6 shadow-soft ring-1 ring-black/[0.06]">
              <dt className="font-bold tracking-tight">{title}</dt>
              <dd className="mt-2 text-[15px] leading-relaxed text-ink/65">{body}</dd>
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
      "No. They chat on WhatsApp, which they already use, or in the chat bubble on your website.",
    ],
    [
      "What if the AI doesn't know the answer?",
      "It says it isn't sure and passes the conversation to you. You get a notification and can reply from the dashboard.",
    ],
    [
      "Can I use my existing WhatsApp number?",
      "Yes, once Meta verifies your WhatsApp Business account. Until then we can start with your website chat.",
    ],
    [
      "How much does it cost?",
      "Pilots are free while we onboard our first businesses. After that it's a simple monthly plan, and you'll see exactly what each conversation costs in your dashboard.",
    ],
  ];
  return (
    <section id="faq" className="scroll-mt-20 border-t border-black/[0.06] bg-white py-20 sm:py-28">
      <div className="container-page max-w-3xl">
        <SectionTitle eyebrow="FAQ" title="Questions owners ask us" />
        <div className="mt-12 divide-y divide-black/[0.07] border-y border-black/[0.07]">
          {faqs.map(([q, a]) => (
            <details key={q} className="group py-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-semibold tracking-tight">
                {q}
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-black/5 text-lg leading-none transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 pr-10 leading-relaxed text-ink/65">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="py-20 sm:py-24">
      <div className="container-page">
        <div className="relative overflow-hidden rounded-[32px] bg-brand-800 px-6 py-14 text-center text-white sm:px-12 sm:py-20">
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,var(--color-brand-500),transparent)] opacity-60"
          />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-[-0.03em] text-balance sm:text-5xl">
              Chat with a demo clinic right now.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-white/75">
              Ask about fees, book a slot, and see the payment step. It takes one minute.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <ButtonLink href="/demo" size="lg" variant="secondary">
                Open the demo <ArrowRight className="size-4" />
              </ButtonLink>
              <ButtonLink
                href="mailto:hello@frontdesk.example?subject=FrontDesk%20pilot"
                size="lg"
                className="bg-white/10 ring-1 ring-white/25 hover:bg-white/15"
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
