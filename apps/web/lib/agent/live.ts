import "server-only";
import { normalizeIndianMobile, type ChatAction, type ChatEvent, type ChatRequest } from "@frontdesk/core";
import { replyLanguage, type AgentResult, type BusinessKnowledge, type ReplyLanguage } from "@frontdesk/core/agent";
import type { Json } from "@frontdesk/db";
import { after } from "next/server";
import { queueAlert } from "@/lib/alerts";
import { searchKnowledge } from "@/lib/knowledge/search";
import { cancelChatBooking, findChatBooking, holdSlot, moveBooking, type PaymentMode } from "./booking";
import { getBusy } from "./knowledge";
import { friendlyError, isAgentConfigured, startAgent } from "./provider";
import { getOrCreateConversation, loadHistory, saveCustomer, saveMessage, staffRepliedLast, touchConversation } from "./store";
import { traceChat } from "./tracing";
import { reportError } from "@/lib/monitoring";

// Fixed replies that don't need the model, in each reply language.
const COPY = {
  teamWillReply: {
    hinglish: "Aapka message team tak pahunch gaya hai. Woh jald hi isi chat mein reply karenge.",
    en: "Your message has reached the team. They'll reply in this chat soon.",
    hi: "आपका संदेश टीम तक पहुँच गया है। वे जल्द ही इसी चैट में जवाब देंगे।",
  },
  taken: {
    hinglish: "Maaf kijiye, ye slot abhi kisi aur ne le liya. Koi doosra time bataiye, main check kar deti hoon.",
    en: "Sorry, someone just took this slot. Tell me another time and I'll check.",
    hi: "माफ़ कीजिए, यह स्लॉट अभी किसी और ने ले लिया। कोई दूसरा समय बताइए, मैं देख लेती हूँ।",
  },
  details: {
    hinglish: "Slot hold karne ke liye apna naam aur sahi 10 digit mobile number dijiye.",
    en: "To hold the slot, please share your name and a valid 10-digit mobile number.",
    hi: "स्लॉट होल्ड करने के लिए अपना नाम और सही 10 अंकों का मोबाइल नंबर दीजिए।",
  },
  invalid: {
    hinglish: "Ye slot ab available nahi hai. Kripya doosra time chuniye.",
    en: "This slot isn't available any more. Please pick another time.",
    hi: "यह स्लॉट अब उपलब्ध नहीं है। कृपया दूसरा समय चुनिए।",
  },
  held: {
    hinglish: (who: string, when: string, what: string, min: number) =>
      `Done! ${who} ke saath ${when} (${what}) ka slot ${min} minute ke liye hold kar diya hai. Payment hote hi booking confirm ho jayegi.`,
    en: (who: string, when: string, what: string, min: number) =>
      `Done! I've held ${when} with ${who} (${what}) for ${min} minutes. Your booking is confirmed as soon as you pay.`,
    hi: (who: string, when: string, what: string, min: number) =>
      `हो गया! ${who} के साथ ${when} (${what}) का स्लॉट ${min} मिनट के लिए होल्ड कर दिया है। पेमेंट होते ही बुकिंग कन्फ़र्म हो जाएगी।`,
  },
  moved: {
    hinglish: (who: string, when: string, what: string) => `Ho gaya! Aapki booking ab ${when} par hai, ${who} ke saath (${what}).`,
    en: (who: string, when: string, what: string) => `Done! Your booking is now ${when} with ${who} (${what}).`,
    hi: (who: string, when: string, what: string) => `हो गया! आपकी बुकिंग अब ${when} पर है, ${who} के साथ (${what})।`,
  },
  notMovable: {
    hinglish: "Ye booking ab badli nahi ja sakti. Clinic ki team aapki madad karegi, ya naya slot book kar lijiye.",
    en: "This booking can't be changed any more. The clinic's team can help, or you can book a new slot.",
    hi: "यह बुकिंग अब बदली नहीं जा सकती। क्लिनिक की टीम मदद करेगी, या नया स्लॉट बुक कर लीजिए।",
  },
  confirmed: {
    hinglish: (who: string, when: string, what: string) => `Booking confirm! ${who} ke saath ${when} (${what}). Milte hain!`,
    en: (who: string, when: string, what: string) => `Booking confirmed! ${when} with ${who} (${what}). See you then!`,
    hi: (who: string, when: string, what: string) => `बुकिंग कन्फ़र्म! ${who} के साथ ${when} (${what})। मिलते हैं!`,
  },
} satisfies Record<string, Record<ReplyLanguage, unknown>>;

