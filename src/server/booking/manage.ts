/** Управление на услуги, бръснари, работно време и почивки (админ панел). */
import { and, asc, count, eq, gt, inArray, lt } from "drizzle-orm";
import { z } from "zod";
import { addDays, isLocalDate, isTimeOfDay, sofiaToUtc } from "@/lib/time";
import type { DbLike } from "@/server/db/create";
import {
  activeAppointmentStatuses,
  appointments,
  barbers,
  services,
  timeOff,
  workingHours,
} from "@/server/db/schema";

export class ManageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManageError";
  }
}

// ---------------------------------------------------------------------------
// Схеми
// ---------------------------------------------------------------------------

const checkbox = z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean());

/** "25", "25,50" или "25.5" → евроцентове. */
const priceSchema = z
  .string({ error: "Въведете цена." })
  .trim()
  .transform((value, ctx) => {
    const match = /^(\d{1,4})(?:[.,](\d{1,2}))?$/.exec(value);
    if (!match) {
      ctx.addIssue({ code: "custom", message: "Цената трябва да е число, напр. 25 или 25,50." });
      return z.NEVER;
    }
    return Number(match[1]) * 100 + Number((match[2] ?? "0").padEnd(2, "0"));
  });

export const serviceInputSchema = z.object({
  name: z.string().trim().min(2, { error: "Въведете име (поне 2 символа)." }).max(80, { error: "Името е твърде дълго." }),
  description: z.string().trim().max(300, { error: "Описанието е твърде дълго (до 300 символа)." }).default(""),
  price: priceSchema,
  durationMin: z.coerce
    .number({ error: "Въведете продължителност в минути." })
    .int({ error: "Продължителността е цяло число минути." })
    .min(5, { error: "Най-малко 5 минути." })
    .max(480, { error: "Най-много 480 минути." })
    .refine((v) => v % 5 === 0, { error: "Продължителността трябва да е кратна на 5 минути." }),
  isActive: checkbox,
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

export const barberInputSchema = z.object({
  name: z.string().trim().min(2, { error: "Въведете име (поне 2 символа)." }).max(80, { error: "Името е твърде дълго." }),
  bio: z.string().trim().max(400, { error: "Описанието е твърде дълго (до 400 символа)." }).default(""),
  photoUrl: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || (/^\/[\w\-./]+$/.test(v) && !v.includes("..") && !v.startsWith("//")), {
      error: "Снимката трябва да е локален файл от папката public, напр. /barbers/ivan.jpg.",
    }),
  isActive: checkbox,
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

const timeSchema = z
  .string()
  .refine(isTimeOfDay, { error: "Невалиден час." })
  .transform((v) => v.slice(0, 5));

export const workingHoursInputSchema = z
  .array(z.object({ weekday: z.number().int().min(1).max(7), startTime: timeSchema, endTime: timeSchema }))
  .max(50)
  .superRefine((rows, ctx) => {
    rows.forEach((row, i) => {
      if (row.startTime >= row.endTime) {
        ctx.addIssue({ code: "custom", path: [i], message: "Краят трябва да е след началото." });
      }
    });
    for (let weekday = 1; weekday <= 7; weekday++) {
      const day = rows.filter((r) => r.weekday === weekday).sort((a, b) => a.startTime.localeCompare(b.startTime));
      for (let i = 1; i < day.length; i++) {
        if (day[i].startTime < day[i - 1].endTime) {
          ctx.addIssue({ code: "custom", path: [rows.indexOf(day[i])], message: "Интервалите в един ден се застъпват." });
        }
      }
    }
  });

export const timeOffInputSchema = z
  .object({
    fromDate: z.string().refine(isLocalDate, { error: "Изберете начална дата." }),
    toDate: z.string().refine(isLocalDate, { error: "Изберете крайна дата." }),
    allDay: checkbox,
    fromTime: z.string().optional(),
    toTime: z.string().optional(),
    reason: z.string().trim().max(100, { error: "Причината е твърде дълга." }).default(""),
  })
  .superRefine((v, ctx) => {
    if (v.toDate < v.fromDate) ctx.addIssue({ code: "custom", path: ["toDate"], message: "Крайната дата е преди началната." });
    if (!v.allDay) {
      if (!v.fromTime || !isTimeOfDay(v.fromTime)) ctx.addIssue({ code: "custom", path: ["fromTime"], message: "Изберете начален час." });
      if (!v.toTime || !isTimeOfDay(v.toTime)) ctx.addIssue({ code: "custom", path: ["toTime"], message: "Изберете краен час." });
      if (v.fromDate === v.toDate && v.fromTime && v.toTime && v.fromTime >= v.toTime) {
        ctx.addIssue({ code: "custom", path: ["toTime"], message: "Краят трябва да е след началото." });
      }
    }
  })
  .transform((v) => ({
    startsAt: sofiaToUtc(v.fromDate, v.allDay ? "00:00" : v.fromTime!),
    endsAt: v.allDay ? sofiaToUtc(addDays(v.toDate, 1), "00:00") : sofiaToUtc(v.toDate, v.toTime!),
    reason: v.reason,
  }));

export type ServiceInput = z.output<typeof serviceInputSchema>;
export type BarberInput = z.output<typeof barberInputSchema>;

// ---------------------------------------------------------------------------
// Услуги
// ---------------------------------------------------------------------------

export async function listAllServices(db: DbLike) {
  return db.select().from(services).orderBy(asc(services.sortOrder), asc(services.name));
}

export async function getService(db: DbLike, id: string) {
  const [row] = await db.select().from(services).where(eq(services.id, id));
  return row ?? null;
}

function serviceValues(input: ServiceInput) {
  return {
    name: input.name,
    description: input.description,
    priceCents: input.price,
    durationMin: input.durationMin,
    isActive: input.isActive,
    sortOrder: input.sortOrder,
  };
}

export async function createService(db: DbLike, input: ServiceInput) {
  const [row] = await db.insert(services).values(serviceValues(input)).returning();
  return row;
}

/** Промяната не засяга вече записаните часове: те пазят цената и продължителността от момента на записване. */
export async function updateService(db: DbLike, id: string, input: ServiceInput) {
  const [row] = await db.update(services).set(serviceValues(input)).where(eq(services.id, id)).returning();
  if (!row) throw new ManageError("Услугата не е намерена.");
  return row;
}

export async function deleteService(db: DbLike, id: string) {
  const [{ value }] = await db.select({ value: count() }).from(appointments).where(eq(appointments.serviceId, id));
  if (value > 0) {
    throw new ManageError("Услугата има записани часове и не може да се изтрие. Направете я неактивна.");
  }
  await db.delete(services).where(eq(services.id, id));
}

// ---------------------------------------------------------------------------
// Бръснари
// ---------------------------------------------------------------------------

export async function listAllBarbers(db: DbLike) {
  const [rows, hours] = await Promise.all([
    db.select().from(barbers).orderBy(asc(barbers.sortOrder), asc(barbers.name)),
    db.select({ barberId: workingHours.barberId, weekday: workingHours.weekday }).from(workingHours),
  ]);
  return rows.map((b) => ({
    ...b,
    workingWeekdays: [...new Set(hours.filter((h) => h.barberId === b.id).map((h) => h.weekday))].sort(),
  }));
}

export async function getBarberDetail(db: DbLike, id: string, now: Date = new Date()) {
  const [barber] = await db.select().from(barbers).where(eq(barbers.id, id));
  if (!barber) return null;
  const [hours, offs] = await Promise.all([
    db
      .select({ weekday: workingHours.weekday, startTime: workingHours.startTime, endTime: workingHours.endTime })
      .from(workingHours)
      .where(eq(workingHours.barberId, id))
      .orderBy(asc(workingHours.weekday), asc(workingHours.startTime)),
    db
      .select()
      .from(timeOff)
      .where(and(eq(timeOff.barberId, id), gt(timeOff.endsAt, now)))
      .orderBy(asc(timeOff.startsAt)),
  ]);
  return { barber, hours, timeOff: offs };
}

function barberValues(input: BarberInput) {
  return { name: input.name, bio: input.bio, photoUrl: input.photoUrl, isActive: input.isActive, sortOrder: input.sortOrder };
}

export async function createBarber(db: DbLike, input: BarberInput) {
  const [row] = await db.insert(barbers).values(barberValues(input)).returning();
  return row;
}

export async function updateBarber(db: DbLike, id: string, input: BarberInput) {
  const [row] = await db.update(barbers).set(barberValues(input)).where(eq(barbers.id, id)).returning();
  if (!row) throw new ManageError("Бръснарят не е намерен.");
  return row;
}

export async function deleteBarber(db: DbLike, id: string) {
  const [{ value }] = await db.select({ value: count() }).from(appointments).where(eq(appointments.barberId, id));
  if (value > 0) {
    throw new ManageError("Бръснарят има записани часове и не може да се изтрие. Направете го неактивен.");
  }
  await db.delete(barbers).where(eq(barbers.id, id));
}

/** Заменя целия седмичен график на бръснаря. Вече записаните часове не се променят. */
export async function replaceWorkingHours(
  db: DbLike,
  barberId: string,
  rows: z.output<typeof workingHoursInputSchema>,
) {
  await db.transaction(async (tx) => {
    await tx.delete(workingHours).where(eq(workingHours.barberId, barberId));
    if (rows.length > 0) {
      await tx.insert(workingHours).values(rows.map((r) => ({ ...r, barberId })));
    }
  });
}

/** Добавя почивка. Връща колко активни часа попадат в нея (за предупреждение). */
export async function addTimeOff(
  db: DbLike,
  barberId: string,
  input: z.output<typeof timeOffInputSchema>,
): Promise<number> {
  await db.insert(timeOff).values({ barberId, ...input });
  const [{ value }] = await db
    .select({ value: count() })
    .from(appointments)
    .where(
      and(
        eq(appointments.barberId, barberId),
        inArray(appointments.status, [...activeAppointmentStatuses]),
        lt(appointments.startsAt, input.endsAt),
        gt(appointments.endsAt, input.startsAt),
      ),
    );
  return value;
}

export async function deleteTimeOff(db: DbLike, barberId: string, id: string) {
  await db.delete(timeOff).where(and(eq(timeOff.id, id), eq(timeOff.barberId, barberId)));
}
