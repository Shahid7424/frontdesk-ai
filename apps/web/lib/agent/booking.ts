import "server-only";
import type { PaymentLink } from "@frontdesk/core";
import {
  decodeSlotId,
  encodeSlotId,
  findFreeSlots,
  istDay,
  slotLabel,
  type BookingLookup,
  type BusinessKnowledge,
  type CancelOutcome,
} from "@frontdesk/core/agent";
import { queueAlert } from "@/lib/alerts";
import { appOrigin } from "@/lib/app-url";
import { flagForTeam } from "@/lib/payments/confirm";
import { createPaymentLink, isRazorpayConfigured, RAZORPAY_MIN_EXPIRY_MINUTES } from "@/lib/payments/razorpay";
import { createServiceClient } from "@/lib/supabase/server";
import { getBusy } from "./knowledge";
import { reportError } from "@/lib/monitoring";

/** Razorpay links must stay open at least 15 minutes, so holds are longer with it. */
const HOLD_MINUTES = isRazorpayConfigured ? RAZORPAY_MIN_EXPIRY_MINUTES + 4 : 10;

/**
 * "online": paid services are held until the advance is paid (Razorpay, or
 * the test payment page while developing). "at_clinic": every booking is
 * confirmed at once and paid at the visit.
 */
export type PaymentMode = "online" | "at_clinic";

/** Online advances need Razorpay in production; locally the test payment page stands in. */
export const onlinePaymentsAvailable = isRazorpayConfigured || process.env.NODE_ENV !== "production";

type Bookable = BusinessKnowledge & { paymentMode: PaymentMode };

export type BookingResult =
  | { ok: true; appointmentId: string; serviceName: string; staffName: string; label: string; payment: PaymentLink | null }
  | { ok: false; reason: "invalid" | "taken" };

/**
 * Holds a slot the customer tapped. The slot id comes from the browser, so
 * nothing in it is trusted: the service and staff must belong to this
 * business and the time must still be free for that staff member. The
 * exclusion constraint on appointments is the final word when two people
 * tap the same slot at once.
 */
export async function holdSlot(
  business: Bookable,
  slotId: string,
  now: Date,
  customerId: string | null,
): Promise<BookingResult> {
  const slot = decodeSlotId(slotId);
  const service = slot && business.services.find((s) => s.id === slot.serviceId);
  const staff = slot && business.staff.find((p) => p.id === slot.staffId);
  if (!slot || !service || !staff || !service.staffIds.includes(staff.id)) return { ok: false, reason: "invalid" };

  const db = createServiceClient();
  const startsAt = slot.startsAt;
  const endsAt = new Date(startsAt.getTime() + service.durationMin * 60_000);

  // Expired holds still count for the exclusion constraint, so release them first.
  await db
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("business_id", business.id)
    .eq("staff_id", staff.id)
    .eq("status", "pending_payment")
    .lt("hold_expires_at", now.toISOString());

  // Re-check against working hours, lead time and live appointments, for this staff member only.
  const day = istDay(startsAt);
  const busy = await getBusy(business.id, [staff.id], `${day}T00:00:00+05:30`, endsAt.toISOString());
  const onlyThisStaff = {
    ...business,
    services: business.services.map((s) => (s.id === service.id ? { ...s, staffIds: [staff.id] } : s)),
  };
  const free = findFreeSlots(onlyThisStaff, service.id, day, busy, now);
  const match = free.find((s) => new Date(s.startsAt).getTime() === startsAt.getTime());
  if (!match) return { ok: false, reason: "taken" };

  const paid = service.pricePaise > 0 && business.paymentMode === "online" && onlinePaymentsAvailable;
  const holdUntil = new Date(now.getTime() + HOLD_MINUTES * 60_000);
  const { data, error } = await db
    .from("appointments")
    .insert({
      business_id: business.id,
      service_id: service.id,
      staff_id: staff.id,
      customer_id: customerId,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: paid ? "pending_payment" : "confirmed",
      hold_expires_at: paid ? holdUntil.toISOString() : null,
      source: "web",
      amount_paise: service.pricePaise,
    })
    .select("id")
    .single();

  // 23P01 = exclusion_violation: someone else got this slot a moment earlier.
  if (error?.code === "23P01") return { ok: false, reason: "taken" };
  if (error) throw new Error(`Could not hold slot: ${error.message}`);

  let payment: PaymentLink | null = null;
  if (paid) {
    try {
      payment = await newPaymentLink(business, data.id, service, customerId, holdUntil, match.label, staff.name);
    } catch (err) {
      // Never leave the customer with a hold they can't pay: confirm it and let the clinic collect at the visit.
      reportError("[booking] payment link failed, confirming without advance", err);
      await db.from("appointments").update({ status: "confirmed", hold_expires_at: null }).eq("id", data.id).eq("business_id", business.id);
      await flagForTeam(business.id, data.id, "The online payment link couldn't be created, so this booking was confirmed without an advance. Collect payment at the visit.");
    }
  }

  return { ok: true, appointmentId: data.id, serviceName: service.name, staffName: staff.name, label: match.label, payment };
}

