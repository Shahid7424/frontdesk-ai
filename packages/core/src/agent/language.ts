import type { ChatLanguage, ChatMessage } from "../protocol";

export type ReplyLanguage = Exclude<ChatLanguage, "auto">;

const DEVANAGARI = /[\u0900-\u097F]/;
// Common Hindi words in Roman script. One hit is enough: English speakers don't write "chahiye".
const HINGLISH =
  /\b(kya|hai|hain|ho|kitni|kitna|kitne|kal|aaj|parso|mujhe|hume|chahiye|chaiye|chahie|karna|karo|karein|kaise|kab|kahan|kaun|khula|baat|nahi|nhi|haan|han|ji|ka|ki|ke|ko|se|mein|abhi|theek|thik|accha|acha|batao|bataiye|dijiye|bhejo|milega|milegi|wala|wali|aap|aapka|mera|meri)\b|\bdo\b(?!\s+(you|i|we|they|u)\b)/i;
// English needs a real English word, not just nouns like "payment link" that Hinglish borrows.
const ENGLISH =
  /\b(the|is|are|was|what|when|where|how|which|can|could|will|would|you|your|i|i'm|my|me|we|our|please|have|has|does|want|need|there|this|that|it)\b/i;

/** The language of one message, or null when it doesn't tell ("ok", "payment link", "2 Nov"). */
function languageOf(text: string): ReplyLanguage | null {
  if (DEVANAGARI.test(text)) return "hi";
  if (HINGLISH.test(text)) return "hinglish";
  return ENGLISH.test(text) ? "en" : null;
}

/**
 * The language to reply in. A choice made in the widget wins; otherwise the
 * customer's most recent message that shows a language decides, so a short
 * "okay" doesn't flip a Hinglish chat to English.
 */
export function replyLanguage(history: ChatMessage[], choice: ChatLanguage = "auto"): ReplyLanguage {
  if (choice !== "auto") return choice;
  for (const m of [...history].reverse()) {
    if (m.role !== "user") continue;
    const lang = languageOf(m.content);
    if (lang) return lang;
  }
  return "hinglish";
}

export const LANGUAGE_INSTRUCTION: Record<ReplyLanguage, string> = {
  en: "Reply in simple English.",
  hinglish:
    'Reply in Hinglish: Hindi written in Roman script, the way people text in India (e.g. "Aapka slot hold ho gaya hai, payment karte hi confirm ho jayega."). Every sentence in Hinglish, never switch to English sentences.',
  hi: "Reply in Hindi, in Devanagari script (e.g. \"आपका स्लॉट होल्ड हो गया है।\"). Service and doctor names can stay as they are.",
};
