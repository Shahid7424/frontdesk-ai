import type { Citation } from "../protocol";
import type { CitationFilter } from "../knowledge/citations";
import { contentWords } from "../knowledge/query";
import type { KnowledgeHit } from "../knowledge/types";

const SNIPPET = 280;

/** Shared meaningful words an answer needs with a source before we credit it. */
const MIN_OVERLAP = 3;

/**
 * The sources the answer cited, in citation order, as the widget shows them.
 *
 * Claude follows the [n] instruction well; small open models (Groq's free
 * tier) often answer correctly from a source but forget the number. When
 * the answer has no markers, we credit the source it clearly drew on: the
 * one sharing the most meaningful words with it (at least three, e.g.
 * "cancel", "advance", "original"). Never more than two, and nothing for
 * a "don't know" reply that shares no facts with any source.
 */
export function citedSources(filter: CitationFilter, hits: KnowledgeHit[] | undefined, answer = ""): Citation[] {
  if (!hits?.length) return [];
  const numbers = filter.cited.size ? [...filter.cited] : inferCited(answer, hits);
  return numbers
    .filter((n) => n >= 1 && n <= hits.length)
    .sort((a, b) => a - b)
    .map((n) => {
      const h = hits[n - 1]!;
      const text = h.content.replace(/\s+/g, " ").trim();
      return {
        id: h.id,
        title: h.page ? `${h.source} · p. ${h.page}` : h.source,
        snippet: text.length > SNIPPET ? `${text.slice(0, SNIPPET - 1).trimEnd()}…` : text,
      };
    });
}

function inferCited(answer: string, hits: KnowledgeHit[]): number[] {
  const words = contentWords(answer);
  if (!words.size) return [];
  const scored = hits.map((h, i) => {
    const source = contentWords(h.content);
    let overlap = 0;
    for (const w of words) {
      // "refund" in the answer matches "refunded" in the source.
      if (source.has(w) || (w.length > 4 && [...source].some((s) => s.startsWith(w) || (w.startsWith(s) && s.length > 4)))) overlap++;
    }
    return { n: i + 1, overlap };
  });
  const best = Math.max(...scored.map((s) => s.overlap));
  if (best < MIN_OVERLAP) return [];
  return scored
    .filter((s) => s.overlap >= Math.max(MIN_OVERLAP, Math.ceil(best * 0.6)))
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 2)
    .map((s) => s.n);
}
