/**
 * Бизнес логиката за записване. Единственото място, което създава, отказва и сменя часове.
 * Ползва се от публичния сайт (Server Actions), админ панела и API-то за AI агента.
 */
import { and, asc, eq, gt, inArray, lt, type SQL } from "drizzle-orm";
import { business } from "@/config/business";
import { addMinutes, endOfSofiaDay, isoWeekday, startOfSofiaDay, toSofiaDate, type LocalDate } from "@/lib/time";
import { generateToken, sha256 } from "@/server/crypto";
import type { DbLike } from "@/server/db/create";
import { isOverlapViolation, pgConstraint, pgErrorCode, PG_UNIQUE_VIOLATION } from "@/server/db/errors";
import {
  activeAppointmentStatuses,
  appointments,
  barbers,
  services,
  timeOff,
  workingHours,
  type Appointment,
  type AppointmentSource,
  type AppointmentStatus,
  type Barber,
  type Service,
} from "@/server/db/schema";
import { computeBarberSlots, computeSlots, isBookableDate, type BarberDay, type BookingRules, type Slot } from "./availability";
import { BookingError } from "./errors";

export interface BookingPolicy extends BookingRules {
  cancelMinNoticeMinutes: number;
  maxActiveBookingsPerPhone: number;
}

export const defaultPolicy: BookingPolicy = business.booking;

interface Clock {
  now?: Date;
  policy?: BookingPolicy;
}

const ACTIVE: AppointmentStatus[] = [...activeAppointmentStatuses];
const CUSTOMER_CANCELLABLE: AppointmentStatus[] = ["booked", "confirmed"];

// ---------------------------------------------------------------------------
// Зареждане на данни
// ---------------------------------------------------------------------------

async function getActiveService(db: DbLike, serviceId: string): Promise<Service> {
  const [service] = await db
    .select()
    .from(services)
    .where(and(eq(services.id, serviceId), eq(services.isActive, true)));
  if (!service) throw new BookingError("SERVICE_NOT_FOUND");
  return service;
}

/** Активните бръснари (или само един), подредени както в сайта. */
async function getActiveBarbers(db: DbLike, barberId?: string | null): Promise<Barber[]> {
  const list = await db
    .select()
    .from(barbers)
    .where(barberId ? and(eq(barbers.isActive, true), eq(barbers.id, barberId)) : eq(barbers.isActive, true))
    .orderBy(asc(barbers.sortOrder), asc(barbers.name));
  if (barberId && list.length === 0) throw new BookingError("BARBER_NOT_FOUND");
  return list;
}

interface LoadedBarberDay extends BarberDay {
  appointmentCount: number;
}

/** Графикът и заетото време на бръснарите за една дата. */
async function loadBarberDays(db: DbLike, barberIds: string[], date: LocalDate): Promise<LoadedBarberDay[]> {
  if (barberIds.length === 0) return [];
  const dayStart = startOfSofiaDay(date);
  const dayEnd = endOfSofiaDay(date);

  const [hours, offs, appts] = await Promise.all([
    db
      .select({
        barberId: workingHours.barberId,
        weekday: workingHours.weekday,
        startTime: workingHours.startTime,
        endTime: workingHours.endTime,
      })
      .from(workingHours)
      .where(and(inArray(workingHours.barberId, barberIds), eq(workingHours.weekday, isoWeekday(date)))),
    db
      .select({ barberId: timeOff.barberId, start: timeOff.startsAt, end: timeOff.endsAt })
      .from(timeOff)
      .where(and(inArray(timeOff.barberId, barberIds), lt(timeOff.startsAt, dayEnd), gt(timeOff.endsAt, dayStart))),
    db
      .select({ barberId: appointments.barberId, start: appointments.startsAt, end: appointments.endsAt })
      .from(appointments)
      .where(
        and(
          inArray(appointments.barberId, barberIds),
          inArray(appointments.status, ACTIVE),
          lt(appointments.startsAt, dayEnd),
          gt(appointments.endsAt, dayStart),
        ),
      ),
  ]);

  return barberIds.map((barberId) => {
    const own = appts.filter((a) => a.barberId === barberId);
    return {
      barberId,
      workingHours: hours.filter((h) => h.barberId === barberId),
      busy: [...offs.filter((o) => o.barberId === barberId), ...own].map(({ start, end }) => ({ start, end })),
      appointmentCount: own.length,
    };
  });
}

