import { Clock, MapPin, Phone, Star } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { TryAsking } from "@/components/demo/try-asking";
import { LogoMark } from "@/components/ui/logo";
import { DEMO_BUSINESS_ID, demoClinic, services, staff } from "@/lib/mock/demo-clinic";
import { formatRupees } from "@frontdesk/core";

export const metadata: Metadata = {
  title: "Live demo",
  description: "Chat with Swagat AI on a demo clinic website.",
};

/**
 * A fictional clinic website with the real widget embedded through the
 * same <script> tag a customer would paste. What you test here is exactly
 * what ships.
 */
export default function DemoPage() {
  return (
    <div className="min-h-dvh bg-[#fbfaf7]">
      {/* Demo guide bar */}
      <div className="bg-ink text-white">
        <div className="container-page flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" aria-label="Swagat AI home">
              <LogoMark className="size-7" />
            </Link>
            <p className="text-sm">
              <span className="font-semibold">Live demo.</span>{" "}
              <span className="text-white/70">This is a made-up clinic. The chat bubble is Swagat AI. Try:</span>
            </p>
          </div>
          <TryAsking />
        </div>
      </div>

      {/* Fictional clinic website */}
      <header className="border-b border-stone-200 bg-white">
        <div className="container-page flex h-16 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-full bg-orange-500 text-lg text-white">☀</span>
            <div className="leading-tight">
              <p className="font-serif text-lg font-semibold text-stone-900">{demoClinic.name}</p>
              <p className="text-xs text-stone-500">{demoClinic.area}</p>
            </div>
          </div>
          <nav className="hidden gap-6 text-sm text-stone-600 sm:flex">
            <a href="#services">Services</a>
            <a href="#doctors">Doctors</a>
            <a href="#visit">Visit us</a>
          </nav>
        </div>
      </header>

      <section className="bg-gradient-to-b from-orange-50 to-[#fbfaf7]">
        <div className="container-page py-16 sm:py-24">
          <p className="flex items-center gap-1 text-sm text-orange-700">
            <Star className="size-4 fill-current" /> Family care since 2009
          </p>
          <h1 className="mt-4 max-w-2xl font-serif text-4xl leading-tight font-semibold text-stone-900 sm:text-5xl">
            Caring for Baner's families, from coughs to chronic asthma.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-stone-600">
            General medicine, chest & lung care and physiotherapy under one roof. Book in seconds through our chat
            assistant, any time of day.
          </p>
        </div>
      </section>

      <section id="services" className="container-page py-14">
        <h2 className="font-serif text-2xl font-semibold text-stone-900">Services & fees</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <div key={s.id} className="rounded-xl border border-stone-200 bg-white p-5">
              <p className="font-semibold text-stone-900">{s.name}</p>
              <p className="mt-1 text-sm text-stone-500">{s.durationMin} min</p>
              <p className="mt-3 text-lg font-semibold text-orange-700">
                {s.pricePaise ? formatRupees(s.pricePaise) : "Free"}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="doctors" className="container-page py-14">
        <h2 className="font-serif text-2xl font-semibold text-stone-900">Our team</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {staff.map((p) => (
            <div key={p.id} className="flex items-center gap-4 rounded-xl border border-stone-200 bg-white p-5">
              <span className="grid size-12 place-items-center rounded-full bg-orange-100 font-semibold text-orange-800">
                {p.name.split(" ").slice(-1)[0]![0]}
              </span>
              <div>
                <p className="font-semibold text-stone-900">{p.name}</p>
                <p className="text-sm text-stone-500">{p.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="visit" className="container-page grid gap-6 pt-14 pb-32 sm:grid-cols-3">
        {[
          { icon: MapPin, title: "Address", body: demoClinic.address },
          { icon: Clock, title: "Timings", body: demoClinic.hours.map((h) => `${h.days}: ${h.time}`).join("\n") },
          { icon: Phone, title: "Phone", body: `${demoClinic.phone} (or just use the chat)` },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-xl border border-stone-200 bg-white p-5">
            <Icon className="size-5 text-orange-600" />
            <p className="mt-3 font-semibold text-stone-900">{title}</p>
            <p className="mt-1 text-sm whitespace-pre-line text-stone-600">{body}</p>
          </div>
        ))}
      </section>

      {/* The exact embed snippet a customer pastes. */}
      <Script src="/widget.js" data-business-id={DEMO_BUSINESS_ID} strategy="afterInteractive" />
    </div>
  );
}
