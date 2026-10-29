import type { ChatEvent, ChatMessage } from "../protocol";
import { addDays, findFreeSlots, istDay, spread } from "./availability";
import { dayInText, dayLabel, resolveDay } from "./dates";
import type { BookingLookup, BusinessKnowledge, BusyInterval, CancelOutcome } from "./types";

const EXPLICIT_DATE =
  /\b\d{1,2}(st|nd|rd|th)\b|\b\d{1,2}\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|tarikh|tareekh|\bdate\b|\d{4}-\d{2}-\d{2}/i;

const HANDOFF_REASONS = ["customer_requested", "complaint", "unknown_answer", "medical", "other"];

/** What a tool needs from the request. Shared by every model provider. */
export interface ToolContext {
  business: BusinessKnowledge;
  now: Date;
  getBusy: (staffIds: string[], from: string, to: string) => Promise<BusyInterval[]>;
  /** The conversation so far, used to double-check the date the model picked. */
  history?: ChatMessage[];
  /** Staff already know about this chat. Set by the first handoff, so later ones are no-ops. */
  handedOff?: boolean;
  /** The customer's booking in this chat; renews a lapsed hold when the slot is still free. */
  getBooking?: () => Promise<BookingLookup>;
  /** The same booking without renewing anything, for cancel and reschedule. */
  findBooking?: () => Promise<BookingLookup>;
  cancelBooking?: () => Promise<CancelOutcome>;
}

/**
 * Runs one tool call. Returns the text the model sees and the events the
 * widget sees (slot buttons, handoff banner).
 */
export async function executeTool(
  name: string,
  rawInput: unknown,
  ctx: ToolContext,
): Promise<{ content: string; events: ChatEvent[] }> {
  if (name === "check_availability") {
    const { service_id, date } = rawInput as { service_id: string; date: string };
    const service = ctx.business.services.find((s) => s.id === service_id);
    if (!service) throw new Error("Unknown service_id");
    return offerSlots(service, date, ctx);
  }

  if (name === "reschedule_booking") {
    const { date } = rawInput as { date: string };
    const booking = ctx.findBooking ? await ctx.findBooking() : ({ status: "none" } as const);
    if (booking.status !== "confirmed" && booking.status !== "pending_payment") {
      return {
        events: [],
        content: JSON.stringify({
          status: booking.status,
          note:
            booking.status === "none"
              ? "No booking found for this customer in this chat or on this device. If they booked earlier from another phone, call handoff_to_human so the team can move it."
              : "That hold lapsed and the slot was taken, so there's nothing to move. Offer to book a new slot with check_availability.",
        }),
      };
    }
    const service = ctx.business.services.find((s) => s.id === booking.serviceId);
    if (!service) throw new Error("The booked service is no longer offered");
    const offered = await offerSlots(service, date, ctx, booking.bookingId);
    const parsed = JSON.parse(offered.content) as Record<string, unknown>;
    return {
      events: offered.events,
      content: JSON.stringify({
        ...parsed,
        current_booking: `${booking.label} with ${booking.staffName} (${booking.serviceName})`,
        note: offered.events.length
          ? `${String(parsed.note)} Tapping one moves their booking there; any advance already paid carries over. Ask them to tap the new time.`
          : parsed.note,
      }),
    };
  }

  if (name === "cancel_booking") {
    const { customer_confirmed } = rawInput as { customer_confirmed?: boolean };
    const booking = ctx.findBooking ? await ctx.findBooking() : ({ status: "none" } as const);
    if (booking.status === "none" || booking.status === "expired") {
      return {
        events: [],
        content: JSON.stringify({
          status: booking.status,
          note:
            booking.status === "none"
              ? "No booking found for this customer in this chat or on this device. If they booked from another phone, call handoff_to_human so the team can cancel it."
              : "That hold already lapsed, so there is nothing to cancel. Tell the customer it's not booked.",
        }),
      };
    }
    if (customer_confirmed !== true) {
      return {
        events: [],
        content: JSON.stringify({
          booking: `${booking.label} with ${booking.staffName} (${booking.serviceName})`,
          note: "Not cancelled yet. Tell the customer which booking this is and ask them to confirm the cancellation.",
        }),
      };
    }
    const result = ctx.cancelBooking ? await ctx.cancelBooking() : ({ status: "none" } as const);
    const notes: Record<CancelOutcome["status"], string> = {
      cancelled:
        result.status === "cancelled" && result.paid
          ? "Cancelled. They had paid an advance: the team will contact them about the refund. Don't promise a refund amount or timeline."
          : "Cancelled. Confirm it in one short line and offer to book another time.",
      none: "Nothing to cancel was found. If they booked from another phone, call handoff_to_human.",
      too_late: "It's too close to (or past) the appointment time to cancel here. Call handoff_to_human so the team can help.",
    };
    return { events: [], content: JSON.stringify({ ...result, note: notes[result.status] }) };
  }

  if (name === "show_booking") {
    const booking = ctx.getBooking ? await ctx.getBooking() : ({ status: "none" } as const);
    if (booking.status === "pending_payment") {
      return {
        events: [{ type: "payment_link", link: booking.payment }],
        content: JSON.stringify({
          ...booking,
          payment: undefined,
          note: `The customer now sees the payment card for ${booking.label} again${booking.reheld ? " (the earlier hold had lapsed, so it was renewed)" : ""}. It's held for ${booking.payment.expiresInMinutes} minutes and confirmed after payment. Ask them to tap the pay button on the card; don't write any link yourself.`,
        }),
      };
    }
    const notes: Record<Exclude<BookingLookup["status"], "pending_payment">, string> = {
      none: "No booking in this chat yet. Offer to find a slot.",
      confirmed: "This booking is paid and confirmed.",
      expired: "The hold lapsed and the slot was taken. Apologise and offer to find another slot.",
    };
    return { events: [], content: JSON.stringify({ ...booking, note: notes[booking.status] }) };
  }

  if (name === "handoff_to_human") {
    if (ctx.handedOff) {
      return { events: [], content: "Staff were already notified earlier in this chat. Don't mention it again; just help with the current message." };
    }
    ctx.handedOff = true;
    const raw = (rawInput as { reason?: string }).reason ?? "";
    // Open models aren't schema-constrained, so unknown reasons become "other".
    const reason = HANDOFF_REASONS.includes(raw) ? raw : "other";
    return {
      events: [{ type: "handoff", reason }],
      content:
        "Done. The customer now sees a notice that the team was notified and will reply here. Don't repeat that; add at most one short line if something else needs saying.",
    };
  }

  throw new Error(`Unknown tool ${name}`);
}

