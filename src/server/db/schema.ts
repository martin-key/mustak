import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

const timestamps = {
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

// ---------------------------------------------------------------------------
// Администратори и сесии
// ---------------------------------------------------------------------------

export const admins = pgTable("admins", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Пази се с малки букви. */
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  lastLoginAt: timestamptz("last_login_at"),
});

export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 (hex) на токена от бисквитката. Самият токен не се пази. */
    id: text("id").primaryKey(),
    adminId: uuid("admin_id")
      .notNull()
      .references(() => admins.id, { onDelete: "cascade" }),
    expiresAt: timestamptz("expires_at").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [index("sessions_admin_id_idx").on(t.adminId)],
);

// ---------------------------------------------------------------------------
// Услуги и бръснари
// ---------------------------------------------------------------------------

export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    /** Цена в евроцентове. */
    priceCents: integer("price_cents").notNull(),
    durationMin: integer("duration_min").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    check("services_price_check", sql`${t.priceCents} >= 0`),
    check("services_duration_check", sql`${t.durationMin} between 5 and 480 and ${t.durationMin} % 5 = 0`),
  ],
);

export const barbers = pgTable("barbers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  bio: text("bio").notNull().default(""),
  photoUrl: text("photo_url"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
});

/**
 * Седмичен график на бръснар в местно време (Europe/Sofia).
 * Няколко реда за един ден = почивка между тях. Ден без редове = почивен ден.
 */
export const workingHours = pgTable(
  "working_hours",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    barberId: uuid("barber_id")
      .notNull()
      .references(() => barbers.id, { onDelete: "cascade" }),
    /** ISO ден от седмицата: 1 = понеделник … 7 = неделя. */
    weekday: smallint("weekday").notNull(),
    /** "HH:MM:SS" */
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
  },
  (t) => [
    index("working_hours_barber_idx").on(t.barberId, t.weekday),
    check("working_hours_weekday_check", sql`${t.weekday} between 1 and 7`),
    check("working_hours_range_check", sql`${t.startTime} < ${t.endTime}`),
  ],
);

/** Отпуски, почивни дни и други периоди, в които бръснарят не приема. */
export const timeOff = pgTable(
  "time_off",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    barberId: uuid("barber_id")
      .notNull()
      .references(() => barbers.id, { onDelete: "cascade" }),
    startsAt: timestamptz("starts_at").notNull(),
    endsAt: timestamptz("ends_at").notNull(),
    reason: text("reason").notNull().default(""),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("time_off_barber_idx").on(t.barberId, t.startsAt),
    check("time_off_range_check", sql`${t.startsAt} < ${t.endsAt}`),
  ],
);

// ---------------------------------------------------------------------------
// Записани часове
// ---------------------------------------------------------------------------

export const appointmentStatusValues = ["booked", "confirmed", "arrived", "no_show", "cancelled"] as const;
export type AppointmentStatus = (typeof appointmentStatusValues)[number];

/** Статуси, при които часът заема времето на бръснаря. Същият списък е в ограничението appointments_no_overlap. */
export const activeAppointmentStatuses = ["booked", "confirmed", "arrived"] as const satisfies readonly AppointmentStatus[];

export const appointmentStatus = pgEnum("appointment_status", appointmentStatusValues);
export const appointmentSource = pgEnum("appointment_source", ["web", "admin", "api"]);
export const cancelledByEnum = pgEnum("cancelled_by", ["customer", "admin"]);

export type AppointmentSource = (typeof appointmentSource.enumValues)[number];

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    barberId: uuid("barber_id")
      .notNull()
      .references(() => barbers.id, { onDelete: "restrict" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    startsAt: timestamptz("starts_at").notNull(),
    endsAt: timestamptz("ends_at").notNull(),
    status: appointmentStatus("status").notNull().default("booked"),

    customerName: text("customer_name").notNull(),
    /** Във формат E.164, напр. +359888123456. */
    customerPhone: text("customer_phone").notNull(),
    customerEmail: text("customer_email"),
    note: text("note"),

    // Стойностите на услугата към момента на записване.
    serviceName: text("service_name").notNull(),
    priceCents: integer("price_cents").notNull(),
    durationMin: integer("duration_min").notNull(),

    source: appointmentSource("source").notNull(),
    /** SHA-256 (hex) на токена от линка за отказ. Самият токен не се пази. */
    cancelTokenHash: text("cancel_token_hash").notNull().unique(),
    /** Ключ от хедъра Idempotency-Key (API), за да не се дублира час при повторна заявка. */
    idempotencyKey: text("idempotency_key").unique(),

    cancelledAt: timestamptz("cancelled_at"),
    cancelledBy: cancelledByEnum("cancelled_by"),
    ...timestamps,
  },
  (t) => [
    index("appointments_barber_starts_idx").on(t.barberId, t.startsAt),
    index("appointments_starts_idx").on(t.startsAt),
    index("appointments_phone_idx").on(t.customerPhone),
    check("appointments_range_check", sql`${t.startsAt} < ${t.endsAt}`),
    // Ограничението EXCLUDE срещу припокриване е в ръчната миграция 0001_appointments_no_overlap.sql.
  ],
);

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: timestamptz("window_start").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] }), index("rate_limits_window_idx").on(t.windowStart)],
);

export type Admin = typeof admins.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Barber = typeof barbers.$inferSelect;
export type WorkingHoursRow = typeof workingHours.$inferSelect;
export type TimeOffRow = typeof timeOff.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
