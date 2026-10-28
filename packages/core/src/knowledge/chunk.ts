/**
 * Splits document text into retrieval-sized chunks.
 *
 * Small businesses upload rate cards, FAQs and brochures: short, list-like
 * text where one chunk should hold one topic. So chunks follow paragraph
 * boundaries, are kept around 900 characters (roughly 200 tokens, small
 * enough that a retrieved chunk is mostly on-topic), and carry the last
 * sentence of the previous chunk so an answer split across a boundary is
 * still findable. Page numbers are kept for citations ("Rate card, p. 2").
 */

export interface TextChunk {
  /** 0-based position in the document. */
  index: number;
  content: string;
  /** 1-based page the chunk starts on; null for plain text. */
  page: number | null;
}

export interface ChunkOptions {
  /** Each entry of pages is a real page (PDF), so chunks record page numbers. */
  paged?: boolean;
  maxChars?: number;
  overlapChars?: number;
}

const DEFAULTS = { paged: false, maxChars: 900, overlapChars: 160 };

/** PDF extraction joins lines with single newlines and leaves runs of spaces. */
export function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/­/g, "") // soft hyphens
    .replace(/(\w)-\n(\w)/g, "$1$2") // words hyphenated across lines
    .replace(/[ \t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Paragraphs. Within a block, PDF extraction breaks lines mid-sentence, so
 * a line continues the previous one unless that ended a sentence or the
 * line looks like a list item.
 */
function paragraphs(text: string): string[] {
  return text.split(/\n\n+/).flatMap((block) => {
    const out: string[] = [];
    for (const line of block.split("\n").map((l) => l.trim()).filter(Boolean)) {
      const prev = out.at(-1);
      if (prev && !/[.!?:।]$/.test(prev) && !/^([-•*●▪]|\d+[.)])\s/.test(line)) out[out.length - 1] = `${prev} ${line}`;
      else out.push(line);
    }
    return out;
  });
}

function sentences(text: string): string[] {
  return text.match(/[^.!?।]+(?:[.!?।]+|$)/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];
}

/** Breaks one over-long piece into pieces of at most max characters, on sentence then word boundaries. */
function splitLong(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const out: string[] = [];
  let current = "";
  const push = () => {
    if (current) out.push(current);
    current = "";
  };
  for (const s of sentences(text)) {
    if (s.length > max) {
      push();
      let line = "";
      for (const word of s.split(" ")) {
        if (line && line.length + word.length + 1 > max) {
          out.push(line);
          line = "";
        }
        line = line ? `${line} ${word}` : word.slice(0, max);
      }
      current = line;
    } else if (current && current.length + s.length + 1 > max) {
      push();
      current = s;
    } else {
      current = current ? `${current} ${s}` : s;
    }
  }
  push();
  return out;
}

/** The tail of a chunk that's carried into the next one: its last sentence, if short enough. */
function overlapTail(text: string, max: number): string {
  const last = sentences(text).at(-1) ?? "";
  return last.length <= max && last.length < text.length ? last : "";
}

/**
 * Chunks a document given as pages (a PDF) or a single page (pasted text).
 * Empty pages are skipped; page numbers still match the original PDF.
 */
export function chunkPages(pages: string[], options: ChunkOptions = {}): TextChunk[] {
  const { paged, maxChars, overlapChars } = { ...DEFAULTS, ...options };
  const pieces = pages.flatMap((page, i) =>
    paragraphs(normalizeText(page)).flatMap((p) => splitLong(p, maxChars).map((text) => ({ text, page: i + 1 }))),
  );

  const chunks: TextChunk[] = [];
  let content = "";
  let page = 1;
  let carried = "";

  const flush = () => {
    if (content && content !== carried) chunks.push({ index: chunks.length, content, page: paged ? page : null });
    carried = overlapTail(content, overlapChars);
    content = carried;
  };

  for (const piece of pieces) {
    const newPage = piece.page !== page;
    if (content && (newPage || content.length + piece.text.length + 1 > maxChars)) {
      flush();
      // A chunk never spans pages, so its page number in a citation is exact.
      // Overlap only helps if the next piece still fits next to it.
      if (newPage || content.length + piece.text.length + 1 > maxChars) content = carried = "";
    }
    if (!content || content === carried) page = piece.page;
    content = content ? `${content}\n${piece.text}` : piece.text;
  }
  flush();
  return chunks;
}

/** A quick answer is one fact the owner typed in: always a single chunk, titled so keyword search finds it. */
export function quickAnswerChunk(title: string, answer: string): TextChunk {
  const body = normalizeText(answer).replace(/\n+/g, " ");
  return { index: 0, content: `${title.trim()}: ${body}`, page: null };
}
