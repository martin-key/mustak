-- Ръчна миграция: Drizzle не описва EXCLUDE ограничения в схемата.
--
-- Гаранция на ниво база: два активни часа на един и същ бръснар не могат да се припокриват,
-- независимо от кода, който пише в базата, и дори при едновременни заявки.
-- '[)' означава, че краят не е включен: 10:00–10:30 и 10:30–11:00 не се припокриват.
-- Отказаните (cancelled) и неявилите се (no_show) часове не заемат времето.
-- Списъкът със статуси трябва да съвпада с activeAppointmentStatuses в src/server/db/schema.ts.

CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_no_overlap"
  EXCLUDE USING gist (
    "barber_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  )
  WHERE ("status" IN ('booked', 'confirmed', 'arrived'));
