type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-medium transition duration-200 " +
  "disabled:cursor-not-allowed disabled:opacity-50 select-none";

const variants: Record<Variant, string> = {
  primary:
    "bg-gradient-to-b from-gold-bright via-gold to-gold-deep text-bottle-950 shadow-[0_12px_28px_-12px_rgb(210_168_89/0.75),inset_0_1px_0_rgb(255_255_255/0.4)] hover:brightness-110 active:brightness-95",
  secondary:
    "border border-gold/45 bg-bottle-900/40 text-cream backdrop-blur hover:border-gold hover:bg-bottle-800/70",
  ghost: "text-cream-muted hover:text-cream hover:bg-bottle-800",
  danger: "bg-oxblood text-cream hover:bg-[#a5372f]",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-base",
  lg: "h-13 px-7 text-lg",
};

export function buttonClass({
  variant = "primary",
  size = "md",
  className = "",
}: { variant?: Variant; size?: Size; className?: string } = {}): string {
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`.trim();
}