/**
 * Заключва графика на бръснаря до края на текущата транзакция (или savepoint).
 *
 * Без това две едновременни INSERT-а за един бръснар и едно време стигат до deadlock (40P01), а не до 23P01:
 * EXCLUDE ограничението първо добавя записа в индекса и после търси конфликти, така че всяка транзакция
 * вижда незавършения запис на другата и я чака. PostgreSQL прекъсва едната след deadlock_timeout (1 s).
 * С ключалката записите за един бръснар минават един след друг и губещият получава 23P01 веднага.
 * Защитата от двойно записване остава в ограничението на базата; ключалката само подрежда опашката.
 * FOR NO KEY UPDATE не спира проверката на foreign key при INSERT в appointments (тя е FOR KEY SHARE).
 */
async function lockBarberSchedule(tx: DbLike, barberId: string): Promise<void> {
  await tx.select({ id: barbers.id }).from(barbers).where(eq(barbers.id, barberId)).for("no key update");
}

// ---------------------------------------------------------------------------
// Свободни часове
// ---------------------------------------------------------------------------

export interface AvailabilityQuery {
  serviceId: string;
  date: LocalDate;
  /** Без бръснар: всеки свободен. */
  barberId?: string | null;
}

export interface AvailabilityResult {
  date: LocalDate;
  service: Service;
  barbers: Barber[];
  slots: Slot[];
}

export async function getAvailability(db: DbLike, query: AvailabilityQuery, clock: Clock = {}): Promise<AvailabilityResult> {
  const now = clock.now ?? new Date();
  const policy = clock.policy ?? defaultPolicy;

  const service = await getActiveService(db, query.serviceId);
  const barberList = await getActiveBarbers(db, query.barberId);
  if (!isBookableDate(query.date, now, policy)) {
    return { date: query.date, service, barbers: barberList, slots: [] };
  }

  const days = await loadBarberDays(
    db,
    barberList.map((b) => b.id),
    query.date,
  );
  const slots = computeSlots({ date: query.date, durationMin: service.durationMin, barbers: days, now, rules: policy });
  return { date: query.date, service, barbers: barberList, slots };
}

// ---------------------------------------------------------------------------
// Записване
// ---------------------------------------------------------------------------

export interface CreateBookingInput {
  serviceId: string;
  /** Без бръснар: системата избира свободен. */
  barberId?: string | null;
  start: Date;
  customer: { name: string; phone: string; email?: string | null };
  note?: string | null;
  source: AppointmentSource;
  idempotencyKey?: string | null;
  /** Само за админ панела. */
  status?: "booked" | "confirmed";
  /**
   * Само за админ панела: пропуска проверката за работно време, почивки и време напред
   * (напр. клиент без час, записан извън графика). Припокриването пак се спира от базата.
   */
  skipAvailabilityCheck?: boolean;
}

export interface CreatedBooking {
  appointment: Appointment;
  /** Токенът за линка за отказ. null при повторена заявка със същия Idempotency-Key. */
  cancelToken: string | null;
  /** true, ако часът вече е бил създаден със същия Idempotency-Key. */
  replayed: boolean;
}

async function findByIdempotencyKey(db: DbLike, key: string): Promise<Appointment | undefined> {
  const [row] = await db.select().from(appointments).where(eq(appointments.idempotencyKey, key));
  return row;
}

