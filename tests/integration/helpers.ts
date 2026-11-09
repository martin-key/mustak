import { sql } from "drizzle-orm";
import { inject } from "vitest";
import { addDays, todayInSofia } from "@/lib/time";
import { createDb, type Db } from "@/server/db/create";
import { barbers, services, workingHours } from "@/server/db/schema";

let instance: ReturnType<typeof createDb> | undefined;

/** Отделна връзка за тестовете, с достатъчно връзки за паралелните заявки. */
export function testDb(): Db {
  instance ??= createDb(inject("databaseUrl"), { max: 25 });
  return instance.db;
}

export async function closeTestDb(): Promise<void> {
  await instance?.pool.end();
  instance = undefined;
}

export async function resetDb(db: Db): Promise<void> {
  await db.execute(sql`
    TRUNCATE appointments, time_off, working_hours, barbers, services, sessions, admins, rate_limits
    RESTART IDENTITY CASCADE
  `);
}

/** Дата след `days` дни в София (за да не зависят тестовете от днешния час). */
export function futureDate(days = 7): string {
  return addDays(todayInSofia(), days);
}

/** Услуга от 30 минути и бръснари, които работят всеки ден 09:00–18:00. */
export async function createFixture(db: Db, barberCount = 1) {
  const [service] = await db
    .insert(services)
    .values({ name: "Подстригване", priceCents: 2500, durationMin: 30 })
    .returning();
  const barberRows = await db
    .insert(barbers)
    .values(Array.from({ length: barberCount }, (_, i) => ({ name: `Бръснар ${i + 1}`, sortOrder: i })))
    .returning();
  await db.insert(workingHours).values(
    barberRows.flatMap((barber) =>
      [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
        barberId: barber.id,
        weekday,
        startTime: "09:00",
        endTime: "18:00",
      })),
    ),
  );
  return { service, barbers: barberRows };
}

let phoneCounter = 0;
/** Различен валиден телефон за всеки клиент. */
export function uniquePhone(): string {
  phoneCounter++;
  return `+35988${String(1_000_000 + phoneCounter).slice(-7)}`;
}
