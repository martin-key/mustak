import { business } from "@/config/business";

const priceFormatter = new Intl.NumberFormat(business.locale, {
  style: "currency",
  currency: business.currency,
  minimumFractionDigits: 2,
});

/** 2500 → "25,00 €" */
export function formatPrice(cents: number): string {
  return priceFormatter.format(cents / 100);
}

/** 2500 → "25.00" (за API-то) */
export function centsToDecimal(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** 45 → "45 мин", 75 → "1 ч 15 мин" */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} мин`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} ч` : `${h} ч ${m} мин`;
}

/** "+359888123456" → "+359 888 123 456" */
export function formatPhone(e164: string): string {
  const bg = /^\+359(\d{3})(\d{3})(\d{3})$/.exec(e164);
  return bg ? `+359 ${bg[1]} ${bg[2]} ${bg[3]}` : e164;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
