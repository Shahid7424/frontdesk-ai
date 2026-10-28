"use client";

import { readEvents, type Citation } from "@frontdesk/core";
import { FileText, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Lets the owner ask their bot a question and see which sources it used. */
export function TestAi({ businessId }: { businessId: string }) {
  const [question, setQuestion] = useState("Sunday ko kaunse doctor available hain?");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Citation[]>([]);
  const [loading, setLoading] = useState(false);

  const ask = async () => {
    if (!question.trim() || loading) return;
    setLoading(true);
    setAnswer("");
    setSources([]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, messages: [{ role: "user", content: question }] }),
      });
      if (!res.body) throw new Error("No response body");
      for await (const e of readEvents(res.body)) {
        if (e.type === "text") setAnswer((a) => a + e.delta);
        if (e.type === "citations") setSources(e.items);
      }
    } catch {
      setAnswer("Couldn't reach the AI. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask();
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          aria-label="Test question"
          className="h-10 flex-1 rounded-xl border border-black/10 bg-white px-3.5 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
        />
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Ask
        </Button>
      </form>
      {(answer || loading) && (
        <div className="mt-4 rounded-xl bg-brand-50/60 p-4 ring-1 ring-brand-100">
          <p className="text-[14.5px] leading-relaxed text-brand-950">{answer || "Thinking…"}</p>
          {sources.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {sources.map((s) => (
                <span key={s.id} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs text-brand-800 ring-1 ring-brand-100">
                  <FileText className="size-3" /> {s.title}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
