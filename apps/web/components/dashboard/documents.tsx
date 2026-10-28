"use client";

import { AlertCircle, CheckCircle2, FileText, Globe, Loader2, RotateCw, Trash2, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { deleteDocument, reindexDocument, uploadDocument, type ActionResult } from "@/app/(dashboard)/dashboard/knowledge/actions";
import { Badge } from "@/components/ui/badge";
import type { KnowledgeDoc } from "@/lib/data/knowledge";
import { cn, relativeTime } from "@/lib/utils";

const MAX_BYTES = 10 * 1024 * 1024;
const isWorking = (d: KnowledgeDoc) => d.status === "pending" || d.status === "processing";

/**
 * PDF upload and the list of what the AI has learned. Uploading returns as
 * soon as the file is stored; a background job reads it. While anything is
 * still processing, the list refreshes every 2 seconds.
 */
export function Documents({ docs, canEmbed, live }: { docs: KnowledgeDoc[]; canEmbed: boolean; live: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Demo data never finishes processing, so only poll real documents.
  const working = live && docs.some(isWorking);
  useEffect(() => {
    if (!working) return;
    const timer = setInterval(() => router.refresh(), 2000);
    return () => clearInterval(timer);
  }, [working, router]);

  const add = async (files: FileList | null) => {
    setError(null);
    for (const file of Array.from(files ?? [])) {
      if (file.type && file.type !== "application/pdf") {
        setError(`${file.name} isn't a PDF.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        setError(`${file.name} is over 10 MB.`);
        continue;
      }
      setUploading((u) => [...u, file.name]);
      const form = new FormData();
      form.set("file", file);
      try {
        const result = await uploadDocument(form);
        if (!result.ok) setError(result.error);
      } catch {
        setError(`Couldn't upload ${file.name}. Check your connection and try again.`);
      } finally {
        setUploading((u) => u.filter((n) => n !== file.name));
      }
    }
    if (input.current) input.current.value = "";
    router.refresh();
  };

  return (
    <div className="space-y-4 p-5">
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void add(e.dataTransfer.files);
        }}
        className={cn(
          "flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition",
          dragging ? "border-brand-500 bg-brand-50" : "border-black/10 hover:border-brand-300 hover:bg-brand-50/40",
        )}
      >
        <span className="grid size-11 place-items-center rounded-xl bg-white shadow-soft ring-1 ring-black/5">
          {uploading.length ? <Loader2 className="size-5 animate-spin text-brand-600" /> : <UploadCloud className="size-5 text-brand-600" />}
        </span>
        <span className="text-sm font-semibold">{uploading.length ? `Uploading ${uploading[0]}…` : "Drop a PDF or click to upload"}</span>
        <span className="text-xs text-slate-500">Rate cards, FAQs, brochures. Text PDFs up to 10 MB.</span>
      </button>
      <input ref={input} type="file" accept="application/pdf" multiple hidden onChange={(e) => void add(e.target.files)} />

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 ring-1 ring-red-100">
          <AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      )}

      {docs.length === 0 && !uploading.length ? (
        <p className="py-4 text-center text-sm text-slate-500">No documents yet. Upload your rate card or FAQ to start.</p>
      ) : (
        <ul className="divide-y divide-black/5">
          {docs.map((d) => (
            <DocumentRow key={d.id} doc={d} canEmbed={canEmbed} onError={setError} />
          ))}
        </ul>
      )}
    </div>
  );
}

function DocumentRow({ doc: d, canEmbed, onError }: { doc: KnowledgeDoc; canEmbed: boolean; onError: (e: string) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(t);
  }, [confirming]);

  const run = (action: () => Promise<ActionResult>) =>
    start(async () => {
      const r = await action();
      if (!r.ok) onError(r.error);
      router.refresh();
    });

  const detail =
    d.status === "ready"
      ? `${d.chunks} ${d.chunks === 1 ? "section" : "sections"} learned${d.embedded ? "" : " · keyword search"}`
      : d.status === "failed"
        ? (d.error ?? "Couldn't read this document.")
        : "Reading and learning…";

  return (
    <li className="flex items-center gap-3 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
        {d.kind === "url" ? <Globe className="size-4" /> : <FileText className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{d.name}</p>
        <p className={cn("text-xs", d.status === "failed" ? "text-red-600" : "text-slate-400")}>
          {detail} · {relativeTime(d.updated)}
        </p>
      </div>
      {d.status === "ready" ? (
        <Badge tone="green">
          <CheckCircle2 className="size-3" /> Ready
        </Badge>
      ) : d.status === "failed" ? (
        <Badge tone="red">
          <AlertCircle className="size-3" /> Failed
        </Badge>
      ) : (
        <Badge tone="amber">
          <Loader2 className="size-3 animate-spin" /> Processing
        </Badge>
      )}
      <div className="flex shrink-0 items-center">
        {(d.status === "failed" || (d.status === "ready" && canEmbed && !d.embedded)) && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => reindexDocument(d.id))}
            title={d.status === "failed" ? "Retry" : "Re-index with meaning-based search"}
            aria-label={d.status === "failed" ? `Retry ${d.name}` : `Re-index ${d.name}`}
            className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-black/5 hover:text-slate-700 disabled:opacity-50"
          >
            <RotateCw className={cn("size-4", pending && "animate-spin")} />
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => (confirming ? run(() => deleteDocument(d.id)) : setConfirming(true))}
          aria-label={confirming ? `Confirm delete ${d.name}` : `Delete ${d.name}`}
          className={cn(
            "grid h-8 place-items-center rounded-lg px-2 text-xs font-semibold transition disabled:opacity-50",
            confirming ? "bg-red-50 text-red-700 ring-1 ring-red-100" : "text-slate-400 hover:bg-black/5 hover:text-red-600",
          )}
        >
          {confirming ? "Delete?" : <Trash2 className="size-4" />}
        </button>
      </div>
    </li>
  );
}
