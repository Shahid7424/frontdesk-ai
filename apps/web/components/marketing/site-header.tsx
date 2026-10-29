import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";

const links = [
  { href: "/#how", label: "How it works" },
  { href: "/#features", label: "Features" },
  { href: "/#industries", label: "Industries" },
  { href: "/#trust", label: "Safety" },
  { href: "/#faq", label: "FAQ" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 px-3 pt-3">
      <div className="container-page flex h-14 items-center justify-between gap-6 rounded-2xl border border-black/[0.06] bg-white/70 shadow-soft backdrop-blur-xl sm:px-4 lg:px-4">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-0.5 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink/60 transition-colors hover:bg-black/[0.04] hover:text-ink"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1.5">
          <ButtonLink href="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">
            Log in
          </ButtonLink>
          <ButtonLink href="/demo" size="sm" className="rounded-xl">
            Try live demo <ArrowRight className="size-3.5" />
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