/**
 * Which booking the customer means: the one made in this chat, or else
 * their next upcoming one among the bookings this browser remembers (a
 * booking id is a secret only the customer's own device has).
 */
async function customerBookingId(businessId: string, conversationId: string, knownIds: string[], now: Date): Promise<string | null> {
  const db = createServiceClient();
  const { data: ref } = await db
    .from("messages")
    .select("metadata")
    .eq("business_id", businessId)
    .eq("conversation_id", conversationId)
    .not("metadata->>appointmentId", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const inChat = (ref?.metadata as { appointmentId?: string } | null)?.appointmentId ?? null;
  if (inChat) {
    const { data: a } = await db.from("appointments").select("status, hold_expires_at").eq("id", inChat).eq("business_id", businessId).maybeSingle();
    // A booking cancelled for good, or done with, gives way to an earlier one still coming up.
    const over = !a || a.status === "completed" || a.status === "no_show" || (a.status === "cancelled" && a.hold_expires_at === null);
    if (!over || !knownIds.length) return inChat;
  }
  if (!knownIds.length) return inChat;
  const { data: next } = await db
    .from("appointments")
    .select("id")
    .eq("business_id", businessId)
    .in("id", knownIds)
    .in("status", ["confirmed", "pending_payment"])
    .gt("starts_at", now.toISOString())
    .order("starts_at")
    .limit(1)
    .maybeSingle();
  return next?.id ?? inChat;
}

/**
 * The customer's booking, for "payment link do" and "booking status". With
 * renew, a lapsed hold is renewed when the slot is still free, so the
 * customer isn't told to start over just because they took a while to pay.
 */
export async function findChatBooking(
  business: Bookable,
  conversationId: string,
  now: Date,
  options: { knownIds?: string[]; renew?: boolean } = {},
): Promise<BookingLookup> {
  const db = createServiceClient();
  const appointmentId = await customerBookingId(business.id, conversationId, options.knownIds ?? [], now);
  if (!appointmentId) return { status: "none" };

  const { data: a } = await db
    .from("appointments")
    .select("id, service_id, staff_id, customer_id, starts_at, status, hold_expires_at, amount_paise")
    .eq("id", appointmentId)
    .eq("business_id", business.id)
    .maybeSingle();
  // Look the names up among all rows: a person or service removed in Settings still has bookings.
  const names = a && (await bookingNames(business.id, a));
  if (!a || !names) return { status: "none" };

  const service = business.services.find((s) => s.id === a.service_id);
  const staff = business.staff.find((p) => p.id === a.staff_id);
  if (a.status === "confirmed" || a.status === "completed") return { status: "confirmed", ...names };

  const holdLeft = a.hold_expires_at ? new Date(a.hold_expires_at).getTime() - now.getTime() : 0;
  if (a.status === "pending_payment" && holdLeft > 0) {
    const price = { pricePaise: a.amount_paise };
    return { status: "pending_payment", ...names, reheld: false, payment: await existingPaymentLink(a.id, price, Math.ceil(holdLeft / 60_000)) };
  }
  // Only a hold that ran out gets renewed; a cancellation stays cancelled.
  const lapsed = a.status === "pending_payment" || (a.status === "cancelled" && a.hold_expires_at !== null);
  if (!options.renew || !lapsed || !service || !staff || new Date(a.starts_at) <= now) return { status: "expired", ...names };

  const again = await holdSlot(business, encodeSlotId(service.id, staff.id, new Date(a.starts_at)), now, a.customer_id);
  if (!again.ok || !again.payment) return { status: "expired", ...names };
  await db.from("messages").insert({
    business_id: business.id,
    conversation_id: conversationId,
    role: "tool",
    content: "Hold renewed",
    metadata: { appointmentId: again.appointmentId },
  });
  return { status: "pending_payment", ...names, bookingId: again.appointmentId, reheld: true, payment: again.payment };
}

async function bookingNames(businessId: string, a: { id: string; service_id: string; staff_id: string; starts_at: string }) {
  const db = createServiceClient();
  const [{ data: service }, { data: staff }] = await Promise.all([
    db.from("services").select("name").eq("id", a.service_id).eq("business_id", businessId).maybeSingle(),
    db.from("staff").select("name").eq("id", a.staff_id).eq("business_id", businessId).maybeSingle(),
  ]);
  if (!service || !staff) return null;
  return { bookingId: a.id, serviceId: a.service_id, label: slotLabel(new Date(a.starts_at)), serviceName: service.name, staffName: staff.name };
}

/** A note in the chat that only staff see (the inbox shows it; the widget never does). */
async function noteForTeam(businessId: string, conversationId: string, appointmentId: string, note: string) {
  await createServiceClient()
    .from("messages")
    .insert({ business_id: businessId, conversation_id: conversationId, role: "tool", content: note, metadata: { staffNote: true, appointmentId } });
}

/**
 * Cancels the customer's booking from the chat. A paid advance isn't
 * refunded automatically: the chat goes to the inbox so the clinic
 * refunds by its own policy.
 */
export async function cancelChatBooking(business: Bookable, conversationId: string, now: Date, knownIds: string[]): Promise<CancelOutcome> {
  const booking = await findChatBooking(business, conversationId, now, { knownIds });
  if (booking.status !== "confirmed" && booking.status !== "pending_payment") return { status: "none" };

  const db = createServiceClient();
  const { data: a } = await db.from("appointments").select("starts_at").eq("id", booking.bookingId).eq("business_id", business.id).single();
  if (!a || new Date(a.starts_at) <= now) return { status: "too_late", label: booking.label };

  const { data: cancelled } = await db
    .from("appointments")
    .update({ status: "cancelled", hold_expires_at: null })
    .eq("id", booking.bookingId)
    .eq("business_id", business.id)
    .in("status", ["confirmed", "pending_payment"])
    .select("id")
    .maybeSingle();
  if (!cancelled) return { status: "none" };

  const { data: payment } = await db.from("payments").select("id").eq("appointment_id", booking.bookingId).eq("status", "paid").limit(1).maybeSingle();
  const what = `${booking.serviceName}, ${booking.label} with ${booking.staffName}`;
  if (payment) {
    await flagForTeam(business.id, booking.bookingId, `Customer cancelled ${what} from the chat. An advance was paid: please refund it as per your policy.`);
  } else {
    await noteForTeam(business.id, conversationId, booking.bookingId, `Customer cancelled ${what} from the chat. The slot is free again.`);
    queueAlert(business.id, { kind: "cancelled", appointmentId: booking.bookingId });
  }
  // So the cancel lands on this chat even when the booking was made in another one.
  await db.from("messages").insert({ business_id: business.id, conversation_id: conversationId, role: "tool", content: "Booking cancelled", metadata: { appointmentId: booking.bookingId } });
  return { status: "cancelled", label: booking.label, serviceName: booking.serviceName, staffName: booking.staffName, paid: Boolean(payment) };
}

export type MoveResult =
  | { ok: true; appointmentId: string; serviceName: string; staffName: string; label: string; from: string; status: "confirmed" | "pending_payment" }
  | { ok: false; reason: "invalid" | "taken" | "not_movable" };

/**
 * Moves a booking to the slot the customer tapped. Same service only, so
 * the price and any advance paid stay right. The booking id comes from
 * the browser and is checked against this business; the exclusion
 * constraint still stops a move onto a taken slot.
 */
export async function moveBooking(business: Bookable, conversationId: string, bookingId: string, slotId: string, now: Date): Promise<MoveResult> {
  const db = createServiceClient();
  const { data: a } = await db
    .from("appointments")
    .select("id, service_id, staff_id, starts_at, status, hold_expires_at")
    .eq("id", bookingId)
    .eq("business_id", business.id)
    .maybeSingle();
  const live = a && (a.status === "confirmed" || (a.status === "pending_payment" && a.hold_expires_at && new Date(a.hold_expires_at) > now));
  if (!a || !live || new Date(a.starts_at) <= now) return { ok: false, reason: "not_movable" };

  const slot = decodeSlotId(slotId);
  const service = slot && business.services.find((s) => s.id === slot.serviceId);
  const staff = slot && business.staff.find((p) => p.id === slot.staffId);
  if (!slot || !service || !staff || service.id !== a.service_id || !service.staffIds.includes(staff.id)) return { ok: false, reason: "invalid" };

  const endsAt = new Date(slot.startsAt.getTime() + service.durationMin * 60_000);
  const day = istDay(slot.startsAt);
  // The booking's own time doesn't block its new time.
  const busy = (await getBusy(business.id, [staff.id], `${day}T00:00:00+05:30`, endsAt.toISOString())).filter(
    (b) => !(b.staffId === a.staff_id && new Date(b.startsAt).getTime() === new Date(a.starts_at).getTime()),
  );
  const onlyThisStaff = {
    ...business,
    services: business.services.map((s) => (s.id === service.id ? { ...s, staffIds: [staff.id] } : s)),
  };
  const match = findFreeSlots(onlyThisStaff, service.id, day, busy, now).find((s) => new Date(s.startsAt).getTime() === slot.startsAt.getTime());
  if (!match) return { ok: false, reason: "taken" };

  const { data: moved, error } = await db
    .from("appointments")
    .update({ starts_at: slot.startsAt.toISOString(), ends_at: endsAt.toISOString(), staff_id: staff.id })
    .eq("id", a.id)
    .eq("business_id", business.id)
    .eq("status", a.status)
    .select("id")
    .maybeSingle();
  if (error?.code === "23P01") return { ok: false, reason: "taken" };
  if (error) throw new Error(`Could not move booking: ${error.message}`);
  if (!moved) return { ok: false, reason: "not_movable" };

  const from = slotLabel(new Date(a.starts_at));
  await noteForTeam(business.id, conversationId, a.id, `Customer moved ${service.name} from ${from} to ${match.label} with ${staff.name} from the chat.`);
  queueAlert(business.id, { kind: "moved", appointmentId: a.id, from });
  return { ok: true, appointmentId: a.id, serviceName: service.name, staffName: staff.name, label: match.label, from, status: a.status as "confirmed" | "pending_payment" };
}

/**
 * The link the customer pays with: a Razorpay Payment Link when keys are
 * set (recorded in payments so the webhook can find it), otherwise the
 * test payment page.
 */
async function newPaymentLink(
  business: BusinessKnowledge,
  appointmentId: string,
  service: { name: string; pricePaise: number },
  customerId: string | null,
  expiresAt: Date,
  label: string,
  staffName: string,
): Promise<PaymentLink> {
  const minutes = Math.round((expiresAt.getTime() - Date.now()) / 60_000);
  if (!isRazorpayConfigured) return testPaymentLink(appointmentId, service, minutes);

  const db = createServiceClient();
  const { data: customer } = customerId
    ? await db.from("customers").select("name, phone").eq("id", customerId).eq("business_id", business.id).maybeSingle()
    : { data: null };
  const link = await createPaymentLink({
    appointmentId,
    businessId: business.id,
    amountPaise: service.pricePaise,
    description: `${business.name}: ${service.name}, ${label} with ${staffName}`,
    customer: { name: customer?.name ?? null, phone: customer?.phone ?? null },
    expiresAt,
    callbackUrl: `${await appOrigin()}/pay/${appointmentId}`,
  });
  const { error } = await db.from("payments").insert({
    business_id: business.id,
    appointment_id: appointmentId,
    provider_link_id: link.id,
    amount_paise: service.pricePaise,
    status: "created",
    raw: { short_url: link.shortUrl },
  });
  if (error) throw new Error(`Could not save payment link: ${error.message}`);
  return { bookingId: appointmentId, url: link.shortUrl, amountInPaise: service.pricePaise, expiresInMinutes: minutes };
}

/** The open link for a hold, so "payment link do" doesn't create a second one. */
async function existingPaymentLink(appointmentId: string, service: { pricePaise: number }, minutes: number): Promise<PaymentLink> {
  const { data } = await createServiceClient()
    .from("payments")
    .select("raw")
    .eq("appointment_id", appointmentId)
    .eq("status", "created")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const url = (data?.raw as { short_url?: string } | null)?.short_url;
  return url ? { bookingId: appointmentId, url, amountInPaise: service.pricePaise, expiresInMinutes: minutes } : testPaymentLink(appointmentId, service, minutes);
}

function testPaymentLink(appointmentId: string, service: { pricePaise: number }, minutes: number): PaymentLink {
  return { bookingId: appointmentId, url: `/pay/${appointmentId}`, amountInPaise: service.pricePaise, expiresInMinutes: minutes };
}
