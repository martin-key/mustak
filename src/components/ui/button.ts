type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-medium transition-colors " +
  "disabled:cursor-not-allowed disabled:opacity-50 select-none";

const variants: Record<Variant, string> = {
  primary: "bg-gold text-bottle-950 hover:bg-gold-bright active:bg-gold-deep",
  secondary: "border border-gold/45 text-cream hover:border-gold hover:bg-bottle-800",
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
