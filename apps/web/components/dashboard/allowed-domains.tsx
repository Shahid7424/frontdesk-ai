"use client";

import { AlertCircle, Check, Loader2, ShieldCheck, X } from "lucide-react";
import { useState, useTransition } from "react";
import { saveAllowedDomains } from "@/app/(dashboard)/dashboard/widget/actions";
import { Button } from "@/components/ui/button";

/** Lets the owner lock the widget to their own website(s). */
export function AllowedDomains({ initial }: { initial: string[] }) {
  const [domains, setDomains] = useState(initial);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, start] = useTransition();

  const save = (next: string[]) =>
    start(async () => {
      const r = await saveAllowedDomains(next);
      if (!r.ok) return setStatus({ ok: false, text: r.error });
      setDomains(r.domains);
      setDraft("");
      setStatus({ ok: true, text: "Saved" });
      setTimeout(() => setStatus(null), 1800);
    });

  return (
    <div className="space-y-3 rounded-xl bg-slate-50 p-4 ring-1 ring-black/5">
      <div className="flex items-start gap-2.5">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-700" />
        <div>
          <p className="text-sm font-semibold">Allowed websites</p>
          <p className="text-xs text-slate-500">
            {domains.length
              ? "The chat only works on these sites (and their subdomains)."
              : "Empty: the chat works on any website. Add your domain so nobody can copy your widget to their site."}
          </p>
        </div>
      </div>

      {domains.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {domains.map((d) => (
            <li key={d} className="inline-flex items-center gap-1 rounded-full bg-white py-1 pr-1.5 pl-3 text-xs font-medium ring-1 ring-black/10">
              {d}
              <button
                type="button"
                disabled={saving}
                onClick={() => save(domains.filter((x) => x !== d))}
                aria-label={`Remove ${d}`}
                className="grid size-4 place-items-center rounded-full text-slate-400 hover:bg-black/5 hover:text-slate-700"
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) save([...domains, draft]);
        }}
        className="flex gap-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="yourclinic.in"
          aria-label="Website domain"
          className="h-9 flex-1 rounded-lg border border-black/10 bg-white px-3 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
        />
        <Button type="submit" size="sm" variant="secondary" disabled={saving || !draft.trim()}>
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : null} Add
        </Button>
      </form>
      {status && (
        <p role="status" className={`flex items-center gap-1.5 text-xs ${status.ok ? "text-emerald-700" : "text-red-600"}`}>
          {status.ok ? <Check className="size-3.5" /> : <AlertCircle className="size-3.5" />} {status.text}
        </p>
      )}
    </div>
  );
}
