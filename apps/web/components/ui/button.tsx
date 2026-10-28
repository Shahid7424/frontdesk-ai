import Link from "next/link";
import { cn } from "@/lib/utils";

const variants = {
  primary:
    "bg-brand-700 text-white shadow-sm shadow-brand-900/20 hover:bg-brand-800 active:bg-brand-900",
  dark: "bg-ink text-white hover:bg-ink/90",
  secondary: "bg-white text-ink ring-1 ring-black/10 hover:bg-black/[0.03] hover:ring-black/15",
  ghost: "text-ink/70 hover:bg-black/5 hover:text-ink",
  danger: "bg-red-600 text-white hover:bg-red-700",
} as const;

const sizes = {
  sm: "h-8 gap-1.5 rounded-lg px-3 text-[13px]",
  md: "h-10 gap-2 rounded-xl px-4 text-sm",
  lg: "h-12 gap-2 rounded-xl px-6 text-[15px]",
  icon: "size-9 rounded-lg",
} as const;

export type ButtonStyle = { variant?: keyof typeof variants; size?: keyof typeof sizes };

export function buttonClass({ variant = "primary", size = "md" }: ButtonStyle = {}, className?: string) {
  return cn(
    "inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({
  variant,
  size,
  className,
  ...props
}: React.ComponentProps<"button"> & ButtonStyle) {
  return <button className={buttonClass({ variant, size }, className)} {...props} />;
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: React.ComponentProps<typeof Link> & ButtonStyle) {
  return <Link className={buttonClass({ variant, size }, className)} {...props} />;
}
