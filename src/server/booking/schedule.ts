/** Заявки за графика в админ панела. */
import { and, asc, eq, gt, gte, lt } from "drizzle-orm";
import { addDays, endOfSofiaDay, startOfSofiaDay, type LocalDate } from "@/lib/time";
import type { DbLike } from "@/server/db/create";
import { appointments, barbers, timeOff, workingHours, type AppointmentSource, type AppointmentStatus } from "@/server/db/schema";

export interface ScheduleAppointment {
  id: string;
  barberId: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  source: AppointmentSource;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  note: string | null;
  serviceName: string;
  priceCents: number;
  durationMin: number;
}

export interface ScheduleBarber {
  id: string;
  name: string;
  isActive: boolean;
  hours: { weekday: number; startTime: string; endTime: string }[];
  timeOff: { startsAt: Date; endsAt: Date; reason: string }[];
}

export interface Schedule {
  from: LocalDate;
  /** Включително. */
  to: LocalDate;
  barbers: ScheduleBarber[];
  appointments: ScheduleAppointment[];
}

/** Графикът за периода [from, to] (местни дати, включително). */
export async function getSchedule(db: DbLike, from: LocalDate, to: LocalDate): Promise<Schedule> {
  const start = startOfSofiaDay(from);
  const end = endOfSofiaDay(to);

  const [appts, barberRows, hours, offs] = await Promise.all([
    db
      .select({
        id: appointments.id,
        barberId: appointments.barberId,
        startsAt: appointments.startsAt,
        endsAt: appointments.endsAt,
        status: appointments.status,
        source: appointments.source,
        customerName: appointments.customerName,
        customerPhone: appointments.customerPhone,
        customerEmail: appointments.customerEmail,
        note: appointments.note,
        serviceName: appointments.serviceName,
        priceCents: appointments.priceCents,
        durationMin: appointments.durationMin,
      })
      .from(appointments)
      .where(and(gte(appointments.startsAt, start), lt(appointments.startsAt, end)))
      .orderBy(asc(appointments.startsAt)),
    db
      .select({ id: barbers.id, name: barbers.name, isActive: barbers.isActive })
      .from(barbers)
      .orderBy(asc(barbers.sortOrder), asc(barbers.name)),
    db.select().from(workingHours).orderBy(asc(workingHours.startTime)),
    db
      .select()
      .from(timeOff)
      .where(and(lt(timeOff.startsAt, end), gt(timeOff.endsAt, start))),
  ]);

  // Неактивните бръснари се показват само ако имат часове в периода.
  const withAppointments = new Set(appts.map((a) => a.barberId));
  const visible = barberRows.filter((b) => b.isActive || withAppointments.has(b.id));

  return {
    from,
    to,
    appointments: appts,
    barbers: visible.map((b) => ({
      ...b,
      hours: hours
        .filter((h) => h.barberId === b.id)
        .map((h) => ({ weekday: h.weekday, startTime: h.startTime, endTime: h.endTime })),
      timeOff: offs
        .filter((o) => o.barberId === b.id)
        .map((o) => ({ startsAt: o.startsAt, endsAt: o.endsAt, reason: o.reason })),
    })),
  };
}

export async function getWeekSchedule(db: DbLike, monday: LocalDate): Promise<Schedule> {
  return getSchedule(db, monday, addDays(monday, 6));
}

/** Бръснарите за падащите менюта в админ панела. */
export async function listBarberOptions(db: DbLike, activeOnly = true) {
  return db
    .select({ id: barbers.id, name: barbers.name, isActive: barbers.isActive })
    .from(barbers)
    .where(activeOnly ? eq(barbers.isActive, true) : undefined)
    .orderBy(asc(barbers.sortOrder), asc(barbers.name));
}

