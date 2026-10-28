import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/shell";
import { getBusinessContext } from "@/lib/data/business";
import { countNeedsYou } from "@/lib/data/dashboard";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s · FrontDesk AI" },
  robots: { index: false },
};

// Per-user data (and mock data that uses "now"), so never prerender.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getBusinessContext();
  if (ctx.mode === "live") {
    if (!ctx.user) redirect("/login?next=/dashboard");
    if (!ctx.business) redirect("/onboarding");
  }

  const needsYou = await countNeedsYou(ctx);
  return (
    <DashboardShell
      needsYou={needsYou}
      mode={ctx.mode}
      business={{ name: ctx.business!.name, area: ctx.business!.area ?? "" }}
      userLabel={ctx.mode === "demo" ? "Dr. Anjali Mehta" : ctx.user!.email}
    >
      {children}
    </DashboardShell>
  );
}
