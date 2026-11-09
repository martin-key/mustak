import { TZDate } from "@date-fns/tz";

/**
 * Помощни функции за време. Всичко в бизнес логиката е в часовата зона на бръснарницата
 * (Europe/Sofia), независимо от зоната на сървъра или браузъра.
 *
 * - Моменти във времето са `Date` (UTC вътрешно).
 * - Календарни дати са низове "YYYY-MM-DD" (LocalDate) в местно време.
 * - Часове от денонощието са низове "HH:MM" или "HH:MM:SS" в местно време.
 */

export const TIME_ZONE = "Europe/Sofia";
const LOCALE = "bg-BG";

/** Календарна дата в местно време, "YYYY-MM-DD". */
export type LocalDate = string;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

function parseLocalDate(date: LocalDate): [number, number, number] {
  const match = DATE_RE.exec(date);
  if (!match) throw new RangeError(`Невалидна дата: ${date}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function parseTime(time: string): [number, number] {
  const match = TIME_RE.exec(time);
  if (!match) throw new RangeError(`Невалиден час: ${time}`);
  return [Number(match[1]), Number(match[2])];
}

export function isLocalDate(value: string): boolean {
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

export function isTimeOfDay(value: string): boolean {
  return TIME_RE.test(value);
}

/** Местна дата и час в София → момент във времето. Отчита лятното/зимното часово време. */
export function sofiaToUtc(date: LocalDate, time: string): Date {
  const [y, m, d] = parseLocalDate(date);
  const [hh, mm] = parseTime(time);
  return new Date(new TZDate(y, m - 1, d, hh, mm, 0, 0, TIME_ZONE).getTime());
}

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function sofiaParts(instant: Date) {
  const parts: Record<string, string> = {};
  for (const part of partsFormatter.formatToParts(instant)) parts[part.type] = part.value;
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

/** Календарната дата в София за даден момент. */
export function toSofiaDate(instant: Date): LocalDate {
  const p = sofiaParts(instant);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Часът в София за даден момент, "HH:MM". */
export function toSofiaTime(instant: Date): string {
  const p = sofiaParts(instant);
  return `${p.hour}:${p.minute}`;
}

/** Отместване на София спрямо UTC в минути (120 зимно, 180 лятно). */
export function sofiaOffsetMinutes(instant: Date): number {
  const p = sofiaParts(instant);
  const wallClockAsUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  );
  const wholeSeconds = Math.floor(instant.getTime() / 1000) * 1000;
  return Math.round((wallClockAsUtc - wholeSeconds) / 60_000);
}

/** ISO 8601 с отместването на София, напр. "2026-11-12T10:00:00+02:00". */
export function toSofiaIso(instant: Date): string {
  const p = sofiaParts(instant);
  const offset = sofiaOffsetMinutes(instant);
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  const oh = String(Math.floor(abs / 60)).padStart(2, "0");
  const om = String(abs % 60).padStart(2, "0");
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${sign}${oh}:${om}`;
}

/** Днешната дата в София. */
export function todayInSofia(now: Date = new Date()): LocalDate {
  return toSofiaDate(now);
}

/** ISO ден от седмицата за календарна дата: 1 = понеделник … 7 = неделя. */
export function isoWeekday(date: LocalDate): number {
  const [y, m, d] = parseLocalDate(date);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 ? 7 : day;
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const [y, m, d] = parseLocalDate(date);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
}

/** Брой дни от `from` до `to` (може да е отрицателен). */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  const [y1, m1, d1] = parseLocalDate(from);
  const [y2, m2, d2] = parseLocalDate(to);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** Понеделникът от седмицата на датата. */
export function startOfIsoWeek(date: LocalDate): LocalDate {
  return addDays(date, 1 - isoWeekday(date));
}

/** Началото на деня в София като момент. */
export function startOfSofiaDay(date: LocalDate): Date {
  return sofiaToUtc(date, "00:00");
}

/** Началото на следващия ден в София (краят на деня, невключен). */
export function endOfSofiaDay(date: LocalDate): Date {
  return startOfSofiaDay(addDays(date, 1));
}

export function addMinutes(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * 60_000);
}

/** "HH:MM:SS" → "HH:MM" */
export function shortTime(time: string): string {
  return time.slice(0, 5);
}

// ---------------------------------------------------------------------------
// Показване на български
// ---------------------------------------------------------------------------

/** Обед UTC на календарната дата: безопасен момент за форматиране само на датата. */
function noonUtc(date: LocalDate): Date {
  const [y, m, d] = parseLocalDate(date);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

const longDateFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
});
const longDateYearFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
// Intl за bg-BG дава "12" като кратко име на месеца, затова съкращенията са ръчни.
const MONTHS_SHORT = ["яну", "фев", "мар", "апр", "май", "юни", "юли", "авг", "сеп", "окт", "ное", "дек"];
const weekdayShortFormatter = new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", weekday: "short" });

/** "четвъртък, 12 ноември" */
export function formatDateLong(date: LocalDate, options: { withYear?: boolean } = {}): string {
  return (options.withYear ? longDateYearFormatter : longDateFormatter).format(noonUtc(date));
}

/** "12 ное" */
export function formatDayMonth(date: LocalDate): string {
  const [, m, d] = parseLocalDate(date);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}

/** "чт" */
export function formatWeekdayShort(date: LocalDate): string {
  return weekdayShortFormatter.format(noonUtc(date));
}

export const WEEKDAY_NAMES: Record<number, string> = {
  1: "Понеделник",
  2: "Вторник",
  3: "Сряда",
  4: "Четвъртък",
  5: "Петък",
  6: "Събота",
  7: "Неделя",
};
