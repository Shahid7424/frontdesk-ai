/**
 * Chat wire protocol shared by every channel UI (website widget today,
 * owner inbox later) and the /api/chat endpoint.
 *
 * The response is NDJSON: one ChatEvent per line. We use our own tiny
 * protocol instead of the Vercel AI SDK stream format because the widget
 * is Preact (no useChat) and has to stay a few KB. The backend can swap
 * the mock for Claude without the UI changing.
 */

export type Role = "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

/**
 * A structured UI action, e.g. the customer tapped a slot chip.
 * Sent alongside the text so the server never has to parse "Book 10:30"
 * out of free text to know which slot was picked.
 */
export type ChatAction = {
  type: "book_slot";
  slotId: string;
  customer?: CustomerDetails;
  /** Move this booking to the slot instead of making a new one. */
  rescheduleOf?: string;
};

/** Who the booking is for. The clinic needs a name and a number to call. */
export interface CustomerDetails {
  name: string;
  phone: string;
}

/**
 * An Indian mobile number as +91XXXXXXXXXX, or null. Accepts the ways
 * people type it: "98220 41118", "+91-9822041118", "09822041118".
 */
export function normalizeIndianMobile(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  const local = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits.length === 11 && digits.startsWith("0") ? digits.slice(1) : digits;
  return /^[6-9]\d{9}$/.test(local) ? `+91${local}` : null;
}

/** Reply language the customer picked in the widget. "auto" mirrors how they write. */
export type ChatLanguage = (typeof CHAT_LANGUAGES)[number];
export const CHAT_LANGUAGES = ["auto", "en", "hinglish", "hi"] as const;

export interface ChatRequest {
  businessId: string;
  conversationId?: string;
  messages: ChatMessage[];
  action?: ChatAction;
  language?: ChatLanguage;
  /**
   * Bookings made earlier from this browser. A booking id is an unguessable
   * secret (the payment page uses it too), so knowing one is what lets a
   * customer cancel or move it from a later chat.
   */
  bookingIds?: string[];
}

/** Public, non-secret settings the widget loads before it opens. */
export interface WidgetConfig {
  businessId: string;
  businessName: string;
  tagline: string;
  greeting: string;
  accentColor: string;
  quickReplies: string[];
  consentText: string;
  privacyUrl: string;
}

/** A source chunk the answer was grounded in (RAG citation). */
export interface Citation {
  id: string;
  title: string;
  snippet: string;
}

/** A bookable slot offered by the check_availability tool. */
export interface Slot {
  id: string;
  serviceId: string;
  serviceName: string;
  staffName: string;
  /** ISO 8601 start time, Asia/Kolkata. */
  startsAt: string;
  label: string;
  /** Set when tapping this slot moves an existing booking (reschedule_booking). */
  rescheduleOf?: string;
}

export interface PaymentLink {
  bookingId: string;
  url: string;
  amountInPaise: number;
  expiresInMinutes: number;
}

export type ChatEvent =
  | { type: "start"; conversationId: string }
  | { type: "text"; delta: string }
  | { type: "citations"; items: Citation[] }
  | { type: "slots"; items: Slot[] }
  | { type: "payment_link"; link: PaymentLink }
  /** A booking was made or moved; the widget remembers the id for later chats. */
  | { type: "booked"; bookingId: string }
  | { type: "handoff"; reason: string }
  | { type: "error"; message: string }
  | { type: "done" };

export function encodeEvent(event: ChatEvent): string {
  return JSON.stringify(event) + "\n";
}

/**
 * Reads an NDJSON response body and yields events as they arrive.
 * A network chunk can end mid-line, so we keep the tail in a buffer.
 */
export async function* readEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<ChatEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline: number;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) yield JSON.parse(line) as ChatEvent;
    }
  }
  if (buffer.trim()) yield JSON.parse(buffer) as ChatEvent;
}

export function formatRupees(paise: number): string {
  return "₹" + (paise / 100).toLocaleString("en-IN");
}
