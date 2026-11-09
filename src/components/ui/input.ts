export function inputClass(invalid = false, className = ""): string {
  return `block h-12 w-full rounded-[var(--radius-control)] border bg-bottle-950 px-4 text-base text-cream placeholder:text-cream-faint/70 focus:outline-none focus:ring-2 focus:ring-gold/60 ${
    invalid ? "border-oxblood-bright" : "border-line focus:border-gold/70"
  } ${className}`.trim();
}

export function selectClass(className = ""): string {
  return `block h-12 w-full rounded-[var(--radius-control)] border border-line bg-bottle-950 px-3 text-base text-cream focus:border-gold/70 focus:outline-none focus:ring-2 focus:ring-gold/60 ${className}`.trim();
}

export const labelClass = "mb-1.5 block text-sm text-cream";
