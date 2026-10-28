"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getBusinessContext } from "@/lib/data/business";
import { DOCUMENTS_BUCKET, storagePath } from "@/lib/knowledge/ingest";
import { enqueueIngest } from "@/lib/knowledge/queue";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/monitoring";

export type ActionResult = { ok: true } | { ok: false; error: string };

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const PAGE = "/dashboard/knowledge";

const DEMO: ActionResult = {
  ok: false,
  error: "Demo mode: add your Supabase keys to .env.local to build a real knowledge base.",
};

/**
 * The owner's business, or an error. Writes below go through the user's
 * own Supabase client, so RLS (not this check) is what stops a request
 * from touching another business's documents.
 */
async function ownerBusiness(): Promise<
  { error: ActionResult } | { businessId: string; supabase: Awaited<ReturnType<typeof createClient>> }
> {
  const ctx = await getBusinessContext();
  if (ctx.mode === "demo") return { error: DEMO };
  if (!ctx.user || !ctx.business) return { error: { ok: false, error: "Please log in again." } };
  return { businessId: ctx.business.id, supabase: await createClient() };
}

export async function uploadDocument(formData: FormData): Promise<ActionResult> {
  const owner = await ownerBusiness();
  if ("error" in owner) return owner.error;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a PDF to upload." };
  if (file.size > MAX_PDF_BYTES) return { ok: false, error: `${file.name} is over 10 MB. Compress it or split it.` };
  const bytes = new Uint8Array(await file.arrayBuffer());
  // Check the file itself, not just the name: "%PDF" is how every PDF starts.
  if (String.fromCharCode(...bytes.subarray(0, 4)) !== "%PDF") return { ok: false, error: `${file.name} isn't a PDF.` };

  const id = crypto.randomUUID();
  const path = storagePath(owner.businessId, id);
  const name = file.name.replace(/[\u0000-\u001f]/g, "").slice(0, 120) || "Document.pdf";

  const { error } = await owner.supabase.from("documents").insert({
    id,
    business_id: owner.businessId,
    name,
    kind: "pdf",
    storage_path: path,
    size_bytes: file.size,
  });
  if (error) {
    reportError("[knowledge] insert document failed", error);
    return { ok: false, error: "Couldn't save the document. Please try again." };
  }

  const upload = await createServiceClient()
    .storage.from(DOCUMENTS_BUCKET)
    .upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (upload.error) {
    reportError("[knowledge] storage upload failed", upload.error);
    await owner.supabase.from("documents").delete().eq("id", id);
    return {
      ok: false,
      error: /bucket/i.test(upload.error.message)
        ? "Storage isn't set up yet. Run `npx supabase db push` (it creates the documents bucket), then try again."
        : "Upload failed. Please try again.",
    };
  }

  await enqueueIngest(owner.businessId, id);
  revalidatePath(PAGE);
  return { ok: true };
}

const quickAnswerSchema = z.object({
  title: z.string().trim().min(2, "Add a short title").max(80),
  answer: z.string().trim().min(5, "Write the answer").max(2000),
});

export async function addQuickAnswer(input: { title: string; answer: string }): Promise<ActionResult> {
  const parsed = quickAnswerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const owner = await ownerBusiness();
  if ("error" in owner) return owner.error;

  const { data, error } = await owner.supabase
    .from("documents")
    .insert({ business_id: owner.businessId, name: parsed.data.title, kind: "text", content: parsed.data.answer })
    .select("id")
    .single();
  if (error) {
    reportError("[knowledge] insert quick answer failed", error);
    return { ok: false, error: "Couldn't save. Please try again." };
  }
  await enqueueIngest(owner.businessId, data.id);
  revalidatePath(PAGE);
  return { ok: true };
}

export async function deleteDocument(id: string): Promise<ActionResult> {
  const owner = await ownerBusiness();
  if ("error" in owner) return owner.error;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Unknown document." };

  // Chunks go with it (on delete cascade), so the AI stops using it immediately.
  const { data, error } = await owner.supabase
    .from("documents")
    .delete()
    .eq("id", id)
    .eq("business_id", owner.businessId)
    .select("storage_path")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Couldn't delete. Please refresh and try again." };
  if (data.storage_path) await createServiceClient().storage.from(DOCUMENTS_BUCKET).remove([data.storage_path]);
  revalidatePath(PAGE);
  return { ok: true };
}

/** Retry a failed document, or re-embed one after adding GEMINI_API_KEY. */
export async function reindexDocument(id: string): Promise<ActionResult> {
  const owner = await ownerBusiness();
  if ("error" in owner) return owner.error;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Unknown document." };

  const { data, error } = await owner.supabase
    .from("documents")
    .update({ status: "pending", error: null })
    .eq("id", id)
    .eq("business_id", owner.businessId)
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Couldn't start. Please refresh and try again." };
  await enqueueIngest(owner.businessId, id);
  revalidatePath(PAGE);
  return { ok: true };
}
