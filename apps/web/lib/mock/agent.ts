/**
 * Mock of the FrontDesk agent. It produces the exact event stream the real
 * Claude-backed agent will (text deltas, citations, tool results), so the
 * widget and inbox can be built and tested before the backend exists.
 *
 * Intent detection here is keyword based on purpose: it is a stand-in, not
 * the product. On Day 3 this file is replaced by packages/core/agent.
 */
import type { ChatEvent, ChatRequest, Citation } from "@frontdesk/core";
import { demoClinic, knowledge, services } from "./demo-clinic";
import { decodeSlotId, findSlots } from "./slots";

type Lang = "hinglish" | "en";

const HINGLISH_HINTS =
  /\b(kya|hai|hain|kitni|kitna|kal|aaj|mujhe|chahiye|karna|kaise|kab|kahan|khula|baat|nahi|haan|ji|ke|ka|ki)\b/i;

const detectLang = (text: string): Lang => (HINGLISH_HINTS.test(text) ? "hinglish" : "en");

const INTENTS = [
  { name: "human", re: /\b(human|insaan|person|staff|call me|complaint|doctor se baat|baat karni|real person)\b/i },
  { name: "booking", re: /\b(book|booking|appointment|slot|kal|tomorrow|aaj|today|milna|visit)\b/i },
  { name: "fees", re: /\b(fee|fees|price|charges?|kitni|kitna|cost|rate|paise|₹)/i },
  { name: "hours", re: /\b(timing|timings|time|open|khula|band|closed|sunday|hours|kab tak)\b/i },
  { name: "location", re: /\b(address|kahan|where|location|parking|reach|map)\b/i },
  { name: "prep", re: /\b(tayari|prepare|preparation|before test|pft)\b/i },
  { name: "reports", re: /\b(report|reports|result)\b/i },
  { name: "insurance", re: /\b(insurance|cashless|upi|card|cash|payment)\b/i },
  { name: "greeting", re: /^(hi|hii+|hello|hey|namaste|good (morning|evening|afternoon))\b/i },
] as const;

type Intent = (typeof INTENTS)[number]["name"] | "unknown";

const detectIntent = (text: string): Intent =>
  INTENTS.find((intent) => intent.re.test(text))?.name ?? "unknown";

const cite = (...ids: string[]): Citation[] =>
  knowledge
    .filter((k) => ids.includes(k.id))
    .map((k) => ({ id: k.id, title: k.title, snippet: k.text }));

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Emits text word by word so the UI exercises real streaming. */
async function* stream(text: string): AsyncGenerator<ChatEvent> {
  const parts = text.split(/(\s+)/);
  for (const part of parts) {
    yield { type: "text", delta: part };
    if (part.trim()) await sleep(18 + Math.random() * 30);
  }
}

