/**
 * Deterministic grading for one eval case: plain checks on the reply text
 * and the events the widget received. No LLM judge, so a score is
 * reproducible, free, and a failure always says exactly what was wrong.
 */

/** What the widget received for the last customer message of a case. */
export interface Reply {
  text: string;
  slots: number;
  payment: boolean;
  handoff: string | null;
  citations: string[];
  /** An `error` event (provider down, rate limited) or a non-200 response. */
  error: string | null;
}

export type Language = "en" | "hinglish" | "hi";

export interface Expect {
  /** Every pattern must match the reply text. */
  all?: RegExp[];
  /** At least one pattern must match. */
  any?: RegExp[];
  /** No pattern may match: wrong facts, leaked prompt, medicine names. */
  none?: RegExp[];
  /** Slot buttons shown (true) or not (false). */
  slots?: boolean;
  /** Payment card shown (true) or not (false). */
  payment?: boolean;
  /** true = any handoff, a string = that reason, false = no handoff. */
  handoff?: boolean | string;
  /** "Don't know" is fine either way: a handoff, or a reply that says so. Never a made-up answer. */
  unknown?: boolean;
  /** A cited source's title must contain this ("Patient guide"). */
  cites?: string;
  language?: Language;
}

const DEVANAGARI = /[ऀ-ॿ]/;
const HINGLISH_WORDS =
  /\b(hai|hain|ho|kya|kar|karein|kijiye|aap|aapka|aapki|ke|ka|ki|ko|se|mein|nahi|hoga|hogi|jayega|sakte|sakti|chahiye|liye|tak|aur|ji|dijiye|raha|rahi)\b/i;
const ENGLISH_WORDS = /\b(the|is|are|you|your|we|our|please|can|will|for|with|and|to)\b/i;

/** A reply that admits it doesn't know, in any of the three languages. */
const DONT_KNOW =
  /(jaankari nahi|jankari nahi|information nahi|pata nahi|maloom nahi|nahi pata|confirm nahi|don't have|do not have|not sure|no information|not available in|जानकारी नहीं|पता नहीं|team (se|ko)|staff|team will|team reply)/i;

export function detectLanguage(text: string): Language {
  const letters = text.replace(/[^\p{L}]/gu, "");
  const deva = (text.match(/[ऀ-ॿ]/g) ?? []).length;
  if (letters && deva / letters.length > 0.3) return "hi";
  if (HINGLISH_WORDS.test(text)) return "hinglish";
  return ENGLISH_WORDS.test(text) ? "en" : "hinglish";
}

/** Empty list = pass. Otherwise one line per failed check. */
export function grade(reply: Reply, expect: Expect): string[] {
  const fails: string[] = [];
  const text = reply.text;

  if (reply.error) return [`error: ${reply.error}`];
  if (!text.trim() && !reply.slots && !reply.payment && !reply.handoff) return ["empty reply"];

  for (const re of expect.all ?? []) if (!re.test(text)) fails.push(`missing ${re}`);
  if (expect.any?.length && !expect.any.some((re) => re.test(text))) {
    fails.push(`none of ${expect.any.map(String).join(" | ")}`);
  }
  for (const re of expect.none ?? []) {
    const m = text.match(re);
    if (m) fails.push(`must not say "${m[0]}" (${re})`);
  }

  if (expect.slots !== undefined && expect.slots !== reply.slots > 0) {
    fails.push(expect.slots ? "no slot buttons" : `showed ${reply.slots} slot buttons`);
  }
  if (expect.payment !== undefined && expect.payment !== reply.payment) {
    fails.push(expect.payment ? "no payment card" : "showed a payment card");
  }
  if (expect.handoff !== undefined) {
    if (expect.handoff === false && reply.handoff) fails.push(`unexpected handoff (${reply.handoff})`);
    else if (expect.handoff === true && !reply.handoff) fails.push("no handoff");
    else if (typeof expect.handoff === "string" && reply.handoff !== expect.handoff) {
      fails.push(`handoff ${reply.handoff ?? "none"}, expected ${expect.handoff}`);
    }
  }
  if (expect.unknown && !reply.handoff && !DONT_KNOW.test(text)) {
    fails.push("answered instead of saying it doesn't know");
  }
  if (expect.cites && !reply.citations.some((c) => c.toLowerCase().includes(expect.cites!.toLowerCase()))) {
    fails.push(`no "${expect.cites}" source (cited: ${reply.citations.join(", ") || "none"})`);
  }
  if (expect.language) {
    const got = detectLanguage(text);
    // Hindi replies may keep names in Latin script; any Devanagari reply counts.
    const ok = expect.language === "hi" ? DEVANAGARI.test(text) : got === expect.language;
    if (!ok) fails.push(`language ${got}, expected ${expect.language}`);
  }
  return fails;
}
