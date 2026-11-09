import { and, eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sofiaToUtc, toSofiaTime } from "@/lib/time";
import { BookingError } from "@/server/booking/errors";
import {
  cancelBookingByToken,
  createBooking,
  getAvailability,
  getBookingByToken,
  setAppointmentStatus,
  type CreateBookingInput,
} from "@/server/booking/service";
import { pgErrorCode } from "@/server/db/errors";
import { appointments, timeOff } from "@/server/db/schema";
import { closeTestDb, createFixture, futureDate, resetDb, testDb, uniquePhone } from "./helpers";

const db = testDb();

beforeEach(() => resetDb(db));
afterAll(() => closeTestDb());

function bookingInput(serviceId: string, start: Date, extra: Partial<CreateBookingInput> = {}): CreateBookingInput {
  return {
    serviceId,
    start,
    customer: { name: "Тестов Клиент", phone: uniquePhone() },
    source: "web",
    ...extra,
  };
}

async function activeCount(barberId: string) {
  const rows = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(and(eq(appointments.barberId, barberId), inArray(appointments.status, ["booked", "confirmed", "arrived"])));
  return rows.length;
}

describe("защита от двойно записване на ниво база", () => {
  async function rawInsert(barberId: string, serviceId: string, from: string, to: string, status = "booked") {
    const date = futureDate();
    await db.execute(sql`
      INSERT INTO appointments (barber_id, service_id, starts_at, ends_at, status, customer_name, customer_phone,
                                service_name, price_cents, duration_min, source, cancel_token_hash)
      VALUES (${barberId}, ${serviceId}, ${sofiaToUtc(date, from)}, ${sofiaToUtc(date, to)}, ${status},
              'Клиент', '+359888000000', 'Подстригване', 2500, 30, 'admin', ${crypto.randomUUID()})
    `);
  }

  it("отказва припокриващ се час за същия бръснар дори при директен SQL INSERT", async () => {
    const { service, barbers } = await createFixture(db);
    await rawInsert(barbers[0].id, service.id, "10:00", "10:30");

    const error = await rawInsert(barbers[0].id, service.id, "10:15", "10:45").catch((e: unknown) => e);
    expect(pgErrorCode(error)).toBe("23P01");
  });

  it("позволява съседни часове, часове при различни бръснари и върху отказан час", async () => {
    const { service, barbers } = await createFixture(db, 2);
    await rawInsert(barbers[0].id, service.id, "10:00", "10:30");
    await rawInsert(barbers[0].id, service.id, "10:30", "11:00");
    await rawInsert(barbers[1].id, service.id, "10:00", "10:30");
    await rawInsert(barbers[0].id, service.id, "11:00", "11:30", "cancelled");
    await rawInsert(barbers[0].id, service.id, "11:00", "11:30", "no_show");
    await rawInsert(barbers[0].id, service.id, "11:00", "11:30");
    expect(await activeCount(barbers[0].id)).toBe(3);
  });
});

describe("едновременно записване", () => {
  it("от 20 едновременни заявки за един и същи час успява точно една", async () => {
    const { service, barbers } = await createFixture(db);
    const start = sofiaToUtc(futureDate(), "10:00");

    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => createBooking(db, bookingInput(service.id, start, { barberId: barbers[0].id }))),
    );

    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(19);
    for (const f of failed) {
      expect(f.reason).toBeInstanceOf(BookingError);
      expect((f.reason as BookingError).code).toBe("SLOT_UNAVAILABLE");
    }
    expect(await activeCount(barbers[0].id)).toBe(1);
  });

  it("базата спира припокриването и когато проверката в кода е пропусната", async () => {
    const { service, barbers } = await createFixture(db);
    const date = futureDate();

    // Различни начални часове, които се застъпват: 10:00, 10:05, ... 10:25 (по 30 минути).
    const results = await Promise.allSettled(
      [0, 5, 10, 15, 20, 25].map((min) =>
        createBooking(
          db,
          bookingInput(service.id, sofiaToUtc(date, `10:${String(min).padStart(2, "0")}`), {
            barberId: barbers[0].id,
            source: "admin",
            skipAvailabilityCheck: true,
          }),
        ),
      ),
    );

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await activeCount(barbers[0].id)).toBe(1);
  });

  it("при „който е свободен“ разпределя едновременните заявки по различни бръснари", async () => {
    const { service, barbers } = await createFixture(db, 3);
    const start = sofiaToUtc(futureDate(), "12:00");

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => createBooking(db, bookingInput(service.id, start))),
    );

    const booked = results
      .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof createBooking>>> => r.status === "fulfilled")
      .map((r) => r.value.appointment.barberId);
    expect(booked).toHaveLength(3);
    expect(new Set(booked)).toEqual(new Set(barbers.map((b) => b.id)));
    // Останалите две се отказват, защото всички бръснари са заети, а не с грешка от базата (напр. deadlock 40P01).
    const failedCodes = results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r) => (r.reason instanceof BookingError ? r.reason.code : `pg:${pgErrorCode(r.reason)}`));
    expect(failedCodes).toEqual(["SLOT_UNAVAILABLE", "SLOT_UNAVAILABLE"]);
  });
});

