import Link from "next/link";
import { cn } from "@/lib/utils";

/** A speech bubble with a spark: a welcome that talks back. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative grid size-8 place-items-center overflow-hidden rounded-[10px] bg-gradient-to-br from-brand-500 via-brand-700 to-brand-950 text-white shadow-md shadow-brand-900/30 ring-1 ring-white/15 ring-inset",
        className,
      )}
      aria-hidden
    >
      <span className="absolute -top-1/2 -right-1/3 size-full rounded-full bg-saffron-400/40 blur-md" />
      <svg viewBox="0 0 24 24" className="relative size-[62%]" fill="none">
        <path
          d="M4.5 5.5h15a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H12l-4.6 3.4a.5.5 0 0 1-.8-.4v-3H4.5A1.5 1.5 0 0 1 3 16V7a1.5 1.5 0 0 1 1.5-1.5Z"
          fill="currentColor"
          fillOpacity="0.95"
        />
        <path d="M12 7.6l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1z" fill="#5a2bd4" />
      </svg>
    </span>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("text-[17px] font-extrabold tracking-[-0.02em]", className)}>
      Swagat<span className="text-gradient"> AI</span>
    </span>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5", className)} aria-label="Swagat AI home">
      <LogoMark />
      <Wordmark />
    </Link>
  );
}
