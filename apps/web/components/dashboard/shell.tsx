"use client";

import { ChevronsUpDown, ExternalLink, LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/ui/logo";
import { cn, initials } from "@/lib/utils";
import { navItems } from "./nav";

interface ShellProps {
  mode: "demo" | "live";
  business: { name: string; area: string };
  userLabel: string;
  /** Conversations waiting for a human, for the Inbox badge. */
  needsYou: number;
}

export function DashboardShell({ children, ...props }: ShellProps & { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setMobileOpen(false), [pathname]);

  return (
    <div className="min-h-dvh bg-canvas bg-[radial-gradient(60%_40%_at_70%_0%,var(--color-brand-100),transparent)] bg-no-repeat lg:grid lg:grid-cols-[256px_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-black/[0.06] bg-white/75 backdrop-blur-xl lg:flex">
        <Sidebar {...props} />
      </aside>

      {/* Mobile top bar + drawer */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-black/[0.06] bg-white/90 px-4 backdrop-blur lg:hidden">
        <Logo href="/dashboard" />
        <button
          aria-label="Open menu"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(true)}
          className="grid size-9 place-items-center rounded-lg hover:bg-black/5"
        >
          <Menu className="size-5" />
        </button>
      </div>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-ink/30 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 animate-fade-up flex-col bg-white shadow-lift">
            <button
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-3 grid size-9 place-items-center rounded-lg hover:bg-black/5"
            >
              <X className="size-5" />
            </button>
            <Sidebar {...props} />
          </aside>
        </div>
      )}

      <main className="min-w-0">{children}</main>
    </div>
  );
}

function Sidebar({ mode, business, userLabel, needsYou }: ShellProps) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/dashboard" ? pathname === href : pathname.startsWith(href));

  return (
    <>
      <div className="px-5 pt-5 pb-4">
        <Logo href="/dashboard" />
      </div>

      <div className="px-3">
        <button className="flex w-full items-center gap-3 rounded-xl p-2 text-left ring-1 ring-black/[0.07] transition hover:bg-black/[0.03]">
          <span className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-800 text-sm font-bold text-white shadow-sm shadow-brand-900/20">
            {initials(business.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{business.name}</span>
            <span className="block truncate text-xs text-slate-500">{business.area || "Your business"}</span>
          </span>
          <ChevronsUpDown className="size-4 text-slate-400" />
        </button>
      </div>

      <nav aria-label="Dashboard" className="mt-5 flex-1 space-y-0.5 px-3">
        {navItems.map(({ href, label, icon: Icon, needsYouBadge }) => {
          const badge = needsYouBadge ? needsYou : 0;
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-gradient-to-r from-brand-600 to-brand-800 text-white shadow-md shadow-brand-900/25" : "text-ink/65 hover:bg-black/[0.04] hover:text-ink",
              )}
            >
              <Icon className={cn("size-[18px]", active ? "text-white" : "text-ink/45 group-hover:text-ink/70")} />
              <span className="flex-1">{label}</span>
              {badge ? (
                <span
                  className={cn(
                    "grid min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold",
                    active ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800",
                  )}
                >
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="relative m-3 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-50 via-white to-saffron-100/60 p-4 ring-1 ring-brand-100">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
          </span>
          <p className="text-sm font-semibold">AI receptionist is live</p>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">Answering customers on your website, 24×7.</p>
        <Link href="/demo" target="_blank" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
          Test it as a customer <ExternalLink className="size-3" />
        </Link>
      </div>

      <div className="flex items-center gap-3 border-t border-black/[0.06] px-5 py-4">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-white">
          {initials(userLabel.replace(/@.*/, "").replace(/[._-]/g, " "))}
        </span>
        <div className="min-w-0 flex-1 text-sm leading-tight">
          <p className="truncate font-semibold">{userLabel}</p>
          <p className="truncate text-xs text-slate-500">{mode === "demo" ? "Demo mode" : "Owner"}</p>
        </div>
        {mode === "live" && (
          <form action="/auth/signout" method="post">
            <button aria-label="Log out" title="Log out" className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-black/5 hover:text-ink">
              <LogOut className="size-4" />
            </button>
          </form>
        )}
      </div>
    </>
  );
}
