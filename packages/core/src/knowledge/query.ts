/**
 * Turns a customer's question into keyword-search terms.
 *
 * Customers write Hinglish ("fees kitni hai?", "parking hai kya"), so
 * Postgres' English stemming and stopwords don't help. We drop common
 * Hinglish/English filler words, keep the rest as prefix terms (fee:* also
 * matches fees), and add a few synonyms so "kharcha" finds "fees" and
 * "kab khulta" finds "timings". Vector search covers the long tail;
 * this keeps keyword search useful when there are no embeddings.
 */

const STOPWORDS = new Set(
  `a an the is are was were be am i me my we our you your it its this that these those of to in on at for from by with and or
  do does did can could will would should please pls plz tell know want need about any some what which who whom how when where
  hai hain ho hoga hogi honge tha thi the kya kyu kyun kaise kaisa kaisi kitna kitni kitne kab kahan kaha kaun kis kisi ka ki ke
  ko se me mein mai main mujhe mera meri mere hum ham aap aapka aapki aapke apna apni tum tera teri batao bataiye bata bolo
  chahiye chaiye karna karni karne karo kariye kar sakte sakta sakti hota hoti hote raha rahi rahe wala wali wale yaha yahan
  waha wahan aur ya bhi to toh na nahi nhi haan ha ji sir madam ok okay hello hi namaste thanks thank par pe pr milega milegi
  milta milti milenge mil skte lagega lagta lagti`.split(/\s+/),
);

// Word → extra terms. Only expands; the original word is always searched too.
const SYNONYMS: Record<string, string[]> = {
  fee: ["fees", "charge", "price", "cost", "rate"],
  fees: ["fee", "charge", "price", "cost", "rate"],
  kharcha: ["fees", "charge", "price", "cost"],
  paisa: ["fees", "price", "payment"],
  paise: ["fees", "price", "payment"],
  rate: ["fees", "price", "charge"],
  price: ["fees", "charge", "rate", "cost"],
  charges: ["fees", "price"],
  timing: ["timings", "hours", "open"],
  timings: ["hours", "open"],
  time: ["timings", "hours"],
  samay: ["timings", "hours"],
  khulta: ["timings", "open"],
  khula: ["timings", "open"],
  band: ["closed", "timings"],
  sunday: ["sun"],
  ravivar: ["sunday"],
  address: ["location", "floor", "road"],
  location: ["address"],
  pata: ["address"],
  kahan: ["address"],
  parking: ["park"],
  gaadi: ["parking"],
  report: ["reports"],
  reports: ["report"],
  insurance: ["cashless", "reimbursement"],
  upi: ["payment", "payments"],
  card: ["payment", "payments"],
  cash: ["payment", "payments"],
  payment: ["payments", "upi", "cash"],
  cancel: ["cancellation", "reschedule", "refund"],
  refund: ["cancellation", "refund"],
  pehle: ["before"],
  baad: ["after"],
  pehli: ["first"],
  laana: ["bring"],
  lana: ["bring"],
  ghar: ["home", "visit"],
  tika: ["vaccine", "vaccines"],
  teeka: ["vaccine", "vaccines"],
  doctor: ["dr"],
  daktar: ["doctor", "dr"],
};

/** Lowercase word tokens, Latin and Devanagari, at least 2 characters. */
export function tokenize(text: string): string[] {
  return (text.toLowerCase().normalize("NFKC").match(/[a-z0-9]+|[ऀ-ॿ]+/g) ?? []).filter((t) => t.length > 1);
}

/** Words that carry meaning (filler removed), for comparing texts. */
export function contentWords(text: string): Set<string> {
  return new Set(tokenize(text).filter((t) => !STOPWORDS.has(t) && (t.length > 2 || /\d/.test(t))));
}

/** Search terms for one question, most specific first, capped so a long message stays a cheap query. */
export function searchTerms(question: string, max = 12): string[] {
  const words = tokenize(question).filter((t) => !STOPWORDS.has(t));
  const out: string[] = [];
  const add = (t: string) => {
    if (!out.includes(t)) out.push(t);
  };
  for (const w of words) add(w);
  for (const w of words) for (const s of SYNONYMS[w] ?? []) add(s);
  return out.slice(0, max);
}

/**
 * The text to search with. A short follow-up ("aur Sunday ko?") only
 * makes sense with the question before it, so it's joined to it.
 */
export function retrievalQuery(userMessages: string[]): string {
  const recent = userMessages.filter((m) => m.trim()).slice(-2);
  const last = recent.at(-1) ?? "";
  if (recent.length === 2 && searchTerms(last).length < 3) return `${recent[0]} ${last}`;
  return last;
}
