import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  endOfSofiaDay,
  formatDateLong,
  formatDayMonth,
  isLocalDate,
  isoWeekday,
  sofiaToUtc,
  startOfIsoWeek,
  startOfSofiaDay,
  toSofiaDate,
  toSofiaIso,
  toSofiaTime,
} from "@/lib/time";

describe("време в София", () => {
  it("превръща местен час в UTC през зимата (+02:00) и лятото (+03:00)", () => {
    expect(sofiaToUtc("2026-11-12", "10:00").toISOString()).toBe("2026-11-12T08:00:00.000Z");
    expect(sofiaToUtc("2026-07-01", "10:00").toISOString()).toBe("2026-07-01T07:00:00.000Z");
  });

  it("отчита смяната на часа в последната неделя на март и октомври", () => {
    expect(sofiaToUtc("2026-03-28", "10:00").toISOString()).toBe("2026-03-28T08:00:00.000Z");
    expect(sofiaToUtc("2026-03-29", "10:00").toISOString()).toBe("2026-03-29T07:00:00.000Z");
    expect(sofiaToUtc("2026-10-24", "10:00").toISOString()).toBe("2026-10-24T07:00:00.000Z");
    expect(sofiaToUtc("2026-10-25", "10:00").toISOString()).toBe("2026-10-25T08:00:00.000Z");
  });

  it("денят на смяната към лятно време има 23 часа, а към зимно 25", () => {
    const spring = endOfSofiaDay("2026-03-29").getTime() - startOfSofiaDay("2026-03-29").getTime();
    const autumn = endOfSofiaDay("2026-10-25").getTime() - startOfSofiaDay("2026-10-25").getTime();
    expect(spring / 3_600_000).toBe(23);
    expect(autumn / 3_600_000).toBe(25);
  });

  it("форматира момент като местна дата, час и ISO с отместване", () => {
    const instant = new Date("2026-11-11T22:30:00Z");
    expect(toSofiaDate(instant)).toBe("2026-11-12");
    expect(toSofiaTime(instant)).toBe("00:30");
    expect(toSofiaIso(new Date("2026-11-12T08:00:00Z"))).toBe("2026-11-12T10:00:00+02:00");
    expect(toSofiaIso(new Date("2026-07-01T07:15:00Z"))).toBe("2026-07-01T10:15:00+03:00");
  });

  it("смята календарни дни независимо от зоната на машината", () => {
    expect(isoWeekday("2026-11-09")).toBe(1);
    expect(isoWeekday("2026-11-15")).toBe(7);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-11-09", "2026-12-09")).toBe(30);
    expect(startOfIsoWeek("2026-11-15")).toBe("2026-11-09");
  });

  it("проверява дати", () => {
    expect(isLocalDate("2026-11-09")).toBe(true);
    expect(isLocalDate("2026-02-30")).toBe(false);
    expect(isLocalDate("09.11.2026")).toBe(false);
  });

  it("показва датата на български", () => {
    expect(formatDateLong("2026-11-12")).toBe("четвъртък, 12 ноември");
    expect(formatDayMonth("2026-12-01")).toBe("1 дек");
  });
});
