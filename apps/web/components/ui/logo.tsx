import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid size-8 place-items-center rounded-[10px] bg-gradient-to-br from-brand-500 to-brand-800 text-white shadow-sm shadow-brand-900/30",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19v-6a8 8 0 0 1 16 0v6" />
        <path d="M2 19h20" />
        <path d="M12 5V3" />
        <path d="M9 13h.01M15 13h.01" />
      </svg>
    </span>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5 font-bold tracking-tight", className)}>
      <LogoMark />
      <span className="text-[17px]">
        FrontDesk<span className="text-brand-600"> AI</span>
      </span>
    </Link>
  );
}
