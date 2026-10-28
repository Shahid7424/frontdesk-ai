/**
 * Text embeddings for vector search.
 *
 * Claude has no embeddings API, and the project runs on free tiers, so the
 * default is Google's gemini-embedding-001 (free in AI Studio). It's
 * truncated to 768 dimensions to match the chunks.embedding column; Google
 * recommends re-normalising truncated vectors, which we do.
 *
 * Embedding is optional: without a key, chunks are stored without vectors
 * and search runs on keywords only.
 */

export const EMBEDDING_DIMENSIONS = 768;
export const DEFAULT_EMBEDDING_MODEL = "gemini-embedding-001";

/** Documents and questions are embedded differently; matching them up is what the task types are for. */
export type EmbedPurpose = "document" | "query";

export interface Embedder {
  model: string;
  embed(texts: string[], purpose: EmbedPurpose): Promise<number[][]>;
}

export class EmbeddingError extends Error {
  constructor(
    message: string,
    /** Worth retrying later (rate limit, server error), as opposed to a bad key or request. */
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "EmbeddingError";
  }
}

// The API accepts up to 100 texts per batch call.
const BATCH = 100;

export function geminiEmbedder(options: {
  apiKey: string;
  model?: string;
  fetch?: typeof fetch;
  baseUrl?: string;
}): Embedder {
  const model = options.model || DEFAULT_EMBEDDING_MODEL;
  const doFetch = options.fetch ?? fetch;
  const base = options.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta";

  return {
    model,
    async embed(texts, purpose) {
      const out: number[][] = [];
      for (let i = 0; i < texts.length; i += BATCH) {
        const batch = texts.slice(i, i + BATCH);
        const res = await doFetch(`${base}/models/${model}:batchEmbedContents`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": options.apiKey },
          body: JSON.stringify({
            requests: batch.map((text) => ({
              model: `models/${model}`,
              content: { parts: [{ text }] },
              taskType: purpose === "document" ? "RETRIEVAL_DOCUMENT" : "RETRIEVAL_QUERY",
              outputDimensionality: EMBEDDING_DIMENSIONS,
            })),
          }),
        });
        if (!res.ok) {
          const detail = (await res.text().catch(() => "")).slice(0, 300);
          throw new EmbeddingError(`Embedding failed (HTTP ${res.status}): ${detail}`, res.status === 429 || res.status >= 500);
        }
        const json = (await res.json()) as { embeddings?: Array<{ values: number[] }> };
        if (json.embeddings?.length !== batch.length) throw new EmbeddingError("Embedding response had the wrong length", true);
        for (const e of json.embeddings) out.push(normalize(e.values));
      }
      return out;
    },
  };
}

export function normalize(v: number[]): number[] {
  const norm = Math.hypot(...v);
  return norm ? v.map((x) => x / norm) : v;
}

/** pgvector's text format: "[0.1,0.2,...]". */
export function toPgVector(v: number[]): string {
  return `[${v.join(",")}]`;
}
