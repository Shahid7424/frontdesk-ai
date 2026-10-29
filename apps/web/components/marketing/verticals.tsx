"use client";

import { GraduationCap, Megaphone, Scissors, Stethoscope, UtensilsCrossed } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const verticals = [
  {
    id: "clinic",
    label: "Clinics",
    icon: Stethoscope,
    questions: ["Dr. sahab Sunday ko baithte hain?", "PFT ke pehle khana kha sakte hain?", "Report kab milegi?"],
    outcome: "Books consultations, shares prep instructions and sends reports reminders, without the receptionist leaving the OPD desk.",
  },
  {
    id: "agency",
    label: "Agencies",
    icon: Megaphone,
    questions: ["Website banwane ka kitna lagega?", "SEO package mein kya kya hai?", "Kal discovery call ho sakti hai?"],
    outcome: "Qualifies leads, shares packages and pricing, and books discovery calls straight into your team's calendar.",
  },
  {
    id: "salon",
    label: "Salons",
    icon: Scissors,
    questions: ["Bridal makeup ka package kitne ka hai?", "Aaj shaam 6 baje haircut ho jayega?", "Keratin kitne time chalta hai?"],
    outcome: "Fills empty chairs with last-minute slots, collects an advance for long services and cuts no-shows.",
  },
  {
    id: "coaching",
    label: "Coaching",
    icon: GraduationCap,
    questions: ["JEE batch ki fees installment mein hai?", "Demo class kab hai?", "Batch timing weekend ki hai?"],
    outcome: "Answers parents at 11 PM, books demo classes and sends fee links, so counsellors only talk to serious leads.",
  },
  {
    id: "restaurant",
    label: "Restaurants",
    soon: true,
    icon: UtensilsCrossed,
    questions: ["Saturday raat 8 baje 6 logon ki table milegi?", "Jain food available hai?", "Birthday ke liye cake arrange hoga?"],
    outcome: "Table bookings, menu questions and party enquiries, answered while your staff runs the floor. Coming soon.",
  },
];

export function Verticals() {
  const [active, setActive] = useState(verticals[0]!.id);
  const v = verticals.find((x) => x.id === active)!;

  return (
    <div className="grid gap-8 lg:grid-cols-[280px_1fr] lg:gap-12">
      <div role="tablist" aria-label="Business type" className="flex gap-2 overflow-x-auto lg:flex-col">
        {verticals.map(({ id, label, icon: Icon, soon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={active === id}
            onClick={() => setActive(id)}
            className={cn(
              "flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 text-left text-[15px] font-semibold transition-all",
              active === id
                ? "bg-white shadow-soft ring-1 ring-brand-200"
                : "text-ink/60 hover:bg-white/60 hover:text-ink",
            )}
          >
            <span
              className={cn(
                "grid size-9 place-items-center rounded-xl transition-colors",
                active === id ? "bg-gradient-to-br from-brand-500 to-brand-800 text-white shadow-md shadow-brand-900/20" : "bg-black/5",
              )}
            >
              <Icon className="size-[18px]" />
            </span>
            {label}
            {soon && (
              <span className="ml-auto rounded-full bg-saffron-100 px-2 py-0.5 text-[10.5px] font-bold tracking-wide text-saffron-600 uppercase">
                Soon
              </span>
            )}
          </button>
        ))}
      </div>

      <div role="tabpanel" key={v.id} className="relative animate-fade-up overflow-hidden rounded-3xl bg-white p-6 shadow-soft ring-1 ring-black/[0.06] sm:p-8">
        <div aria-hidden className="absolute -top-20 -right-20 size-56 rounded-full bg-brand-100/80 blur-3xl" />
        <p className="relative text-sm font-semibold text-brand-700">Customers ask things like</p>
        <ul className="relative mt-4 flex flex-col gap-2.5">
          {v.questions.map((q) => (
            <li
              key={q}
              className="w-fit max-w-full rounded-2xl rounded-tl-md bg-canvas px-4 py-2.5 text-[15px] ring-1 ring-black/5"
            >
              “{q}”
            </li>
          ))}
        </ul>
        <p className="relative mt-6 flex gap-3 border-t border-black/5 pt-6 text-[15px] leading-relaxed text-ink/75">
          <span className="mt-0.5 shrink-0 rounded-full bg-brand-700 px-2 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase">
            AI
          </span>
          {v.outcome}
        </p>
      </div>
    </div>
  );
}
