import type { Slot } from "../protocol";
import type { BusinessKnowledge, BusyInterval } from "./types";

// India has a single timezone and no daylight saving, so a fixed offset is
// exact. Multi-country support would switch this to a tz database.
const IST = "+05:30";
const STEP_MIN = 15;
const LEAD_MIN = 30;

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h! * 60 + m!;
};

const istDate = (date: string, minutes: number) =>
  new Date(`${date}T${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:00${IST}`);

/** "YYYY-MM-DD" for a moment, in IST. */
export function istDay(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(at);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00${IST}`);
  d.setUTCDate(d.getUTCDate() + days);
  return istDay(d);
}

export function slotLabel(startsAt: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(startsAt);
}

export const encodeSlotId = (serviceId: string, staffId: string, startsAt: Date) =>
  `${serviceId}~${staffId}~${startsAt.getTime()}`;

export function decodeSlotId(slotId: string) {
  const [serviceId, staffId, epoch] = slotId.split("~");
  const time = Number(epoch);
  if (!serviceId || !staffId || !Number.isFinite(time)) return null;
  return { serviceId, staffId, startsAt: new Date(time) };
}

/**
 * Free start times for one service on one day.
 *
 * A staff member's own hours for a weekday replace the business hours for
 * that day (e.g. "Sunday: only Dr. Mehta, 10-1"). Busy intervals are live
 * appointments (confirmed or awaiting payment). When several staff are free
 * at the same time, the first one listed for the service gets the slot.
 */
export function findFreeSlots(
  business: BusinessKnowledge,
  serviceId: string,
  date: string,
  busy: BusyInterval[],
  now: Date,
): Slot[] {
  const service = business.services.find((s) => s.id === serviceId);
  if (!service) return [];
  const weekday = istDate(date, 12 * 60).getUTCDay();
  const earliest = now.getTime() + LEAD_MIN * 60_000;
  const taken = new Map<number, Slot>();

  for (const staffId of service.staffIds) {
    const person = business.staff.find((p) => p.id === staffId);
    if (!person) continue;
    const own = business.hours.filter((h) => h.weekday === weekday && h.staffId === staffId);
    const windows = own.length ? own : business.hours.filter((h) => h.weekday === weekday && h.staffId === null);
    const staffBusy = busy
      .filter((b) => b.staffId === staffId)
      .map((b) => [new Date(b.startsAt).getTime(), new Date(b.endsAt).getTime()] as const);

    for (const w of windows) {
      for (let m = toMinutes(w.start); m + service.durationMin <= toMinutes(w.end); m += STEP_MIN) {
        const start = istDate(date, m);
        const end = start.getTime() + service.durationMin * 60_000;
        if (start.getTime() < earliest || taken.has(start.getTime())) continue;
        if (staffBusy.some(([s, e]) => start.getTime() < e && end > s)) continue;
        taken.set(start.getTime(), {
          id: encodeSlotId(service.id, staffId, start),
          serviceId: service.id,
          serviceName: service.name,
          staffName: person.name,
          startsAt: start.toISOString(),
          label: slotLabel(start),
        });
      }
    }
  }
  return [...taken.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** Picks up to n slots spread across the day, so morning and evening both show. */
export function spread<T>(items: T[], n: number): T[] {
  if (items.length <= n) return items;
  return Array.from({ length: n }, (_, i) => items[Math.round((i * (items.length - 1)) / (n - 1))]!);
}