export async function createBooking(db: DbLike, input: CreateBookingInput, clock: Clock = {}): Promise<CreatedBooking> {
  const now = clock.now ?? new Date();
  const policy = clock.policy ?? defaultPolicy;

  if (input.idempotencyKey) {
    const existing = await findByIdempotencyKey(db, input.idempotencyKey);
    if (existing) return { appointment: existing, cancelToken: null, replayed: true };
  }

  const service = await getActiveService(db, input.serviceId);
  const start = input.start;
  const end = addMinutes(start, service.durationMin);
  const date = toSofiaDate(start);

  if (input.source !== "admin") {
    if (!isBookableDate(date, now, policy)) throw new BookingError("DATE_OUT_OF_RANGE");
    const upcoming = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(
        and(
          eq(appointments.customerPhone, input.customer.phone),
          inArray(appointments.status, ACTIVE),
          gt(appointments.startsAt, now),
        ),
      )
      .limit(policy.maxActiveBookingsPerPhone);
    if (upcoming.length >= policy.maxActiveBookingsPerPhone) throw new BookingError("TOO_MANY_BOOKINGS");
  }

  const candidates = await getActiveBarbers(db, input.barberId);
  const days = await loadBarberDays(
    db,
    candidates.map((b) => b.id),
    date,
  );

  // Кои бръснари са свободни за точно този час (по работно време, почивки и вече записани часове).
  let free = days;
  if (!input.skipAvailabilityCheck) {
    free = days.filter((day) =>
      computeBarberSlots({
        date,
        durationMin: service.durationMin,
        workingHours: day.workingHours,
        busy: day.busy,
        now,
        rules: policy,
      }).some((slot) => slot.getTime() === start.getTime()),
    );
  }
  // При „който е свободен“: първо най-малко натоварения за деня. sort е стабилен, така че иначе е редът от сайта.
  if (!input.barberId) free = [...free].sort((a, b) => a.appointmentCount - b.appointmentCount);
  if (free.length === 0) throw new BookingError("SLOT_UNAVAILABLE");

  for (const day of free) {
    const cancelToken = generateToken();
    try {
      // Отделна транзакция (или savepoint, ако вече сме в транзакция), за да може да опитаме следващия бръснар.
      const [appointment] = await db.transaction(async (tx) => {
        await lockBarberSchedule(tx, day.barberId);
        return tx
          .insert(appointments)
          .values({
            barberId: day.barberId,
            serviceId: service.id,
            startsAt: start,
            endsAt: end,
            status: input.status ?? "booked",
            customerName: input.customer.name,
            customerPhone: input.customer.phone,
            customerEmail: input.customer.email ?? null,
            note: input.note ?? null,
            serviceName: service.name,
            priceCents: service.priceCents,
            durationMin: service.durationMin,
            source: input.source,
            cancelTokenHash: sha256(cancelToken),
            idempotencyKey: input.idempotencyKey ?? null,
          })
          .returning();
      });
      return { appointment, cancelToken, replayed: false };
    } catch (error) {
      // Друг клиент е записал същото време в същия момент: базата е отказала. Пробваме следващия бръснар.
      if (isOverlapViolation(error)) continue;
      if (
        input.idempotencyKey &&
        pgErrorCode(error) === PG_UNIQUE_VIOLATION &&
        pgConstraint(error) === "appointments_idempotency_key_unique"
      ) {
        const existing = await findByIdempotencyKey(db, input.idempotencyKey);
        if (existing) return { appointment: existing, cancelToken: null, replayed: true };
      }
      throw error;
    }
  }

  throw new BookingError("SLOT_UNAVAILABLE");
}

// ---------------------------------------------------------------------------
// Преглед и отказ през линка
// ---------------------------------------------------------------------------

export interface BookingView {
  id: string;
  status: AppointmentStatus;
  startsAt: Date;
  endsAt: Date;
  serviceName: string;
  priceCents: number;
  durationMin: number;
  barberId: string;
  barberName: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  note: string | null;
  cancelledAt: Date | null;
  cancelledBy: "customer" | "admin" | null;
}

const bookingViewColumns = {
  id: appointments.id,
  status: appointments.status,
  startsAt: appointments.startsAt,
  endsAt: appointments.endsAt,
  serviceName: appointments.serviceName,
  priceCents: appointments.priceCents,
  durationMin: appointments.durationMin,
  barberId: appointments.barberId,
  barberName: barbers.name,
  customerName: appointments.customerName,
  customerPhone: appointments.customerPhone,
  customerEmail: appointments.customerEmail,
  note: appointments.note,
  cancelledAt: appointments.cancelledAt,
  cancelledBy: appointments.cancelledBy,
};

