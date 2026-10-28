import type { Slot } from "@frontdesk/core";
import { services, staff } from "./demo-clinic";

const IST_OFFSET = "+05:30";

/** Returns an ISO string for `hh:mm` IST, `dayOffset` days from today (IST). */
export function istDateTime(dayOffset: number, hh: number, mm = 0) {
  const todayIst = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date()); // YYYY-MM-DD
  const base = new Date(`${todayIst}T00:00:00${IST_OFFSET}`);
  base.setUTCDate(base.getUTCDate() + dayOffset);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(base);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${day}T${pad(hh)}:${pad(mm)}:00${IST_OFFSET}`;
}

const label = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));

/** Slot ids are self-describing so the mock can "book" without a DB. */
export function encodeSlotId(serviceId: string, staffId: string, startsAt: string) {
  return [serviceId, staffId, new Date(startsAt).getTime()].join("~");
}

export function decodeSlotId(slotId: string): Slot | null {
  const [serviceId, staffId, epoch] = slotId.split("~");
  const service = services.find((s) => s.id === serviceId);
  const person = staff.find((s) => s.id === staffId);
  const time = Number(epoch);
  if (!serviceId || !staffId || !service || !person || !Number.isFinite(time)) return null;
  const startsAt = new Date(time).toISOString();
  return {
    id: slotId,
    serviceId,
    serviceName: service.name,
    staffName: person.name,
    startsAt,
    label: label(startsAt),
  };
}

/** Mock check_availability: a few free slots tomorrow for the given service. */
export function findSlots(serviceId = "gp-consult"): Slot[] {
  const service = services.find((s) => s.id === serviceId) ?? services[0]!;
  const staffId = service.staffIds[0]!;
  const times: Array<[number, number]> = [
    [10, 30],
    [11, 15],
    [12, 45],
    [17, 30],
    [19, 0],
  ];
  return times.map(([h, m]) => {
    const startsAt = istDateTime(1, h, m);
    return decodeSlotId(encodeSlotId(service.id, staffId, startsAt))!;
  });
}
