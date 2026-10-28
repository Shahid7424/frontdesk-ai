import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-black/[0.06]">
      <div className="container-page flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Logo />
          <p className="text-sm text-ink/55">AI receptionist for Indian clinics, salons and coaching centres.</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink/60">
          <Link href="/demo" className="hover:text-ink">Live demo</Link>
          <Link href="/dashboard" className="hover:text-ink">Dashboard</Link>
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          <a href="mailto:hello@frontdesk.example" className="hover:text-ink">Contact</a>
        </nav>
      </div>
    </footer>
  );
}