const copy = {
  greeting: {
    hinglish: `Namaste! Main ${demoClinic.name} ki AI receptionist hoon. Fees, timings, appointment ya reports, kuch bhi puchiye.`,
    en: `Hi! I'm the AI receptionist for ${demoClinic.name}. Ask me about fees, timings, appointments or reports.`,
  },
  fees: {
    hinglish:
      "General consultation ₹500 hai, aur chest & asthma consultation (Dr. Kulkarni) ₹800. Lung function test ₹1,200 aur physiotherapy ₹700 per session. 7 din ke andar follow-up free hai.",
    en: "A general consultation is ₹500 and a chest & asthma consultation with Dr. Kulkarni is ₹800. A lung function test is ₹1,200 and physiotherapy is ₹700 per session. Follow-ups within 7 days are free.",
  },
  hours: {
    hinglish:
      "Clinic Mon se Sat subah 9:00 se 1:30 aur shaam 5:00 se 9:00 tak khula hai. Sunday ko sirf 10:00 se 1:00, aur us din sirf Dr. Mehta available hoti hain.",
    en: "We're open Mon to Sat, 9:00 AM – 1:30 PM and 5:00 PM – 9:00 PM. On Sunday it's 10:00 AM – 1:00 PM, with only Dr. Mehta available.",
  },
  location: {
    hinglish: `Address: ${demoClinic.address}. Lift hai, two-wheeler parking saamne aur car parking basement mein.`,
    en: `We're at ${demoClinic.address}. There's a lift, two-wheeler parking in front and car parking in the basement.`,
  },
  prep: {
    hinglish:
      "PFT se 4 ghante pehle inhaler avoid karein (agar doctor ne allow kiya ho), 2 ghante pehle heavy khana na khayein, aur loose kapde pehen ke aayein.",
    en: "Before a lung function test, skip inhalers for 4 hours if your doctor allows, avoid a heavy meal for 2 hours, and wear loose clothes.",
  },
  reports: {
    hinglish: "PFT report 30 minute mein mil jaati hai. Blood test reports partner lab se 24 ghante ke andar WhatsApp par aate hain.",
    en: "PFT reports are ready in 30 minutes. Blood test reports from our partner lab arrive on WhatsApp within 24 hours.",
  },
  insurance: {
    hinglish: "UPI, card aur cash sab chalta hai. OPD ke liye cashless insurance nahi hai, par reimbursement ke liye proper bill milega.",
    en: "We accept UPI, cards and cash. Cashless insurance isn't available for OPD, but you'll get a proper bill for reimbursement.",
  },
  booking: {
    hinglish: "Zaroor! Kal ke liye ye slots khaali hain. Jo time theek lage us par tap kijiye:",
    en: "Sure! These slots are free tomorrow. Tap the one that works for you:",
  },
  human: {
    hinglish: "Theek hai, maine clinic team ko bata diya hai. Koi staff member thodi der mein yahin ya WhatsApp par reply karega.",
    en: "No problem, I've let the clinic team know. A staff member will reply here or on WhatsApp shortly.",
  },
  unknown: {
    hinglish:
      "Iska pakka jawab mere paas clinic ke data mein nahi hai, aur main guess nahi karungi. Kya main ye sawaal clinic team ko bhej doon?",
    en: "I don't have a confirmed answer for that in the clinic's information, and I won't guess. Shall I pass this to the clinic team?",
  },
} satisfies Record<Intent, Record<Lang, string>>;

const citationsFor: Partial<Record<Intent, string[]>> = {
  fees: ["kb-fees"],
  hours: ["kb-hours"],
  location: ["kb-location"],
  prep: ["kb-prep"],
  reports: ["kb-reports"],
  insurance: ["kb-insurance"],
};

function pickService(text: string) {
  if (/\b(chest|asthma|saans|breath|lung|kulkarni)\b/i.test(text)) return "chest-consult";
  if (/\b(pft|lung function)\b/i.test(text)) return "pft";
  if (/\b(physio|back pain|kamar)\b/i.test(text)) return "physio";
  return "gp-consult";
}

export async function* runMockAgent(req: ChatRequest): AsyncGenerator<ChatEvent> {
  const conversationId = req.conversationId ?? crypto.randomUUID();
  yield { type: "start", conversationId };

  const lastUser = [...req.messages].reverse().find((m) => m.role === "user");
  const text = lastUser?.content ?? "";
  const lang = detectLang(req.messages.map((m) => m.content).join(" "));

  // Simulated model latency before the first token.
  await sleep(450);

  if (req.action?.type === "book_slot") {
    const slot = decodeSlotId(req.action.slotId);
    if (!slot) {
      yield { type: "error", message: "That slot is no longer available. Please pick another." };
      yield { type: "done" };
      return;
    }
    const service = services.find((s) => s.id === slot.serviceId)!;
    const bookingId = `bk_${Math.random().toString(36).slice(2, 10)}`;
    const msg =
      lang === "hinglish"
        ? `Done! ${slot.staffName} ke saath ${slot.label} ka slot 10 minute ke liye hold kar diya hai. Payment hote hi booking confirm ho jayegi.`
        : `Done! I've held ${slot.label} with ${slot.staffName} for 10 minutes. Your booking is confirmed as soon as the payment goes through.`;
    yield* stream(msg);
    if (service.pricePaise > 0) {
      yield {
        type: "payment_link",
        link: {
          bookingId,
          url: `/pay/${bookingId}?amount=${service.pricePaise}&service=${encodeURIComponent(service.name)}`,
          amountInPaise: service.pricePaise,
          expiresInMinutes: 10,
        },
      };
    }
    yield { type: "done" };
    return;
  }

  const intent = detectIntent(text);
  yield* stream(copy[intent][lang]);

  const ids = citationsFor[intent];
  if (ids) yield { type: "citations", items: cite(...ids) };
  if (intent === "booking") yield { type: "slots", items: findSlots(pickService(text)) };
  if (intent === "human") yield { type: "handoff", reason: "customer_requested" };

  yield { type: "done" };
}
