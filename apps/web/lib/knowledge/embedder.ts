import "server-only";
import { geminiEmbedder, type Embedder } from "@frontdesk/core/knowledge";

/**
 * Embeddings are optional. With GEMINI_API_KEY (free at aistudio.google.com)
 * search is hybrid; without it, keyword only. Everything else works the same.
 */
const apiKey = process.env.GEMINI_API_KEY?.trim();

export const embedder: Embedder | null = apiKey
  ? geminiEmbedder({ apiKey, model: process.env.EMBEDDING_MODEL?.trim() || undefined })
  : null;