/** Free slots for a service from the requested day, looking up to a week further if it's full. */
async function offerSlots(
  service: BusinessKnowledge["services"][number],
  date: string,
  ctx: ToolContext,
  rescheduleOf?: string,
): Promise<{ content: string; events: ChatEvent[] }> {
    const today = istDay(ctx.now);
    // The customer's own words win over the model's arithmetic: if they said
    // "kal" and the model sent today's date, book tomorrow.
    const asked = customerDay(ctx.history ?? [], today);
    const resolved = resolveDay(String(date ?? ""), today);
    const requested = asked ?? (resolved && resolved >= today ? resolved : today);
    let day = requested;
    if (day > addDays(today, 60)) throw new Error("Bookings open only 60 days ahead");

    // Look at the requested day first; if it's full, check the next week.
    for (let i = 0; i < 7; i++, day = addDays(day, 1)) {
      const busy = await ctx.getBusy(service.staffIds, `${day}T00:00:00+05:30`, `${addDays(day, 1)}T00:00:00+05:30`);
      const slots = findFreeSlots(ctx.business, service.id, day, busy, ctx.now);
      if (slots.length) {
        const shown = spread(slots, 6);
        return {
          events: [{ type: "slots", items: rescheduleOf ? shown.map((s) => ({ ...s, rescheduleOf })) : shown }],
          content: JSON.stringify({
            date: day,
            date_label: dayLabel(day),
            requested_date: requested,
            shown_to_customer: shown.map((s) => `${s.label} with ${s.staffName}`),
            note:
              day === requested
                ? `The customer now sees these ${dayLabel(day)} slots as buttons.`
                : `${dayLabel(requested)} is full or closed. These ${dayLabel(day)} slots are shown as buttons; tell the customer the date.`,
          }),
        };
      }
    }
    return { events: [], content: JSON.stringify({ date: requested, slots: [], note: "No free slots in the next 7 days." }) };
}

/**
 * The day named in the customer's latest messages that name one. Looks
 * back a few turns because the day often comes before the service
 * ("Kal appointment chahiye" → "Which service?" → "general").
 */
function customerDay(history: ChatMessage[], today: string): string | null {
  const recent = history.filter((m) => m.role === "user").slice(-4).reverse();
  for (const m of recent) {
    // An explicit date ("27 tarikh", "27 Oct", a tapped slot label) means the model knows better.
    if (EXPLICIT_DATE.test(m.content)) return null;
    const day = dayInText(m.content, today);
    if (day) return day >= today ? day : null;
  }
  return null;
}
