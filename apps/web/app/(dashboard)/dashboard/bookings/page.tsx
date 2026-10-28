import type { Metadata } from "next";
import { BookingsTable } from "@/components/dashboard/bookings-table";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getBusinessContext } from "@/lib/data/business";
import { getBookings } from "@/lib/data/dashboard";

export const metadata: Metadata = { title: "Bookings" };
export const dynamic = "force-dynamic";

export default async function BookingsPage() {
  const { items: bookings, sample } = await getBookings(await getBusinessContext());
  const now = Date.now();
  const upcoming = bookings.filter(
    (b) => (b.status === "confirmed" || b.status === "pending_payment") && new Date(b.startsAt).getTime() > now,
  );
  const live = bookings.filter((b) => b.status !== "expired" && b.status !== "cancelled");
  const viaAi = live.filter((b) => b.source === "web" || b.source === "whatsapp").length;
  const collected = bookings
    .filter((b) => b.status === "confirmed" || b.status === "completed")
    .reduce((n, b) => n + b.amountInr, 0);

  return (
    <div className="container-page space-y-6 py-8">
      <PageHeader
        title="Bookings"
        description="Every appointment the AI booked, from the last 7 days onwards. Mark advances paid here until online payments are switched on."
        actions={sample ? <Badge tone="amber" className="self-center">Sample data</Badge> : undefined}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Upcoming", String(upcoming.length)],
          ["Booked by AI", `${viaAi} of ${live.length}`],
          ["Advance collected", `₹${collected.toLocaleString("en-IN")}`],
        ].map(([label, value]) => (
          <Card key={label} className="p-5">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-extrabold tracking-tight tabular-nums">{value}</p>
          </Card>
        ))}
      </div>
      <BookingsTable bookings={bookings} sample={sample} />
    </div>
  );
}
