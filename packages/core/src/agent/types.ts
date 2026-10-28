import type { PaymentLink } from "../protocol";

/**
 * What the agent knows about one business. Loaded from Supabase by the
 * app; the agent itself never touches the database, so it stays testable
 * and the same code can run behind the widget, WhatsApp or an MCP server.
 */
export interface BusinessKnowledge {
  id: string;
  slug: string;
  name: string;
  vertical: "clinic" | "salon" | "coaching" | "other";
  area: string | null;
  address: string | null;
  phone: string | null;
  staff: Array<{ id: string; name: string; title: string | null }>;
  services: Array<{ id: string; name: string; durationMin: number; pricePaise: number; staffIds: string[] }>;
  /** Weekly hours. staffId null = whole business. weekday 0 = Sunday. Times are "HH:MM" IST. */
  hours: Array<{ weekday: number; start: string; end: string; staffId: string | null }>;
}

export interface BusyInterval {
  staffId: string;
  startsAt: string;
  endsAt: string;
}

/** Which booking, as show_booking and the change tools see it. */
interface BookingNames {
  bookingId: string;
  serviceId: string;
  label: string;
  serviceName: string;
  staffName: string;
}

/** The customer's booking (made in this chat, or earlier on this device), as show_booking reports it. */
export type BookingLookup =
  | { status: "none" }
  | ({ status: "confirmed" } & BookingNames)
  | ({ status: "pending_payment"; payment: PaymentLink; reheld: boolean } & BookingNames)
  /** The hold lapsed and someone else took the slot meanwhile. */
  | ({ status: "expired" } & BookingNames);

/** What cancel_booking did. */
export type CancelOutcome =
  | { status: "cancelled"; label: string; serviceName: string; staffName: string; /** An advance was paid, so the clinic owes a refund. */ paid: boolean }
  | { status: "none" }
  /** The appointment time has passed or is too close; the team decides. */
  | { status: "too_late"; label: string };