/**
 * One customer message against a real business: persist it, answer with
 * the configured LLM (or hold a slot for a tapped slot button), persist the answer
 * with its token cost, and trace it.
 */
export async function* runLiveChat(
  req: ChatRequest,
  business: BusinessKnowledge & { aiEnabled: boolean; paymentMode: PaymentMode },
): AsyncGenerator<ChatEvent> {
  const now = new Date();
  const conversation = await getOrCreateConversation(business.id, req.conversationId);
  const conversationId = conversation.id;
  yield { type: "start", conversationId };

  const question = req.messages.at(-1)?.role === "user" ? req.messages.at(-1)!.content : "";
  const history = await loadHistory(business.id, conversationId);
  await saveMessage({
    businessId: business.id,
    conversationId,
    role: "customer",
    content: question,
    // The slot only: name and phone live in customers, not copied into every message.
    metadata: req.action ? { action: { type: req.action.type, slotId: req.action.slotId } } : {},
  });

  const fullHistory = [...history, { role: "user" as const, content: question }];
  const knownIds = req.bookingIds ?? [];
  // A slot tap's text is a label ("Mon, 2 Nov, 5:00 pm"), so judge the language from what came before.
  const lang = replyLanguage(req.action ? history : fullHistory, req.language);

  if (req.action?.type === "book_slot") {
    yield* req.action.rescheduleOf
      ? moveSlot(business, conversationId, req.action.rescheduleOf, req.action.slotId, now, lang)
      : bookSlot(business, conversationId, req.action, now, lang);
    return yield { type: "done" };
  }

  // The owner took over, or switched the AI off: stay quiet and let them reply.
  if (conversation.status === "human" || !business.aiEnabled || !isAgentConfigured()) {
    // Staff replied last, so this is the customer answering them: tell the owner once per reply.
    if (await staffRepliedLast(business.id, conversationId)) {
      queueAlert(business.id, { kind: "customer_replied", conversationId, message: question });
    }
    const text = COPY.teamWillReply[lang];
    yield { type: "text", delta: text };
    await saveMessage({ businessId: business.id, conversationId, role: "ai", content: text });
    await touchConversation(business.id, conversationId, 0, true);
    return yield { type: "done" };
  }

  // Ground the answer in the business's documents: search once per message,
  // before the model runs, so every provider gets the same sources.
  const knowledge = await searchKnowledge(
    business.id,
    fullHistory.filter((m) => m.role === "user").map((m) => m.content),
  );
  if (process.env.NODE_ENV !== "production") {
    // While testing: shows whether a wrong answer was a search miss or the model's choice.
    console.info(`[knowledge] ${knowledge.length} sources for "${question.slice(0, 60)}": ${knowledge.map((k) => k.source + (k.page ? ` p.${k.page}` : "")).join(", ") || "none"}`);
  }

  const agent = startAgent({
    business,
    knowledge,
    history: fullHistory,
    now,
    language: req.language,
    handedOff: conversation.status === "needs_human",
    getBusy: (staffIds, from, to) => getBusy(business.id, staffIds, from, to),
    getBooking: () => findChatBooking(business, conversationId, now, { knownIds, renew: true }),
    findBooking: () => findChatBooking(business, conversationId, now, { knownIds }),
    cancelBooking: () => cancelChatBooking(business, conversationId, now, knownIds),
  });

  let result: AgentResult;
  try {
    for (;;) {
      const step = await agent.next();
      if (step.done) {
        result = step.value;
        break;
      }
      yield step.value;
    }
  } catch (err) {
    reportError("[chat] agent failed", err);
    await touchConversation(business.id, conversationId, 0, true);
    yield { type: "error", message: friendlyError(err) };
    return yield { type: "done" };
  }

  await saveMessage({
    businessId: business.id,
    conversationId,
    role: "ai",
    content: result.text,
    model: result.model,
    // Billed input = fresh + cache writes + cache reads.
    inputTokens:
      result.usage.input_tokens + result.usage.cache_creation_input_tokens + result.usage.cache_read_input_tokens,
    outputTokens: result.usage.output_tokens,
    costUsd: result.costUsd,
    metadata: JSON.parse(
      JSON.stringify({
        usage: result.usage,
        toolCalls: result.toolCalls,
        handoff: result.handoff,
        stopReason: result.stopReason,
        // What search found vs what the answer cited: the raw material for RAG evals.
        retrieved: knowledge.map((k) => k.id),
        citations: result.citations.map((c) => c.id),
      }),
    ) as Json,
  });
  const handedOff = await touchConversation(business.id, conversationId, result.costUsd, result.handoff !== null);
  if (handedOff) queueAlert(business.id, { kind: "handoff", conversationId, summary: result.handoff?.summary || question });

  // Langfuse upload runs after the response is sent, so it never slows the reply.
  after(() => traceChat({ businessSlug: business.slug, conversationId, question, startedAt: now, result }));

  yield { type: "done" };
}

