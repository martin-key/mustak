/**
 * Изчисляване на свободните часове. Чиста функция: без база и без часовник,
 * всичко идва като параметри, за да се тества лесно.
 */
import { addDays, addMinutes, daysBetween, isoWeekday, sofiaToUtc, todayInSofia, type LocalDate } from "@/lib/time";

export interface TimeInterval {
  start: Date;
  end: Date;
}

/** Интервал от седмичния график в местно време. */
export interface WeeklyInterval {
  weekday: number;
  startTime: string;
  endTime: string;
}

export interface BookingRules {
  slotStepMinutes: number;
  minLeadMinutes: number;
  maxDaysAhead: number;
}

export interface BarberDay {
  barberId: string;
  /** Седмичният график на бръснаря (може за всички дни; филтрира се по датата). */
  workingHours: readonly WeeklyInterval[];
  /** Заето време: активни часове и почивки, които засягат деня. */
  busy: readonly TimeInterval[];
}

export interface Slot {
  start: Date;
  end: Date;
  /** Бръснарите, свободни за целия час. */
  barberIds: string[];
}

/** Полуотворени интервали [start, end): допиране не е припокриване. */
export function overlaps(a: TimeInterval, b: TimeInterval): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Може ли да се записва за тази дата: от днес до maxDaysAhead дни напред. */
export function isBookableDate(date: LocalDate, now: Date, rules: BookingRules): boolean {
  const diff = daysBetween(todayInSofia(now), date);
  return diff >= 0 && diff <= rules.maxDaysAhead;
}

/** Последната дата, за която може да се записва. */
export function lastBookableDate(now: Date, rules: BookingRules): LocalDate {
  return addDays(todayInSofia(now), rules.maxDaysAhead);
}

/** Работните интервали на бръснаря за датата, като моменти във времето. */
export function workingIntervalsOn(date: LocalDate, workingHours: readonly WeeklyInterval[]): TimeInterval[] {
  const weekday = isoWeekday(date);
  return workingHours
    .filter((h) => h.weekday === weekday)
    .map((h) => ({ start: sofiaToUtc(date, h.startTime), end: sofiaToUtc(date, h.endTime) }))
    .filter((i) => i.start < i.end)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * Свободните начални часове за един бръснар в даден ден.
 * Часът трябва изцяло да е в един работен интервал, да не се припокрива със заето време
 * и да започва поне minLeadMinutes след `now`.
 */
export function computeBarberSlots(params: {
  date: LocalDate;
  durationMin: number;
  workingHours: readonly WeeklyInterval[];
  busy: readonly TimeInterval[];
  now: Date;
  rules: BookingRules;
}): Date[] {
  const { date, durationMin, workingHours, busy, now, rules } = params;
  if (durationMin <= 0 || rules.slotStepMinutes <= 0) return [];
  if (!isBookableDate(date, now, rules)) return [];

  const earliest = addMinutes(now, rules.minLeadMinutes);
  const result: Date[] = [];

  for (const interval of workingIntervalsOn(date, workingHours)) {
    for (
      let start = interval.start;
      addMinutes(start, durationMin) <= interval.end;
      start = addMinutes(start, rules.slotStepMinutes)
    ) {
      if (start < earliest) continue;
      const candidate = { start, end: addMinutes(start, durationMin) };
      if (busy.some((b) => overlaps(candidate, b))) continue;
      result.push(start);
    }
  }

  // Интервалите може да се застъпват при грешно въведен график: без дубликати.
  const unique = [...new Map(result.map((d) => [d.getTime(), d])).values()];
  return unique.sort((a, b) => a.getTime() - b.getTime());
}

/** Свободните часове за няколко бръснари: обединение, с кой бръснар е свободен за всеки час. */
export function computeSlots(params: {
  date: LocalDate;
  durationMin: number;
  barbers: readonly BarberDay[];
  now: Date;
  rules: BookingRules;
}): Slot[] {
  const byStart = new Map<number, Slot>();
  for (const barber of params.barbers) {
    const starts = computeBarberSlots({
      date: params.date,
      durationMin: params.durationMin,
      workingHours: barber.workingHours,
      busy: barber.busy,
      now: params.now,
      rules: params.rules,
    });
    for (const start of starts) {
      const key = start.getTime();
      const slot = byStart.get(key);
      if (slot) slot.barberIds.push(barber.barberId);
      else byStart.set(key, { start, end: addMinutes(start, params.durationMin), barberIds: [barber.barberId] });
    }
  }
  return [...byStart.values()].sort((a, b) => a.start.getTime() - b.start.getTime());
}