describe("свободни часове от базата", () => {
  it("записаният час изчезва от свободните", async () => {
    const { service, barbers } = await createFixture(db);
    const date = futureDate();
    const start = sofiaToUtc(date, "10:00");

    const before = await getAvailability(db, { serviceId: service.id, date, barberId: barbers[0].id });
    expect(before.slots.map((s) => toSofiaTime(s.start))).toContain("10:00");

    await createBooking(db, bookingInput(service.id, start, { barberId: barbers[0].id }));

    const after = await getAvailability(db, { serviceId: service.id, date, barberId: barbers[0].id });
    const times = after.slots.map((s) => toSofiaTime(s.start));
    expect(times).not.toContain("09:45");
    expect(times).not.toContain("10:00");
    expect(times).not.toContain("10:15");
    expect(times).toContain("09:30");
    expect(times).toContain("10:30");
  });

  it("почивката на бръснаря маха часовете", async () => {
    const { service, barbers } = await createFixture(db);
    const date = futureDate();
    await db.insert(timeOff).values({
      barberId: barbers[0].id,
      startsAt: sofiaToUtc(date, "00:00"),
      endsAt: sofiaToUtc(futureDate(8), "00:00"),
      reason: "Отпуск",
    });
    const result = await getAvailability(db, { serviceId: service.id, date });
    expect(result.slots).toEqual([]);
  });

  it("отказва час, който не е в работното време", async () => {
    const { service, barbers } = await createFixture(db);
    const error = await createBooking(
      db,
      bookingInput(service.id, sofiaToUtc(futureDate(), "20:00"), { barberId: barbers[0].id }),
    ).catch((e: unknown) => e);
    expect((error as BookingError).code).toBe("SLOT_UNAVAILABLE");
  });
});

describe("отказ през линка", () => {
  it("освобождава часа и той може да се запише отново", async () => {
    const { service, barbers } = await createFixture(db);
    const date = futureDate();
    const start = sofiaToUtc(date, "11:00");
    const input = bookingInput(service.id, start, { barberId: barbers[0].id });

    const first = await createBooking(db, input);
    expect(first.cancelToken).toBeTruthy();
    await expect(createBooking(db, { ...input, customer: { name: "Друг", phone: uniquePhone() } })).rejects.toMatchObject({
      code: "SLOT_UNAVAILABLE",
    });

    const cancelled = await cancelBookingByToken(db, first.cancelToken!);
    expect(cancelled.status).toBe("cancelled");
    expect((await getBookingByToken(db, first.cancelToken!))?.cancelledBy).toBe("customer");

    const free = await getAvailability(db, { serviceId: service.id, date, barberId: barbers[0].id });
    expect(free.slots.map((s) => toSofiaTime(s.start))).toContain("11:00");

    const second = await createBooking(db, { ...input, customer: { name: "Друг", phone: uniquePhone() } });
    expect(second.appointment.startsAt.getTime()).toBe(start.getTime());
  });

  it("не позволява повторен отказ, непознат токен или отказ твърде късно", async () => {
    const { service, barbers } = await createFixture(db);
    const start = sofiaToUtc(futureDate(), "15:00");
    const { cancelToken } = await createBooking(db, bookingInput(service.id, start, { barberId: barbers[0].id }));

    await expect(cancelBookingByToken(db, "непознат")).rejects.toMatchObject({ code: "NOT_FOUND" });
    // Един час преди началото: правилото е поне 2 часа.
    const lateNow = new Date(start.getTime() - 60 * 60_000);
    await expect(cancelBookingByToken(db, cancelToken!, { now: lateNow })).rejects.toMatchObject({
      code: "TOO_LATE_TO_CANCEL",
    });

    await cancelBookingByToken(db, cancelToken!);
    await expect(cancelBookingByToken(db, cancelToken!)).rejects.toMatchObject({ code: "ALREADY_CANCELLED" });
  });
});

