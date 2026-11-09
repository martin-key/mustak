import { describe, expect, it } from "vitest";
import { sofiaToUtc, toSofiaIso, toSofiaTime } from "@/lib/time";
import {
  computeBarberSlots,
  computeSlots,
  overlaps,
  type BookingRules,
  type TimeInterval,
  type WeeklyInterval,
} from "@/server/booking/availability";

const rules: BookingRules = { slotStepMinutes: 15, minLeadMinutes: 60, maxDaysAhead: 30 };

// Понеделник, 9 ноември 2026, 10:00 в София.
const NOW = new Date("2026-11-09T08:00:00Z");
// Сряда.
const DATE = "2026-11-11";
const WED = 3;

const hours = (...intervals: [string, string][]): WeeklyInterval[] =>
  intervals.map(([startTime, endTime]) => ({ weekday: WED, startTime, endTime }));

const busy = (date: string, from: string, to: string): TimeInterval => ({
  start: sofiaToUtc(date, from),
  end: sofiaToUtc(date, to),
});

function slots(params: Partial<Parameters<typeof computeBarberSlots>[0]> = {}) {
  return computeBarberSlots({
    date: DATE,
    durationMin: 30,
    workingHours: hours(["10:00", "12:00"]),
    busy: [],
    now: NOW,
    rules,
    ...params,
  }).map(toSofiaTime);
}

describe("свободни часове за един бръснар", () => {
  it("дава часовете през 15 минути, така че услугата да свърши до края на работното време", () => {
    expect(slots()).toEqual(["10:00", "10:15", "10:30", "10:45", "11:00", "11:15", "11:30"]);
  });

  it("маха часовете, които се припокриват със записан час, но позволява съседни", () => {
    expect(slots({ busy: [busy(DATE, "10:30", "11:00")] })).toEqual(["10:00", "11:00", "11:15", "11:30"]);
  });

  it("не позволява час да мине през обедната почивка", () => {
    const result = slots({ durationMin: 45, workingHours: hours(["10:00", "12:00"], ["13:00", "14:00"]) });
    expect(result).toEqual(["10:00", "10:15", "10:30", "10:45", "11:00", "11:15", "13:00", "13:15"]);
  });

  it("не дава часове, ако услугата е по-дълга от работния интервал", () => {
    expect(slots({ durationMin: 60, workingHours: hours(["13:00", "13:45"]) })).toEqual([]);
  });

  it("не дава часове в почивен ден (няма график за деня от седмицата)", () => {
    expect(slots({ workingHours: [{ weekday: 1, startTime: "10:00", endTime: "18:00" }] })).toEqual([]);
  });

  it("не дава часове по време на отпуск", () => {
    expect(slots({ busy: [busy(DATE, "00:00", "23:59")] })).toEqual([]);
    expect(slots({ busy: [busy(DATE, "11:00", "12:00")] })).toEqual(["10:00", "10:15", "10:30"]);
  });

  it("спазва минималното време напред за днешния ден", () => {
    // Сряда 10:20 в София: най-рано 11:20, първият кръгъл час е 11:30.
    const now = new Date("2026-11-11T08:20:00Z");
    expect(slots({ now })).toEqual(["11:30"]);
  });

  it("не дава часове за минали дати и за дати след позволения период", () => {
    expect(slots({ date: "2026-11-04", workingHours: hours(["10:00", "12:00"]) })).toEqual([]);
    // 9 ноември + 30 дни = 9 декември (сряда) е последният позволен ден.
    expect(slots({ date: "2026-12-09" })).toHaveLength(7);
    expect(slots({ date: "2026-12-16" })).toEqual([]);
  });

  it("смята правилно в деня на смяната към лятно време", () => {
    const result = computeBarberSlots({
      date: "2026-03-29",
      durationMin: 30,
      workingHours: [{ weekday: 7, startTime: "10:00", endTime: "11:00" }],
      busy: [],
      now: new Date("2026-03-20T08:00:00Z"),
      rules: { ...rules, slotStepMinutes: 30 },
    });
    expect(result.map((d) => d.toISOString())).toEqual(["2026-03-29T07:00:00.000Z", "2026-03-29T07:30:00.000Z"]);
    expect(result.map(toSofiaIso)).toEqual(["2026-03-29T10:00:00+03:00", "2026-03-29T10:30:00+03:00"]);
  });
});

describe("свободни часове за няколко бръснари", () => {
  it("обединява часовете и казва кой бръснар е свободен", () => {
    const result = computeSlots({
      date: DATE,
      durationMin: 30,
      now: NOW,
      rules: { ...rules, slotStepMinutes: 30 },
      barbers: [
        { barberId: "a", workingHours: hours(["10:00", "11:00"]), busy: [] },
        { barberId: "b", workingHours: hours(["10:30", "11:30"]), busy: [] },
      ],
    });
    expect(result.map((s) => [toSofiaTime(s.start), toSofiaTime(s.end), s.barberIds])).toEqual([
      ["10:00", "10:30", ["a"]],
      ["10:30", "11:00", ["a", "b"]],
      ["11:00", "11:30", ["b"]],
    ]);
  });
});

describe("припокриване", () => {
  it("допирането не е припокриване", () => {
    const a = busy(DATE, "10:00", "10:30");
    expect(overlaps(a, busy(DATE, "10:30", "11:00"))).toBe(false);
    expect(overlaps(a, busy(DATE, "10:29", "11:00"))).toBe(true);
    expect(overlaps(a, busy(DATE, "09:00", "12:00"))).toBe(true);
  });
});
