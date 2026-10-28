import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";

const links = [
  { href: "/#how", label: "How it works" },
  { href: "/#features", label: "Features" },
  { href: "/#trust", label: "Safety" },
  { href: "/#faq", label: "FAQ" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-canvas/80 backdrop-blur-xl">
      <div className="container-page flex h-16 items-center justify-between gap-6">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink/65 transition-colors hover:text-ink"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ButtonLink href="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">
            Log in
          </ButtonLink>
          <ButtonLink href="/demo" size="sm">
            Try live demo
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
