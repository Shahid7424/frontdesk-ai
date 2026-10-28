"use client";

import { AlertCircle, Loader2, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { addQuickAnswer, deleteDocument } from "@/app/(dashboard)/dashboard/knowledge/actions";
import { Button } from "@/components/ui/button";
import { CardHeader } from "@/components/ui/card";
import type { KnowledgeDoc } from "@/lib/data/knowledge";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-xl border border-black/10 bg-white px-3.5 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

/** Short facts the owner types in. Each one becomes a single searchable chunk. */
export function QuickAnswers({ items }: { items: KnowledgeDoc[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, start] = useTransition();

  const working = items.some((i) => i.status === "pending" || i.status === "processing");
  useEffect(() => {
    if (!working) return;
    const timer = setInterval(() => router.refresh(), 2000);
    return () => clearInterval(timer);
  }, [working, router]);

  const save = () =>
    start(async () => {
      setError(null);
      const r = await addQuickAnswer({ title, answer });
      if (!r.ok) return setError(r.error);
      setTitle("");
      setAnswer("");
      setOpen(false);
      router.refresh();
    });

  return (
    <>
      <CardHeader
        title="Quick answers"
        description="Short facts the AI should always get right."
        action={
          !open && (
            <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
              <Plus className="size-4" /> Add
            </Button>
          )
        }
      />
      <div className="px-5 pb-3">
        {open && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
            className="mt-4 space-y-2.5 rounded-xl bg-slate-50 p-3.5 ring-1 ring-black/5"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">New quick answer</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="size-4" />
              </button>
            </div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Topic, e.g. Parking"
              maxLength={80}
              className={cn(field, "h-10")}
            />
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="The answer, e.g. Two-wheeler parking in front, car parking in the basement."
              maxLength={2000}
              rows={3}
              className={cn(field, "py-2.5")}
            />
            {error && (
              <p role="alert" className="flex items-center gap-1.5 text-sm text-red-600">
                <AlertCircle className="size-4" /> {error}
              </p>
            )}
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin" />} Save
              </Button>
            </div>
          </form>
        )}

        {items.length === 0 && !open ? (
          <p className="py-6 text-center text-sm text-slate-500">
            Add facts like fees, parking or cancellation policy. The AI uses them word for word.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-black/5">
            {items.map((k) => (
              <QuickAnswerRow key={k.id} item={k} onError={setError} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function QuickAnswerRow({ item: k, onError }: { item: KnowledgeDoc; onError: (e: string) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <li className="group py-3.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{k.name}</p>
        <div className="flex items-center gap-2">
          {k.status === "failed" ? (
            <span className="text-xs text-red-600">Not saved to search</span>
          ) : k.status !== "ready" ? (
            <Loader2 className="size-3.5 animate-spin text-slate-400" />
          ) : null}
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await deleteDocument(k.id);
                if (!r.ok) onError(r.error);
                router.refresh();
              })
            }
            aria-label={`Delete ${k.name}`}
            className="text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-red-600 focus-visible:opacity-100"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-500">{k.content}</p>
    </li>
  );
}
