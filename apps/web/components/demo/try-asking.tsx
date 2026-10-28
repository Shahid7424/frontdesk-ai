"use client";

import { MessageCircleQuestion } from "lucide-react";

const prompts = [
  "Consultation fees kitni hai?",
  "Kal Dr. Kulkarni ka appointment chahiye",
  "Sunday ko clinic khula hai?",
  "Parking hai kya?",
  "Mujhe doctor se baat karni hai",
  "Do you do home visits?",
];

/** Lets visitors drive the embedded widget through its public JS API. */
export function TryAsking() {
  const ask = (text: string) => {
    if (window.FrontDesk) window.FrontDesk.ask(text);
    else (window.FrontDesk = { _queue: [["ask", text]] } as unknown as typeof window.FrontDesk);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {prompts.map((p) => (
        <button
          key={p}
          onClick={() => ask(p)}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-medium text-white ring-1 ring-white/20 transition-colors hover:bg-white/20"
        >
          <MessageCircleQuestion className="size-3.5 opacity-70" />
          {p}
        </button>
      ))}
    </div>
  );
}

declare global {
  interface Window {
    FrontDesk?: {
      open: () => void;
      close: () => void;
      ask: (text: string) => void;
      _queue?: Array<["open" | "close" | "ask", string?]>;
    };
  }
}
