"use client";

import { Search } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { updateBooking, type BookingAction } from "@/app/(dashboard)/dashboard/bookings/actions";
import { Card } from "@/components/ui/card";
import type { Booking } from "@/lib/mock/dashboard";
import { cn, formatDay, formatTime } from "@/lib/utils";
import { BookingStatusBadge } from "./status";

const sourceLabel: Record<Booking["source"], string> = {
  whatsapp: "WhatsApp",
  web: "Website",
  walk_in: "Walk-in",
  dashboard: "Your team",
};

const istDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export function BookingsTable({ bookings, sample }: { bookings: Booking[]; sample: boolean }) {
  const today = istDay(new Date().toISOString());
  const tomorrow = istDay(new Date(Date.now() + 86_400_000).toISOString());
  const days = useMemo(() => [...new Set(bookings.map((b) => istDay(b.startsAt)))].sort(), [bookings]);
  // Open on today, or the next day with bookings.
  const [day, setDay] = useState(days.find((d) => d >= today) ?? days.at(-1) ?? "");
  const [query, setQuery] = useState("");

  const rows = bookings
    .filter((b) => istDay(b.startsAt) === day)
    .filter((b) => !query || `${b.customer} ${b.service} ${b.staff}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-black/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Day">
          {days.map((d) => {
            const first = bookings.find((b) => istDay(b.startsAt) === d)!;
            return (
              <button
                key={d}
                role="tab"
                aria-selected={day === d}
                onClick={() => setDay(d)}
                className={cn(
                  "shrink-0 rounded-xl px-3.5 py-2 text-sm font-medium transition",
                  day === d ? "bg-ink text-white" : "text-slate-600 hover:bg-black/5",
                )}
              >
                {d === today ? "Today" : d === tomorrow ? "Tomorrow" : formatDay(first.startsAt)}
                <span className={cn("ml-2 text-xs", day === d ? "text-white/60" : "text-slate-400")}>
                  {bookings.filter((b) => istDay(b.startsAt) === d).length}
                </span>
              </button>
            );
          })}
        </div>
        <label className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search bookings"
            aria-label="Search bookings"
            className="h-9 w-full rounded-xl bg-slate-100 pr-3 pl-9 text-sm outline-none ring-brand-200 transition focus:bg-white focus:ring-4 sm:w-64"
          />
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50/70 text-xs text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Time</th>
              <th className="px-3 py-3 font-medium">Customer</th>
              <th className="px-3 py-3 font-medium">Service</th>
              <th className="px-3 py-3 font-medium">With</th>
              <th className="px-3 py-3 font-medium">Booked via</th>
              <th className="px-3 py-3 text-right font-medium">Amount</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {rows.map((b) => (
              <tr key={b.id} className="transition hover:bg-black/[0.02]">
                <td className="px-5 py-3.5 font-semibold whitespace-nowrap tabular-nums">{formatTime(b.startsAt)}</td>
                <td className="px-3 py-3.5">
                  <p className="font-medium">{b.customer}</p>
                  {b.phone && (
                    <a href={`tel:${b.phone}`} className="text-xs text-slate-400 hover:text-brand-700">
                      {b.phone}
                    </a>
                  )}
                </td>
                <td className="px-3 py-3.5 text-slate-600">{b.service}</td>
                <td className="px-3 py-3.5 text-slate-600">{b.staff}</td>
                <td className="px-3 py-3.5 text-slate-600">{sourceLabel[b.source]}</td>
                <td className="px-3 py-3.5 text-right tabular-nums">{b.amountInr ? `₹${b.amountInr.toLocaleString("en-IN")}` : "Free"}</td>
                <td className="px-3 py-3.5">
                  <BookingStatusBadge status={b.status} />
                </td>
                <td className="px-5 py-3.5">{!sample && <RowActions booking={b} />}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                  {bookings.length ? "No bookings match." : "No bookings yet. When the AI holds a slot, it shows up here."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

const ACTIONS: Record<Booking["status"], Array<{ action: BookingAction; label: string }>> = {
  pending_payment: [
    { action: "mark_paid", label: "Mark paid" },
    { action: "cancel", label: "Cancel" },
  ],
  expired: [{ action: "mark_paid", label: "Mark paid" }],
  confirmed: [
    { action: "complete", label: "Visited" },
    { action: "no_show", label: "No-show" },
    { action: "cancel", label: "Cancel" },
  ],
  completed: [],
  cancelled: [],
  no_show: [],
};

/** Status changes for one booking. Cancel asks once more before it runs. */
function RowActions({ booking }: { booking: Booking }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = (action: BookingAction) => {
    if (action === "cancel" && !confirming) return setConfirming(true);
    setConfirming(false);
    setError(null);
    startTransition(async () => {
      const r = await updateBooking(booking.id, action);
      if (!r.ok) setError(r.error);
    });
  };

  const actions = ACTIONS[booking.status];
  if (!actions.length) return null;
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex justify-end gap-1">
        {actions.map(({ action, label }) => (
          <button
            key={action}
            onClick={() => run(action)}
            disabled={pending}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition disabled:opacity-50",
              action === "mark_paid" ? "bg-brand-700 text-white hover:bg-brand-800" : "bg-slate-100 text-slate-700 hover:bg-slate-200",
              action === "cancel" && confirming && "bg-red-600 text-white hover:bg-red-700",
            )}
          >
            {action === "cancel" && confirming ? "Cancel booking?" : label}
          </button>
        ))}
      </div>
      {error && <p className="max-w-56 text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}
