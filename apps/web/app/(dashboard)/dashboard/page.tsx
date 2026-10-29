import { ArrowRight, Bot, PartyPopper, CalendarCheck, IndianRupee, MessagesSquare, TrendingUp } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { BookingStatusBadge, ChannelIcon, ConversationStatusBadge } from "@/components/dashboard/status";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { getBusinessContext } from "@/lib/data/business";
import { getBookings, getConversations, getWeekly, USD_INR, type DayStats } from "@/lib/data/dashboard";
import { formatTime, initials, relativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const ctx = await getBusinessContext();
  const { welcome } = await searchParams;
  const [{ items: conversations, sample }, { items: bookings }, { days: weekly, costUsd }] = await Promise.all([
    getConversations(ctx),
    getBookings(ctx),
    getWeekly(ctx),
  ]);
  const total = weekly.reduce((n, d) => n + d.conversations, 0);
  const resolved = weekly.reduce((n, d) => n + d.aiResolved, 0);
  const booked = weekly.reduce((n, d) => n + d.bookings, 0);
  const avgCost = total ? (costUsd * USD_INR) / total : 0;

  const needsYou = conversations.filter((c) => c.status === "needs_human");
  const todayKey = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const today = bookings
    .filter((b) => b.status !== "expired" && b.status !== "cancelled")
    .filter((b) => new Date(b.startsAt).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) === todayKey)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const hour = Number(new Date().toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="container-page space-y-6 py-8">
      <PageHeader
        title={ctx.mode === "demo" ? `${greeting}, Dr. Mehta` : greeting}
        description={`Here's what ${ctx.business?.name ?? "your"}'s AI receptionist did in the last 7 days.`}
        actions={
          <>
            {sample && <Badge tone="amber" className="self-center">Sample data</Badge>}
            <ButtonLink href="/dashboard/inbox" variant="secondary" size="sm">
              Open inbox
            </ButtonLink>
          </>
        }
      />

      {welcome && (
        <div className="flex items-start gap-3 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-900 p-5 text-white shadow-glow">
          <PartyPopper className="mt-0.5 size-5 shrink-0 text-brand-200" />
          <div>
            <p className="font-semibold">{ctx.business?.name} is set up.</p>
            <p className="mt-1 text-sm text-white/75">
              Next: add your FAQ in the Knowledge base, then put the chat widget on your website from Channels. The
              numbers below are sample data until your first real chats come in.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={MessagesSquare} label="Conversations" value={String(total)} hint="last 7 days" />
        <Stat
          icon={Bot}
          label="Resolved by AI"
          value={total ? `${Math.round((resolved / total) * 100)}%` : "-"}
          hint={`${resolved} without your help`}
          highlight
        />
        <Stat icon={CalendarCheck} label="Bookings by AI" value={String(booked)} hint="slots held or confirmed" />
        <Stat
          icon={IndianRupee}
          label="AI cost / conversation"
          value={`₹${avgCost.toFixed(2)}`}
          hint={sample ? "sample estimate" : costUsd === 0 ? "free model" : "from real token usage"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader
            title="Conversations this week"
            description="Resolved by AI vs handed to your team"
            action={
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <Legend className="bg-brand-500" label="AI resolved" />
                <Legend className="bg-saffron-300" label="Handed to you" />
              </div>
            }
          />
          <WeeklyBars weekly={weekly} />
        </Card>

        <Card className="flex flex-col">
          <CardHeader
            title="Needs your attention"
            description="The AI handed these over"
            action={<Badge tone="amber">{needsYou.length}</Badge>}
          />
          <ul className="mt-3 flex-1 divide-y divide-black/5 px-2 pb-2">
            {needsYou.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-400">Nothing waiting for you.</li>}
            {needsYou.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/dashboard/inbox?c=${c.id}`}
                  className="flex items-start gap-3 rounded-xl px-3 py-3 transition hover:bg-black/[0.03]"
                >
                  <Avatar name={c.customer.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">{c.customer.name}</p>
                      <ChannelIcon channel={c.channel} />
                      <span className="ml-auto text-xs whitespace-nowrap text-slate-400">
                        {relativeTime(c.messages.at(-1)!.at)}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{c.messages.at(-1)!.text}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <div className="border-t border-black/5 px-5 py-3">
            <Link href="/dashboard/inbox" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
              Go to inbox <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.6fr]">
        <Card>
          <CardHeader title="Today's appointments" description={`${today.length} scheduled`} />
          <ol className="mt-4 space-y-1 px-5 pb-5">
            {today.length === 0 && <li className="py-6 text-center text-sm text-slate-400">No appointments today.</li>}
            {today.map((b) => (
              <li key={b.id} className="flex items-center gap-4 rounded-xl py-2">
                <span className="w-16 shrink-0 text-sm font-semibold tabular-nums">{formatTime(b.startsAt)}</span>
                <span className="h-9 w-0.5 shrink-0 rounded-full bg-brand-200" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{b.customer}</p>
                  <p className="truncate text-xs text-slate-500">
                    {b.service} · {b.staff}
                  </p>
                </div>
                <BookingStatusBadge status={b.status} />
              </li>
            ))}
          </ol>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title="Recent conversations"
            action={
              <Link href="/dashboard/inbox" className="text-sm font-semibold text-brand-700 hover:underline">
                View all
              </Link>
            }
          />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-y border-black/5 bg-slate-50/70 text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Customer</th>
                  <th className="px-3 py-2.5 font-medium">Topic</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 text-right font-medium">Cost</th>
                  <th className="px-5 py-2.5 text-right font-medium">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {conversations.slice(0, 5).map((c) => (
                  <tr key={c.id} className="transition hover:bg-black/[0.02]">
                    <td className="px-5 py-3">
                      <Link href={`/dashboard/inbox?c=${c.id}`} className="flex items-center gap-2 font-medium">
                        <ChannelIcon channel={c.channel} />
                        {c.customer.name}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-slate-600">{c.intent}</td>
                    <td className="px-3 py-3">
                      <ConversationStatusBadge status={c.status} />
                    </td>
                    <td className="px-3 py-3 text-right text-slate-600 tabular-nums">₹{c.costInr.toFixed(2)}</td>
                    <td className="px-5 py-3 text-right whitespace-nowrap text-slate-400">
                      {relativeTime(c.messages.at(-1)!.at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-800 to-brand-950 text-white shadow-glow ring-brand-900" : "transition hover:-translate-y-0.5 hover:shadow-lift"}>
      {highlight && <div aria-hidden className="absolute -top-10 -right-10 size-32 rounded-full bg-saffron-400/30 blur-2xl" />}
      <div className="relative p-5">
        <div className="flex items-center justify-between">
          <p className={highlight ? "text-sm font-medium text-white/75" : "text-sm font-medium text-slate-500"}>{label}</p>
          <span
            className={
              highlight
                ? "grid size-9 place-items-center rounded-xl bg-white/15 ring-1 ring-white/20"
                : "grid size-9 place-items-center rounded-xl bg-gradient-to-b from-brand-50 to-brand-100 text-brand-700 ring-1 ring-brand-200/60"
            }
          >
            <Icon className="size-4" />
          </span>
        </div>
        <p className="mt-3 text-3xl font-extrabold tracking-tight tabular-nums">{value}</p>
        <p className={highlight ? "mt-1 flex items-center gap-1 text-xs text-white/70" : "mt-1 flex items-center gap-1 text-xs text-slate-500"}>
          <TrendingUp className="size-3" /> {hint}
        </p>
      </div>
    </Card>
  );
}

function WeeklyBars({ weekly }: { weekly: DayStats[] }) {
  const max = Math.max(1, ...weekly.map((d) => d.conversations));
  return (
    <div className="px-5 pt-6 pb-5">
      <div className="flex h-56 items-end gap-3 sm:gap-5">
        {weekly.map((d) => {
          const handed = d.conversations - d.aiResolved;
          return (
            <div key={d.day} className="group flex h-full flex-1 flex-col items-center justify-end gap-2">
              <span className="text-xs font-semibold text-slate-600 tabular-nums opacity-0 transition group-hover:opacity-100">
                {d.conversations}
              </span>
              <div
                className="flex w-full max-w-12 flex-col overflow-hidden rounded-lg"
                style={{ height: `${(d.conversations / max) * 100}%` }}
                title={`${d.day}: ${d.aiResolved} AI resolved, ${handed} handed to you`}
              >
                <div className="bg-gradient-to-t from-saffron-400 to-saffron-300" style={{ flex: handed }} />
                <div className="mt-0.5 bg-gradient-to-t from-brand-700 to-brand-400 transition group-hover:from-brand-800 group-hover:to-brand-500" style={{ flex: d.aiResolved }} />
              </div>
              <span className="text-xs text-slate-500">{d.day}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="hidden items-center gap-1.5 sm:inline-flex">
      <span className={`size-2.5 rounded-sm ${className}`} /> {label}
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-100 to-saffron-100 text-xs font-bold text-brand-800">
      {initials(name)}
    </span>
  );
}
