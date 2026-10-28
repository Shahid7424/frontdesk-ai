/**
 * Removes citation markers from a streamed answer and remembers which
 * sources were cited.
 *
 * The model is asked to tag facts with [1], [2] (the numbers of the
 * sources in its context). Customers shouldn't see the brackets, so the
 * widget gets clean text and a separate list of the cited sources. That
 * makes citations honest: a source is shown only when the model said it
 * used it, not merely because search returned it.
 *
 * Markers can be split across stream deltas ("[" then "1]"), so a
 * possible marker at the end of a delta is held back until it completes.
 * Open models trained on another format write 【1†source】; that's handled too.
 */

const MARKER = /^\[(\d{1,2}(?:\s*,\s*\d{1,2})*)\]|^【(\d{1,2})[^】]{0,30}】/;
const PARTIAL = /^\[[\d,\s]{0,12}$|^【[^】]{0,32}$/;

export class CitationFilter {
  readonly cited = new Set<number>();
  private pending = "";
  /** Whitespace before a possible marker, dropped if a marker follows ("₹500 [1]." → "₹500."). */
  private space = "";

  /** Feed one delta; returns the text that's safe to show now. */
  push(delta: string): string {
    let input = this.pending + delta;
    this.pending = "";
    let out = "";

    while (input) {
      const open = input.search(/[[【]/);
      if (open === -1) {
        out += this.text(input);
        break;
      }
      out += this.text(input.slice(0, open));
      const rest = input.slice(open);
      const m = MARKER.exec(rest);
      if (m) {
        for (const n of (m[1] ?? m[2] ?? "").split(",")) this.cited.add(Number(n.trim()));
        this.space = "";
        input = rest.slice(m[0].length);
      } else if (PARTIAL.test(rest)) {
        this.pending = rest;
        break;
      } else {
        out += this.text(rest[0]!);
        input = rest.slice(1);
      }
    }
    return out;
  }

  /** Call when the stream ends: releases anything held back. */
  end(): string {
    const rest = this.pending;
    this.pending = "";
    // A trailing space before the end of the message is never needed.
    this.space = "";
    return rest;
  }

  /** Plain text: emits held whitespace first, and holds back this text's own trailing whitespace. */
  private text(s: string): string {
    if (!s) return "";
    const trimmed = s.replace(/\s+$/, "");
    const trailing = s.slice(trimmed.length);
    if (!trimmed) {
      this.space += trailing;
      return "";
    }
    const out = this.space + trimmed;
    this.space = trailing;
    return out;
  }
}

/** Strips markers from a complete text (stored history, non-streamed replies). */
export function stripCitations(text: string): { text: string; cited: number[] } {
  const f = new CitationFilter();
  const clean = f.push(text) + f.end();
  return { text: clean, cited: [...f.cited] };
}
