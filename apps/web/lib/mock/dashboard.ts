/**
 * Dashboard fixtures. Mirrors the `conversations`, `messages`,
 * `appointments` and `customers` tables from the plan so the screens
 * can move to Supabase queries without UI changes.
 */
import { istDateTime } from "./slots";

export type Channel = "whatsapp" | "web";
/** ai = bot is handling it, needs_human = bot handed off, human = owner took over */
export type ConversationStatus = "ai" | "needs_human" | "human" | "resolved";

export interface InboxMessage {
  id: string;
  /** note = a message only staff see, written by the system. */
  from: "customer" | "ai" | "owner" | "note";
  text: string;
  at: string;
}

export interface Conversation {
  id: string;
  customer: { name: string; phone: string | null; visits?: number };
  channel: Channel;
  status: ConversationStatus;
  intent: string;
  unread: boolean;
  costInr: number;
  /** Model of the latest AI reply, null before the AI answered. */
  model: string | null;
  messages: InboxMessage[];
}

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

export const conversations: Conversation[] = [
  {
    id: "c1",
    customer: { name: "Priya Deshpande", phone: "+91 98220 4XX18", visits: 3 },
    channel: "whatsapp",
    status: "needs_human",
    intent: "Report query",
    unread: true,
    costInr: 1.4,
    model: "sonnet",
    messages: [
      { id: "m1", from: "customer", text: "Hi, mere father ka PFT report kal aana tha, abhi tak nahi aaya", at: minutesAgo(14) },
      { id: "m2", from: "ai", text: "Sorry for the delay. PFT reports usually 30 minute mein ready hote hain. Main clinic team ko abhi bata rahi hoon taaki woh check karke aapko report bhej sakein.", at: minutesAgo(13) },
      { id: "m3", from: "customer", text: "Please jaldi, doctor ko kal dikhana hai", at: minutesAgo(12) },
    ],
  },
  {
    id: "c2",
    customer: { name: "Rahul Joshi", phone: "+91 90110 6XX42", visits: 1 },
    channel: "web",
    status: "ai",
    intent: "Booking",
    unread: true,
    costInr: 0.32,
    model: "haiku",
    messages: [
      { id: "m1", from: "customer", text: "Kal Dr. Kulkarni ka appointment chahiye, asthma ke liye", at: minutesAgo(6) },
      { id: "m2", from: "ai", text: "Zaroor! Chest & asthma consultation ₹800 hai. Kal ke liye 10:30 AM, 11:15 AM aur 5:30 PM khaali hain.", at: minutesAgo(6) },
      { id: "m3", from: "customer", text: "11:15 theek hai", at: minutesAgo(5) },
      { id: "m4", from: "ai", text: "Done! 11:15 AM 10 minute ke liye hold hai. Ye raha payment link: rzp.io/l/…", at: minutesAgo(5) },
    ],
  },
  {
    id: "c3",
    customer: { name: "Sneha Kulkarni", phone: "+91 77200 1XX09", visits: 5 },
    channel: "whatsapp",
    status: "resolved",
    intent: "Timings",
    unread: false,
    costInr: 0.18,
    model: "haiku",
    messages: [
      { id: "m1", from: "customer", text: "Sunday ko clinic khula hai?", at: minutesAgo(52) },
      { id: "m2", from: "ai", text: "Haan, Sunday 10:00 AM se 1:00 PM tak, sirf Dr. Mehta available hain.", at: minutesAgo(52) },
      { id: "m3", from: "customer", text: "Ok thanks 👍", at: minutesAgo(50) },
    ],
  },
  {
    id: "c4",
    customer: { name: "Amit Shah", phone: "+91 98500 3XX77", visits: 2 },
    channel: "whatsapp",
    status: "human",
    intent: "Complaint",
    unread: false,
    costInr: 0.95,
    model: "sonnet",
    messages: [
      { id: "m1", from: "customer", text: "Last time 40 min wait karna pada appointment ke bawajood", at: minutesAgo(140) },
      { id: "m2", from: "ai", text: "Mujhe bahut afsos hai. Main ye clinic team tak pahucha rahi hoon.", at: minutesAgo(139) },
      { id: "m3", from: "owner", text: "Amit ji, sorry for that. Us din emergency case aa gaya tha. Next visit par aapko pehla slot denge.", at: minutesAgo(120) },
    ],
  },
  {
    id: "c5",
    customer: { name: "Fatima Sayed", phone: "+91 88888 2XX31", visits: 1 },
    channel: "web",
    status: "resolved",
    intent: "Fees",
    unread: false,
    costInr: 0.21,
    model: "haiku",
    messages: [
      { id: "m1", from: "customer", text: "Physiotherapy session ki fees?", at: minutesAgo(200) },
      { id: "m2", from: "ai", text: "Physiotherapy ₹700 per session hai, 45 minute ka session hota hai.", at: minutesAgo(200) },
    ],
  },
  {
    id: "c6",
    customer: { name: "Vikram Rao", phone: "+91 99600 7XX55", visits: 4 },
    channel: "whatsapp",
    status: "resolved",
    intent: "Booking",
    unread: false,
    costInr: 0.41,
    model: "haiku",
    messages: [
      { id: "m1", from: "customer", text: "Follow up ke liye aaj shaam ka slot?", at: minutesAgo(320) },
      { id: "m2", from: "ai", text: "Aaj 7:00 PM Dr. Mehta ke saath khaali hai. Follow-up free hai. Book kar doon?", at: minutesAgo(320) },
      { id: "m3", from: "customer", text: "Haan", at: minutesAgo(319) },
      { id: "m4", from: "ai", text: "Booked ✅ Aaj 7:00 PM, Dr. Anjali Mehta.", at: minutesAgo(319) },
    ],
  },
];

