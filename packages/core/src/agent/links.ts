/**
 * Removes web links from a streamed reply.
 *
 * The receptionist never has a real URL to give: payment links and slots
 * reach the customer as cards and buttons. A link in the model's text can
 * only be made up ("https://payment.link/xyz123"), and a customer who taps
 * it lands somewhere that isn't the clinic. So any link is dropped, even if
 * the prompt rule against them was ignored.
 *
 * Markdown bold ("**Pay**") goes too: the widget shows plain text, so the
 * stars would show up as they are.
 *
 * Text is passed on a word at a time: the word at the end of a delta is
 * held back until whitespace shows it is complete.
 */

/** "https://…", "www.…", "]( https://…" inside markdown, or a bare "pay.link/abc". */
const LINK = /:\/\/|^\W*www\.|^\W*[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}\/\S*/i;

export class LinkFilter {
  private pending = "";
  /** Set when the last word was dropped, so the space after it is too. */
  private dropped = false;

  /** Feed one piece of text; returns the text that's safe to show now. */
  push(text: string): string {
    const input = this.pending + text;
    // Everything up to the last whitespace is whole words.
    const cut = input.search(/\S+$/);
    if (cut === -1) {
      this.pending = "";
      return this.clean(input);
    }
    this.pending = input.slice(cut);
    return this.clean(input.slice(0, cut));
  }

  /** Call when the stream ends: releases the last word unless it's a link. */
  end(): string {
    const rest = this.pending;
    this.pending = "";
    return this.clean(rest);
  }

  private clean(text: string): string {
    return text
      .split(/(\s+)/)
      .map((part) => {
        if (!part) return "";
        if (/^\s+$/.test(part)) {
          // "link: <url> please" → "link: please", not "link:  please".
          const keep = this.dropped && !part.includes("\n") ? "" : part;
          this.dropped = false;
          return keep;
        }
        this.dropped = LINK.test(part);
        return this.dropped ? "" : part.replace(/\*\*|__/g, "");
      })
      .join("");
  }
}

/** Strips links from a complete text. */
export function stripLinks(text: string): string {
  const f = new LinkFilter();
  return f.push(text) + f.end();
}