describe("други правила", () => {
  it("ограничава броя бъдещи часове на един телефон", async () => {
    const { service, barbers } = await createFixture(db);
    const phone = uniquePhone();
    const date = futureDate();
    for (const time of ["09:00", "10:00", "11:00"]) {
      await createBooking(db, { ...bookingInput(service.id, sofiaToUtc(date, time)), customer: { name: "Клиент", phone } });
    }
    await expect(
      createBooking(db, { ...bookingInput(service.id, sofiaToUtc(date, "12:00")), customer: { name: "Клиент", phone } }),
    ).rejects.toMatchObject({ code: "TOO_MANY_BOOKINGS" });
    // Админът може да запише и повече.
    await createBooking(db, {
      ...bookingInput(service.id, sofiaToUtc(date, "12:00"), { barberId: barbers[0].id, source: "admin" }),
      customer: { name: "Клиент", phone },
    });
  });

  it("същият Idempotency-Key връща вече създадения час", async () => {
    const { service } = await createFixture(db);
    const input = bookingInput(service.id, sofiaToUtc(futureDate(), "13:00"), {
      source: "api",
      idempotencyKey: "api:retry-123",
    });
    const first = await createBooking(db, input);
    const again = await createBooking(db, input);
    expect(again.replayed).toBe(true);
    expect(again.appointment.id).toBe(first.appointment.id);
  });

  it("същият Idempotency-Key с други данни се отказва, без да връща записания час", async () => {
    const { service, barbers } = await createFixture(db, 2);
    const start = sofiaToUtc(futureDate(), "14:00");
    const input = bookingInput(service.id, start, {
      source: "api",
      idempotencyKey: "api:same-key",
      customer: { name: "Мария Иванова", phone: uniquePhone(), email: "maria@example.com" },
      note: "Бележка на Мария",
    });
    const first = await createBooking(db, input);

    const variants: Partial<CreateBookingInput>[] = [
      { customer: { ...input.customer, name: "Някой друг" } },
      { customer: { ...input.customer, email: null } },
      { customer: { ...input.customer, phone: uniquePhone() } },
      { note: null },
      { start: sofiaToUtc(futureDate(), "15:00") },
      { barberId: barbers.find((b) => b.id !== first.appointment.barberId)!.id },
    ];
    for (const change of variants) {
      await expect(createBooking(db, { ...input, ...change })).rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED" });
    }
    // Без barberId („първият свободен“) бръснарят не се сравнява.
    await expect(createBooking(db, { ...input, barberId: null })).resolves.toMatchObject({ replayed: true });
    expect(await db.select().from(appointments)).toHaveLength(1);
  });

  it("админът не може да върне отказан час, ако времето вече е заето", async () => {
    const { service, barbers } = await createFixture(db);
    const start = sofiaToUtc(futureDate(), "16:00");
    const first = await createBooking(db, bookingInput(service.id, start, { barberId: barbers[0].id }));
    await setAppointmentStatus(db, first.appointment.id, "cancelled");
    await createBooking(db, bookingInput(service.id, start, { barberId: barbers[0].id }));

    await expect(setAppointmentStatus(db, first.appointment.id, "booked")).rejects.toMatchObject({
      code: "SLOT_UNAVAILABLE",
    });
    await setAppointmentStatus(db, first.appointment.id, "no_show");
  });
});