/** expired = a pending_payment hold that ran out (shown, never stored). */
export type BookingStatus = "confirmed" | "pending_payment" | "completed" | "cancelled" | "no_show" | "expired";

export interface Booking {
  id: string;
  customer: string;
  phone: string | null;
  service: string;
  staff: string;
  startsAt: string;
  amountInr: number;
  status: BookingStatus;
  source: Channel | "walk_in" | "dashboard";
}

export const bookings: Booking[] = [
  { id: "b1", customer: "Kavita Nair", phone: "+91 98XXX 21X04", service: "General consultation", staff: "Dr. Anjali Mehta", startsAt: istDateTime(0, 10, 0), amountInr: 500, status: "completed", source: "whatsapp" },
  { id: "b2", customer: "Arjun Patil", phone: "+91 97XXX 88X10", service: "Lung function test", staff: "Dr. Rohan Kulkarni", startsAt: istDateTime(0, 11, 30), amountInr: 1200, status: "completed", source: "web" },
  { id: "b3", customer: "Meera Iyer", phone: "+91 90XXX 45X66", service: "Physiotherapy session", staff: "Nisha Patil", startsAt: istDateTime(0, 17, 0), amountInr: 700, status: "confirmed", source: "whatsapp" },
  { id: "b4", customer: "Vikram Rao", phone: "+91 99600 7XX55", service: "Follow-up", staff: "Dr. Anjali Mehta", startsAt: istDateTime(0, 19, 0), amountInr: 0, status: "confirmed", source: "whatsapp" },
  { id: "b5", customer: "Sanjay Gupta", phone: "+91 98XXX 10X92", service: "General consultation", staff: "Dr. Anjali Mehta", startsAt: istDateTime(0, 20, 15), amountInr: 500, status: "no_show", source: "walk_in" },
  { id: "b6", customer: "Rahul Joshi", phone: "+91 90110 6XX42", service: "Chest & asthma consultation", staff: "Dr. Rohan Kulkarni", startsAt: istDateTime(1, 11, 15), amountInr: 800, status: "pending_payment", source: "web" },
  { id: "b7", customer: "Neha Bhosale", phone: "+91 96XXX 33X21", service: "General consultation", staff: "Dr. Anjali Mehta", startsAt: istDateTime(1, 9, 30), amountInr: 500, status: "confirmed", source: "whatsapp" },
  { id: "b8", customer: "Imran Khan", phone: "+91 98XXX 70X45", service: "Physiotherapy session", staff: "Nisha Patil", startsAt: istDateTime(1, 18, 0), amountInr: 700, status: "confirmed", source: "web" },
  { id: "b9", customer: "Pooja Mane", phone: "+91 95XXX 12X87", service: "Lung function test", staff: "Dr. Rohan Kulkarni", startsAt: istDateTime(2, 12, 0), amountInr: 1200, status: "cancelled", source: "whatsapp" },
  { id: "b10", customer: "Deepak Verma", phone: "+91 93XXX 64X02", service: "Chest & asthma consultation", staff: "Dr. Rohan Kulkarni", startsAt: istDateTime(2, 17, 30), amountInr: 800, status: "confirmed", source: "whatsapp" },
];

/** Last 7 days, oldest first. Sample data, not measurements. */
export const weekly = [
  { day: "Fri", conversations: 31, aiResolved: 25, bookings: 7 },
  { day: "Sat", conversations: 44, aiResolved: 37, bookings: 11 },
  { day: "Sun", conversations: 19, aiResolved: 17, bookings: 4 },
  { day: "Mon", conversations: 38, aiResolved: 31, bookings: 9 },
  { day: "Tue", conversations: 35, aiResolved: 30, bookings: 8 },
  { day: "Wed", conversations: 41, aiResolved: 33, bookings: 12 },
  { day: "Thu", conversations: 29, aiResolved: 25, bookings: 6 },
];

export const documents = [
  { id: "d1", name: "Clinic rate card.pdf", type: "PDF", chunks: 12, status: "ready" as const, updated: minutesAgo(60 * 26) },
  { id: "d2", name: "Patient guide.pdf", type: "PDF", chunks: 34, status: "ready" as const, updated: minutesAgo(60 * 50) },
  { id: "d3", name: "sunriseclinic.in", type: "Website", chunks: 21, status: "ready" as const, updated: minutesAgo(60 * 72) },
  { id: "d4", name: "Monsoon OPD timings.pdf", type: "PDF", chunks: 0, status: "processing" as const, updated: minutesAgo(1) },
];
