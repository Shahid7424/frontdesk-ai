import "server-only";
import { documents as demoDocuments } from "@/lib/mock/dashboard";
import { knowledge as demoKnowledge } from "@/lib/mock/demo-clinic";
import { createClient } from "@/lib/supabase/server";
import type { BusinessContext } from "./business";

export type DocumentStatus = "pending" | "processing" | "ready" | "failed";

export interface KnowledgeDoc {
  id: string;
  name: string;
  kind: "pdf" | "text" | "url";
  status: DocumentStatus;
  error: string | null;
  chunks: number;
  /** Quick answers only: the text the owner typed. */
  content: string | null;
  /** Chunks have vectors, so meaning-based search works for this document. */
  embedded: boolean;
  updated: string;
}

export interface KnowledgeBase {
  documents: KnowledgeDoc[];
  quickAnswers: KnowledgeDoc[];
}

/** The signed-in owner's documents and quick answers (RLS scopes the query to their business). */
export async function getKnowledgeBase(ctx: BusinessContext): Promise<KnowledgeBase> {
  if (ctx.mode === "demo") return demoKnowledgeBase();
  if (!ctx.business) return { documents: [], quickAnswers: [] };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, name, kind, status, error, chunk_count, content, embedding_model, updated_at")
    .eq("business_id", ctx.business.id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`Could not load documents: ${error.message}`);

  const docs: KnowledgeDoc[] = data.map((d) => ({
    id: d.id,
    name: d.name,
    kind: d.kind,
    status: d.status,
    error: d.error,
    chunks: d.chunk_count,
    content: d.content,
    embedded: Boolean(d.embedding_model),
    updated: d.updated_at,
  }));
  return {
    documents: docs.filter((d) => d.kind !== "text"),
    quickAnswers: docs.filter((d) => d.kind === "text" && d.content !== null),
  };
}

function demoKnowledgeBase(): KnowledgeBase {
  return {
    documents: demoDocuments.map((d) => ({
      id: d.id,
      name: d.name,
      kind: d.type === "Website" ? "url" : "pdf",
      status: d.status,
      error: null,
      chunks: d.chunks,
      content: null,
      embedded: true,
      updated: d.updated,
    })),
    quickAnswers: demoKnowledge.map((k) => ({
      id: k.id,
      name: k.title,
      kind: "text",
      status: "ready",
      error: null,
      chunks: 1,
      content: k.text,
      embedded: true,
      updated: new Date().toISOString(),
    })),
  };
}
