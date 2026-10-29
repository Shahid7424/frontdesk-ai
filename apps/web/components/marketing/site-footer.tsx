import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { BRAND } from "@/lib/brand";

export function SiteFooter() {
  return (
    <footer className="border-t border-black/[0.06] bg-white">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm leading-relaxed text-ink/55">
            {BRAND.tagline}. Answers, bookings and UPI payments on your website, 24×7.
          </p>
        </div>
        <nav aria-label="Product" className="flex flex-col gap-2.5 text-sm text-ink/60">
          <p className="text-xs font-semibold tracking-wider text-ink/40 uppercase">Product</p>
          <Link href="/demo" className="hover:text-ink">Live demo</Link>
          <Link href="/dashboard" className="hover:text-ink">Owner dashboard</Link>
          <Link href="/login" className="hover:text-ink">Log in</Link>
        </nav>
        <nav aria-label="Company" className="flex flex-col gap-2.5 text-sm text-ink/60">
          <p className="text-xs font-semibold tracking-wider text-ink/40 uppercase">Company</p>
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          <a href={`mailto:${BRAND.contactEmail}`} className="hover:text-ink">Contact</a>
        </nav>
      </div>
      <div className="border-t border-black/[0.05]">
        <p className="container-page py-5 text-xs text-ink/40">
          © {new Date().getFullYear()} {BRAND.name}. Made in India 🇮🇳
        </p>
      </div>
    </footer>
  );
}
