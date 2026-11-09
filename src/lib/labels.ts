import type { AppointmentSource, AppointmentStatus } from "@/server/db/schema";

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  booked: "Записан",
  confirmed: "Потвърден",
  arrived: "Дошъл",
  no_show: "Неявил се",
  cancelled: "Отказан",
};

export const STATUS_ORDER: AppointmentStatus[] = ["booked", "confirmed", "arrived", "no_show", "cancelled"];

/** Цветове на статусите в админ панела. */
export const STATUS_STYLES: Record<AppointmentStatus, { dot: string; card: string }> = {
  booked: { dot: "bg-cream-muted", card: "border-line" },
  confirmed: { dot: "bg-gold", card: "border-gold/50" },
  arrived: { dot: "bg-sage", card: "border-sage/50" },
  no_show: { dot: "bg-oxblood-bright", card: "border-oxblood/70 opacity-75" },
  cancelled: { dot: "bg-cream-faint", card: "border-line opacity-55" },
};

export const SOURCE_LABELS: Record<AppointmentSource, string> = {
  web: "онлайн",
  admin: "от салона",
  api: "AI агент",
};
