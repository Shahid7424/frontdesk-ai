import "server-only";
import { retrievalQuery, searchTerms, toPgVector, type KnowledgeHit } from "@frontdesk/core/knowledge";
import { createServiceClient } from "@/lib/supabase/server";
import { embedder } from "./embedder";
import { reportError } from "@/lib/monitoring";

/** Sources given to the model per message. More costs tokens and invites off-topic answers. */
const TOP_K = 5;
/** A slow embeddings call must not hold up the reply; keyword results are still good. */
const EMBED_TIMEOUT_MS = 2500;

/**
 * Hybrid search over one business's knowledge base for the customer's
 * latest message (joined with the previous one for short follow-ups).
 */
export async function searchKnowledge(businessId: string, userMessages: string[]): Promise<KnowledgeHit[]> {
  const query = retrievalQuery(userMessages);
  const terms = searchTerms(query);
  const embedding = await embedQuery(query);
  if (!terms.length && !embedding) return [];

  const { data, error } = await createServiceClient().rpc("search_chunks", {
    p_business_id: businessId,
    p_terms: terms,
    p_embedding: embedding ? toPgVector(embedding) : null,
    p_limit: TOP_K,
  });
  if (error) {
    // Search is best-effort: the agent still has the business profile.
    reportError("[knowledge] search failed", error.message);
    return [];
  }
  return data.map((r) => ({ id: String(r.id), source: r.document_name, page: r.page, content: r.content }));
}

async function embedQuery(query: string): Promise<number[] | null> {
  if (!embedder || query.trim().length < 3) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<null>((resolve) => (timer = setTimeout(() => resolve(null), EMBED_TIMEOUT_MS)));
    const vectors = await Promise.race([embedder.embed([query], "query"), timeout]);
    return vectors?.[0] ?? null;
  } catch (err) {
    reportError("[knowledge] query embedding failed, using keywords only", (err as Error).message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