async function* bookSlot(
  business: BusinessKnowledge & { paymentMode: PaymentMode },
  conversationId: string,
  action: ChatAction,
  now: Date,
  lang: ReplyLanguage,
): AsyncGenerator<ChatEvent> {
  // The clinic must know who is coming; the widget asks before it sends the tap.
  const phone = action.customer && normalizeIndianMobile(action.customer.phone);
  if (!action.customer || !phone) {
    const text = COPY.details[lang];
    yield { type: "text", delta: text };
    await saveMessage({ businessId: business.id, conversationId, role: "ai", content: text, metadata: { bookingFailed: "details" } });
    return;
  }
  const customerId = await saveCustomer(business.id, conversationId, { name: action.customer.name.trim(), phone });

  const booking = await holdSlot(business, action.slotId, now, customerId);
  const text = !booking.ok
    ? COPY[booking.reason][lang]
    : booking.payment
      ? COPY.held[lang](booking.staffName, booking.label, booking.serviceName, booking.payment.expiresInMinutes)
      : COPY.confirmed[lang](booking.staffName, booking.label, booking.serviceName);

  yield { type: "text", delta: text };
  if (booking.ok) yield { type: "booked", bookingId: booking.appointmentId };
  // A paid hold alerts when the money arrives (confirmPaidAppointment), not now.
  if (booking.ok && !booking.payment) queueAlert(business.id, { kind: "booking", appointmentId: booking.appointmentId, paid: false });
  if (booking.ok && booking.payment) yield { type: "payment_link", link: booking.payment };

  await saveMessage({
    businessId: business.id,
    conversationId,
    role: "ai",
    content: text,
    metadata: booking.ok ? { appointmentId: booking.appointmentId } : { bookingFailed: booking.reason },
  });
  await touchConversation(business.id, conversationId, 0, false);
}

async function* moveSlot(
  business: BusinessKnowledge & { paymentMode: PaymentMode },
  conversationId: string,
  bookingId: string,
  slotId: string,
  now: Date,
  lang: ReplyLanguage,
): AsyncGenerator<ChatEvent> {
  const moved = await moveBooking(business, conversationId, bookingId, slotId, now);
  const text = moved.ok
    ? COPY.moved[lang](moved.staffName, moved.label, moved.serviceName)
    : moved.reason === "not_movable"
      ? COPY.notMovable[lang]
      : COPY[moved.reason][lang];
  yield { type: "text", delta: text };
  if (moved.ok) yield { type: "booked", bookingId: moved.appointmentId };

  await saveMessage({
    businessId: business.id,
    conversationId,
    role: "ai",
    content: text,
    metadata: moved.ok ? { appointmentId: moved.appointmentId, moved: true } : { bookingFailed: moved.reason },
  });
  await touchConversation(business.id, conversationId, 0, false);
}
