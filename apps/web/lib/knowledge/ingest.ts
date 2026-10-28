import "server-only";
import { chunkPages, EmbeddingError, quickAnswerChunk, toPgVector, type TextChunk } from "@frontdesk/core/knowledge";
import { createServiceClient } from "@/lib/supabase/server";
import { embedder } from "./embedder";
import { PermanentIngestError, pdfPages } from "./pdf";
import { reportError } from "@/lib/monitoring";

export { PermanentIngestError };

export const DOCUMENTS_BUCKET = "documents";
/** A 10 MB brochure is ~100 chunks; this only stops a 500-page manual from eating the free tier. */
const MAX_CHUNKS = 400;
const INSERT_BATCH = 100;


export function storagePath(businessId: string, documentId: string) {
  return `${businessId}/${documentId}.pdf`;
}

/**
 * Turns one uploaded document into searchable chunks:
 * text (PDF pages or a typed answer) → chunks → embeddings → chunks rows.
 *
 * Idempotent: it replaces the document's chunks, so a retry or a
 * "Re-index" click never duplicates them. Throws on failure; the caller
 * decides whether to retry (Inngest) or mark the document failed (inline).
 */
export async function ingestDocument(businessId: string, documentId: string): Promise<{ chunks: number; embedded: boolean }> {
  const db = createServiceClient();
  const { data: doc, error } = await db
    .from("documents")
    .select("id, name, kind, content, storage_path, attempts")
    .eq("id", documentId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (error) throw new Error(`Could not load document: ${error.message}`);
  if (!doc) throw new PermanentIngestError("Document was deleted.");

  await db
    .from("documents")
    .update({ status: "processing", error: null, attempts: doc.attempts + 1 })
    .eq("id", documentId)
    .eq("business_id", businessId);

  const chunks = await toChunks(doc);
  if (!chunks.length) throw new PermanentIngestError("No text found in this file.");
  if (chunks.length > MAX_CHUNKS) {
    throw new PermanentIngestError(`This document is too long (${chunks.length} sections, max ${MAX_CHUNKS}). Split it into smaller files.`);
  }

  // The document name gives each chunk context ("Rate card: ..."), which helps both search kinds.
  let vectors: number[][] | null = null;
  if (embedder) {
    try {
      vectors = await embedder.embed(
        chunks.map((c) => `${doc.name}\n\n${c.content}`),
        "document",
      );
    } catch (err) {
      // A bad key shouldn't block the knowledge base: fall back to keyword search.
      if (err instanceof EmbeddingError && !err.retryable) reportError("[ingest] embeddings disabled for this document", err.message);
      else throw err;
    }
  }

  const rows = chunks.map((c, i) => ({
    business_id: businessId,
    document_id: documentId,
    chunk_index: c.index,
    page: c.page,
    content: c.content,
    embedding: vectors ? toPgVector(vectors[i]!) : null,
  }));

  const del = await db.from("chunks").delete().eq("document_id", documentId).eq("business_id", businessId);
  if (del.error) throw new Error(`Could not clear old chunks: ${del.error.message}`);
  for (let i = 0; i < rows.length; i += INSERT_BATCH) {
    const { error: insertError } = await db.from("chunks").insert(rows.slice(i, i + INSERT_BATCH));
    if (insertError) throw new Error(`Could not save chunks: ${insertError.message}`);
  }

  await db
    .from("documents")
    .update({ status: "ready", error: null, chunk_count: rows.length, embedding_model: vectors ? embedder!.model : null })
    .eq("id", documentId)
    .eq("business_id", businessId);

  return { chunks: rows.length, embedded: Boolean(vectors) };
}

export async function markFailed(businessId: string, documentId: string, err: unknown) {
  const message =
    err instanceof PermanentIngestError
      ? err.message
      : "Something went wrong while reading this document. Click Retry, or try again later.";
  reportError("[ingest] failed", documentId, err);
  await createServiceClient()
    .from("documents")
    .update({ status: "failed", error: message })
    .eq("id", documentId)
    .eq("business_id", businessId);
}

async function toChunks(doc: { name: string; kind: string; content: string | null; storage_path: string | null }): Promise<TextChunk[]> {
  if (doc.kind === "text") return doc.content?.trim() ? [quickAnswerChunk(doc.name, doc.content)] : [];
  if (doc.kind !== "pdf" || !doc.storage_path) throw new PermanentIngestError("This document has no file to read.");

  const { data: file, error } = await createServiceClient().storage.from(DOCUMENTS_BUCKET).download(doc.storage_path);
  if (error || !file) throw new Error(`Could not download the PDF: ${error?.message ?? "no data"}`);

  const pages = await pdfPages(new Uint8Array(await file.arrayBuffer()));
  return chunkPages(pages, { paged: true });
}
