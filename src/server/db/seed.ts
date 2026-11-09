import { count, sql } from "drizzle-orm";
import { z } from "zod";
import { addDays, addMinutes, isoWeekday, sofiaToUtc, todayInSofia } from "@/lib/time";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/server/auth/password";
import { generateToken, sha256 } from "@/server/crypto";
import type { Db, DbLike } from "./create";
import {
  admins,
  appointments,
  barbers,
  services,
  timeOff,
  workingHours,
  type AppointmentStatus,
} from "./schema";

const log = (message: string) => console.log(`[seed] ${message}`);

// Само един процес зарежда данни в даден момент (напр. при няколко контейнера).
const SEED_LOCK_ID = 727_274_002;

export interface SeedOptions {
  adminEmail?: string;
  adminPassword?: string;
  adminName?: string;
  demoData: boolean;
  now?: Date;
}

export async function seed(db: Db, options: SeedOptions): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${SEED_LOCK_ID})`);
    await seedAdmin(tx, options);
    if (options.demoData) {
      await seedDemoData(tx, options.now ?? new Date());
    } else {
      log("Примерните данни са изключени (SEED_DEMO_DATA не е true).");
    }
  });
}

async function seedAdmin(db: DbLike, options: SeedOptions): Promise<void> {
  const [{ value: existing }] = await db.select({ value: count() }).from(admins);
  if (existing > 0) {
    log("Вече има администратор, пропускам създаването.");
    return;
  }

  const email = options.adminEmail?.trim().toLowerCase();
  const password = options.adminPassword ?? "";
  if (!email || !password) {
    log("ВНИМАНИЕ: няма администратор, а ADMIN_EMAIL или ADMIN_PASSWORD не са зададени. Задайте ги и рестартирайте.");
    return;
  }
  if (!z.email().safeParse(email).success) {
    throw new Error(`ADMIN_EMAIL не е валиден имейл: ${email}`);
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`ADMIN_PASSWORD трябва да е поне ${MIN_PASSWORD_LENGTH} символа.`);
  }

  await db.insert(admins).values({
    email,
    passwordHash: await hashPassword(password),
    name: options.adminName?.trim() || "Администратор",
  });
  log(`Създаден е администратор ${email}.`);
}

// ---------------------------------------------------------------------------
// Примерни данни
// ---------------------------------------------------------------------------

const demoServices = [
  {
    name: "Мъжко подстригване",
    description: "Консултация, измиване, подстригване с ножица и машинка, оформяне и стилизиране.",
    priceCents: 2500,
    durationMin: 45,
  },
  {
    name: "Подстригване и брада",
    description: "Пълната услуга: подстригване и оформяне на брада с гореща кърпа.",
    priceCents: 3800,
    durationMin: 75,
  },
  {
    name: "Фейд",
    description: "Плавен преход с машинка от кожата нагоре и оформяне отгоре.",
    priceCents: 3000,
    durationMin: 60,
  },
  {
    name: "Оформяне на брада",
    description: "Контур с бръснач, скъсяване и масло за брада.",
    priceCents: 1500,
    durationMin: 30,
  },
  {
    name: "Бръснене с бръснач",
    description: "Класическо бръснене с горещи кърпи, пяна и балсам след бръснене.",
    priceCents: 2200,
    durationMin: 45,
  },
  {
    name: "Детско подстригване",
    description: "За момчета до 12 години.",
    priceCents: 1500,
    durationMin: 30,
  },
];

type Interval = [start: string, end: string];

const demoBarbers: { name: string; bio: string; hours: Record<number, Interval[]> }[] = [
  {
    name: "Иван Петров",
    bio: "Основател на „Мустак“. Класически прически и бръснене с бръснач, 15 години зад стола.",
    hours: {
      2: [["10:00", "14:00"], ["15:00", "19:00"]],
      3: [["10:00", "14:00"], ["15:00", "19:00"]],
      4: [["10:00", "14:00"], ["15:00", "19:00"]],
      5: [["10:00", "14:00"], ["15:00", "19:00"]],
      6: [["10:00", "16:00"]],
    },
  },
  {
    name: "Николай Димитров",
    bio: "Фейдове и модерни прически. Донеси снимка от Instagram и Ники ще я направи.",
    hours: {
      1: [["12:00", "20:00"]],
      2: [["12:00", "20:00"]],
      3: [["12:00", "20:00"]],
      4: [["12:00", "20:00"]],
      5: [["12:00", "20:00"]],
      6: [["10:00", "16:00"]],
    },
  },
  {
    name: "Георги Стоянов",
    bio: "Специалист по бради. Търпелив с първите посетители и с най-малките клиенти.",
    hours: {
      1: [["10:00", "18:00"]],
      3: [["10:00", "18:00"]],
      4: [["10:00", "18:00"]],
      5: [["10:00", "18:00"]],
      6: [["10:00", "16:00"]],
    },
  },
];

const demoCustomers = [
  { name: "Петър Георгиев", phone: "+359888100201" },
  { name: "Мартин Колев", phone: "+359888100202" },
  { name: "Стефан Илиев", phone: "+359888100203" },
  { name: "Даниел Христов", phone: "+359888100204" },
  { name: "Калоян Николов", phone: "+359888100205" },
  { name: "Виктор Тодоров", phone: "+359888100206" },
  { name: "Александър Маринов", phone: "+359888100207" },
  { name: "Борис Ангелов", phone: "+359888100208" },
];

const demoNotes = ["Първо посещение.", "Иска да остане дълго отгоре.", "Ще закъснее 5 минути."];

async function seedDemoData(db: DbLike, now: Date): Promise<void> {
  const [{ value: serviceCount }] = await db.select({ value: count() }).from(services);
  const [{ value: barberCount }] = await db.select({ value: count() }).from(barbers);
  if (serviceCount > 0 || barberCount > 0) {
    log("Базата вече има услуги или бръснари, пропускам примерните данни.");
    return;
  }

  const insertedServices = await db
    .insert(services)
    .values(demoServices.map((s, i) => ({ ...s, sortOrder: i })))
    .returning();

  const insertedBarbers = await db
    .insert(barbers)
    .values(demoBarbers.map((b, i) => ({ name: b.name, bio: b.bio, sortOrder: i })))
    .returning();

  const hoursRows = insertedBarbers.flatMap((barber, i) =>
    Object.entries(demoBarbers[i].hours).flatMap(([weekday, intervals]) =>
      intervals.map(([startTime, endTime]) => ({ barberId: barber.id, weekday: Number(weekday), startTime, endTime })),
    ),
  );
  await db.insert(workingHours).values(hoursRows);

  const today = todayInSofia(now);
  await db.insert(timeOff).values({
    barberId: insertedBarbers[2].id,
    startsAt: sofiaToUtc(addDays(today, 10), "00:00"),
    endsAt: sofiaToUtc(addDays(today, 12), "00:00"),
    reason: "Отпуск",
  });

  // Няколко часа за днес и следващите два дни, в работното време на всеки бръснар.
  const offsetsMin = [0, 90, 180, 300];
  const rows: (typeof appointments.$inferInsert)[] = [];
  let n = 0;
  for (let day = 0; day < 3; day++) {
    const date = addDays(today, day);
    const weekday = isoWeekday(date);
    insertedBarbers.forEach((barber, barberIndex) => {
      const intervals = demoBarbers[barberIndex].hours[weekday] ?? [];
      if (intervals.length === 0) return;
      const dayStart = sofiaToUtc(date, intervals[0][0]);
      for (const offset of offsetsMin) {
        const service = insertedServices[n % insertedServices.length];
        const startsAt = addMinutes(dayStart, offset);
        const endsAt = addMinutes(startsAt, service.durationMin);
        const fits = intervals.some(
          ([s, e]) => startsAt >= sofiaToUtc(date, s) && endsAt <= sofiaToUtc(date, e),
        );
        if (!fits) continue;
        const customer = demoCustomers[n % demoCustomers.length];
        let status: AppointmentStatus;
        if (endsAt <= now) status = n % 5 === 4 ? "no_show" : "arrived";
        else if (startsAt <= now) status = "arrived";
        else status = n % 2 === 0 ? "confirmed" : "booked";
        rows.push({
          barberId: barber.id,
          serviceId: service.id,
          startsAt,
          endsAt,
          status,
          customerName: customer.name,
          customerPhone: customer.phone,
          note: n % 4 === 1 ? demoNotes[n % demoNotes.length] : null,
          serviceName: service.name,
          priceCents: service.priceCents,
          durationMin: service.durationMin,
          source: n % 3 === 0 ? "admin" : "web",
          cancelTokenHash: sha256(generateToken()),
        });
        n++;
      }
    });
  }
  if (rows.length > 0) await db.insert(appointments).values(rows);

  log(
    `Заредени са ${insertedServices.length} услуги, ${insertedBarbers.length} бръснари, ` +
      `${hoursRows.length} интервала работно време и ${rows.length} примерни часа.`,
  );
}
