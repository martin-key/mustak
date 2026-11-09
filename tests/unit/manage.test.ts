import { describe, expect, it } from "vitest";
import {
  barberInputSchema,
  serviceInputSchema,
  timeOffInputSchema,
  workingHoursInputSchema,
} from "@/server/booking/manage";

describe("админ форми", () => {
  it("превръща цената в евроцентове", () => {
    const base = { name: "Фейд", description: "", durationMin: "45", isActive: "on" };
    expect(serviceInputSchema.parse({ ...base, price: "25" }).price).toBe(2500);
    expect(serviceInputSchema.parse({ ...base, price: "25,5" }).price).toBe(2550);
    expect(serviceInputSchema.parse({ ...base, price: "25.05" }).price).toBe(2505);
    expect(serviceInputSchema.safeParse({ ...base, price: "двайсет" }).success).toBe(false);
    expect(serviceInputSchema.safeParse({ ...base, price: "25", durationMin: "47" }).success).toBe(false);
  });

  it("приема само локални снимки", () => {
    const base = { name: "Иван", bio: "" };
    expect(barberInputSchema.parse({ ...base, photoUrl: "/barbers/ivan.jpg" }).photoUrl).toBe("/barbers/ivan.jpg");
    expect(barberInputSchema.parse({ ...base, photoUrl: "" }).photoUrl).toBeNull();
    expect(barberInputSchema.safeParse({ ...base, photoUrl: "https://example.com/a.jpg" }).success).toBe(false);
    expect(barberInputSchema.safeParse({ ...base, photoUrl: "//evil.example/a.jpg" }).success).toBe(false);
    expect(barberInputSchema.safeParse({ ...base, photoUrl: "/../etc/passwd" }).success).toBe(false);
  });

  it("отказва застъпващи се интервали в работното време", () => {
    expect(
      workingHoursInputSchema.safeParse([
        { weekday: 1, startTime: "10:00", endTime: "14:00" },
        { weekday: 1, startTime: "15:00", endTime: "19:00" },
      ]).success,
    ).toBe(true);
    expect(
      workingHoursInputSchema.safeParse([
        { weekday: 1, startTime: "10:00", endTime: "14:00" },
        { weekday: 1, startTime: "13:00", endTime: "19:00" },
      ]).success,
    ).toBe(false);
    expect(workingHoursInputSchema.safeParse([{ weekday: 2, startTime: "18:00", endTime: "10:00" }]).success).toBe(false);
  });

  it("почивка за цели дни свършва в полунощ след последния ден (София)", () => {
    const off = timeOffInputSchema.parse({ fromDate: "2026-11-19", toDate: "2026-11-20", allDay: "on", reason: "Отпуск" });
    expect(off.startsAt.toISOString()).toBe("2026-11-18T22:00:00.000Z");
    expect(off.endsAt.toISOString()).toBe("2026-11-20T22:00:00.000Z");
  });

  it("почивка за част от деня", () => {
    const off = timeOffInputSchema.parse({ fromDate: "2026-11-19", toDate: "2026-11-19", fromTime: "12:00", toTime: "14:00" });
    expect(off.startsAt.toISOString()).toBe("2026-11-19T10:00:00.000Z");
    expect(off.endsAt.toISOString()).toBe("2026-11-19T12:00:00.000Z");
    expect(
      timeOffInputSchema.safeParse({ fromDate: "2026-11-19", toDate: "2026-11-18", allDay: "on" }).success,
    ).toBe(false);
  });
});
