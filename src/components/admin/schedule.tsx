import Link from "next/link";
import { formatPhone, formatPrice } from "@/lib/format";
import { SOURCE_LABELS, STATUS_LABELS, STATUS_STYLES } from "@/lib/labels";
import { isoWeekday, shortTime, toSofiaDate, toSofiaTime, type LocalDate } from "@/lib/time";
import type { ScheduleAppointment, ScheduleBarber } from "@/server/booking/schedule";
import { StatusSelect } from "./status-select";

/** Работното време на бръснаря за деня като текст, напр. "10:00–14:00, 15:00–19:00". */
export function hoursText(barber: ScheduleBarber, date: LocalDate): string | null {
  const weekday = isoWeekday(date);
  const parts = barber.hours
    .filter((h) => h.weekday === weekday)
    .map((h) => `${shortTime(h.startTime)}–${shortTime(h.endTime)}`);
  return parts.length > 0 ? parts.join(", ") : null;
}

/** Почивка, която засяга деня. */
export function timeOffOn(barber: ScheduleBarber, date: LocalDate) {
  return barber.timeOff.find((o) => toSofiaDate(o.startsAt) <= date && toSofiaDate(new Date(o.endsAt.getTime() - 1)) >= date);
}

export function AppointmentCard({ appointment }: { appointment: ScheduleAppointment }) {
  const style = STATUS_STYLES[appointment.status];
  return (
    <article className={`rounded-lg border bg-bottle-900 p-3.5 ${style.card}`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-lg tabular-nums text-cream">
          {toSofiaTime(appointment.startsAt)}
          <span className="text-cream-faint">–{toSofiaTime(appointment.endsAt)}</span>
        </p>
        <span className="text-xs text-cream-faint">{SOURCE_LABELS[appointment.source]}</span>
      </div>
      <p className={`mt-1 font-medium text-cream ${appointment.status === "cancelled" ? "line-through" : ""}`}>
        {appointment.customerName}
      </p>
      <a href={`tel:${appointment.customerPhone}`} className="text-sm text-gold hover:text-gold-bright">
        {formatPhone(appointment.customerPhone)}
      </a>
      <p className="mt-1 text-sm text-cream-muted">
        {appointment.serviceName}, {formatPrice(appointment.priceCents)}
      </p>
      {appointment.note && <p className="mt-2 rounded bg-bottle-800 px-2 py-1.5 text-sm text-cream">{appointment.note}</p>}
      <div className="mt-3">
        <StatusSelect id={appointment.id} status={appointment.status} />
      </div>
    </article>
  );
}

/** Кратък ред за седмичния изглед. */
export function AppointmentLine({ appointment }: { appointment: ScheduleAppointment }) {
  const style = STATUS_STYLES[appointment.status];
  return (
    <li className="flex items-start gap-2 text-sm" title={STATUS_LABELS[appointment.status]}>
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style.dot}`} aria-hidden />
      <span className={appointment.status === "cancelled" ? "text-cream-faint line-through" : "text-cream"}>
        <span className="tabular-nums">{toSofiaTime(appointment.startsAt)}</span> {appointment.customerName}
        <span className="block text-xs text-cream-faint">
          {appointment.serviceName}, {STATUS_LABELS[appointment.status].toLowerCase()}
        </span>
      </span>
    </li>
  );
}

export function DayNav({ basePath, date, prev, next, today, todayLabel }: {
  basePath: string;
  date: LocalDate;
  prev: LocalDate;
  next: LocalDate;
  today: LocalDate;
  todayLabel: string;
}) {
  const link = "inline-flex h-9 items-center rounded-md border border-line px-3 text-sm text-cream-muted hover:border-gold/60 hover:text-cream";
  const param = basePath.endsWith("week") ? "start" : "date";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={`${basePath}?${param}=${prev}`} className={link} aria-label="Назад">
        ‹
      </Link>
      <Link href={basePath} className={link} aria-current={date === today ? "date" : undefined}>
        {todayLabel}
      </Link>
      <Link href={`${basePath}?${param}=${next}`} className={link} aria-label="Напред">
        ›
      </Link>
      <form action={basePath} className="flex items-center gap-2">
        <label className="sr-only" htmlFor="date-picker">
          Дата
        </label>
        <input
          id="date-picker"
          type="date"
          name={param}
          defaultValue={date}
          className="h-9 rounded-md border border-line bg-bottle-950 px-2 text-sm text-cream [color-scheme:dark]"
        />
        <button type="submit" className={link}>
          Покажи
        </button>
      </form>
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-line bg-bottle-900 px-4 py-3">
      <p className="text-sm text-cream-muted">{label}</p>
      <p className="mt-1 font-display text-2xl tabular-nums text-cream">{value}</p>
    </div>
  );
}

export function ScheduleSkeleton() {
  return (
    <div aria-busy="true" aria-label="Зареждане на графика">
      <div className="h-9 w-64 animate-pulse rounded bg-bottle-800" />
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-72 animate-pulse rounded-xl bg-bottle-900" />
        ))}
      </div>
    </div>
  );
}