async function findBookingView(db: DbLike, where: SQL): Promise<BookingView | null> {
  const [row] = await db
    .select(bookingViewColumns)
    .from(appointments)
    .innerJoin(barbers, eq(barbers.id, appointments.barberId))
    .where(where);
  return row ?? null;
}

/** Часът по токена от линка за отказ. */
export async function getBookingByToken(db: DbLike, token: string): Promise<BookingView | null> {
  if (!token || token.length > 100) return null;
  return findBookingView(db, eq(appointments.cancelTokenHash, sha256(token)));
}

export async function getBookingById(db: DbLike, id: string): Promise<BookingView | null> {
  return findBookingView(db, eq(appointments.id, id));
}

/** Може ли клиентът сам да откаже часа, и ако не, защо. */
export function customerCancelCheck(
  booking: Pick<BookingView, "status" | "startsAt">,
  now: Date = new Date(),
  policy: BookingPolicy = defaultPolicy,
): { allowed: true } | { allowed: false; code: "ALREADY_CANCELLED" | "NOT_CANCELLABLE" | "TOO_LATE_TO_CANCEL" } {
  if (booking.status === "cancelled") return { allowed: false, code: "ALREADY_CANCELLED" };
  if (!CUSTOMER_CANCELLABLE.includes(booking.status)) return { allowed: false, code: "NOT_CANCELLABLE" };
  if (booking.startsAt.getTime() - now.getTime() < policy.cancelMinNoticeMinutes * 60_000) {
    return { allowed: false, code: "TOO_LATE_TO_CANCEL" };
  }
  return { allowed: true };
}

/** Отказ от клиента през уникалния линк. Освобождава часа. */
export async function cancelBookingByToken(db: DbLike, token: string, clock: Clock = {}): Promise<BookingView> {
  const now = clock.now ?? new Date();
  const booking = await getBookingByToken(db, token);
  if (!booking) throw new BookingError("NOT_FOUND");

  const check = customerCancelCheck(booking, now, clock.policy ?? defaultPolicy);
  if (!check.allowed) throw new BookingError(check.code);

  const updated = await db
    .update(appointments)
    .set({ status: "cancelled", cancelledAt: now, cancelledBy: "customer" })
    .where(and(eq(appointments.id, booking.id), inArray(appointments.status, CUSTOMER_CANCELLABLE)))
    .returning({ id: appointments.id });
  if (updated.length === 0) throw new BookingError("NOT_CANCELLABLE");

  return { ...booking, status: "cancelled", cancelledAt: now, cancelledBy: "customer" };
}

// ---------------------------------------------------------------------------
// Админ: смяна на статус
// ---------------------------------------------------------------------------

export async function setAppointmentStatus(
  db: DbLike,
  id: string,
  status: AppointmentStatus,
  clock: Pick<Clock, "now"> = {},
): Promise<void> {
  const now = clock.now ?? new Date();
  const [current] = await db
    .select({ status: appointments.status, barberId: appointments.barberId })
    .from(appointments)
    .where(eq(appointments.id, id));
  if (!current) throw new BookingError("NOT_FOUND");
  if (current.status === status) return;

  const cancelling = status === "cancelled";
  try {
    await db.transaction(async (tx) => {
      // Активиране на час може да се засече с ново записване за същия бръснар (виж lockBarberSchedule).
      if (ACTIVE.includes(status)) await lockBarberSchedule(tx, current.barberId);
      await tx
        .update(appointments)
        .set({
          status,
          cancelledAt: cancelling ? now : null,
          cancelledBy: cancelling ? "admin" : null,
        })
        .where(eq(appointments.id, id));
    });
  } catch (error) {
    if (isOverlapViolation(error)) {
      throw new BookingError(
        "SLOT_UNAVAILABLE",
        "Часът не може да стане активен: в това време бръснарят вече има друг час.",
      );
    }
    throw error;
  }
}
