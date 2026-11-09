"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { bookingRequestSchema, fieldErrors } from "@/lib/validation";
import { toSofiaDate } from "@/lib/time";
import { requireAdmin } from "@/server/auth/session";
import { isBookingError } from "@/server/booking/errors";
import { createBooking, setAppointmentStatus } from "@/server/booking/service";
import { getDb } from "@/server/db/client";
import { appointmentStatusValues } from "@/server/db/schema";

export type ActionResult = { ok: true } | { ok: false; message: string };

const statusSchema = z.object({
  id: z.uuid(),
  status: z.enum(appointmentStatusValues),
});

export async function setStatusAction(id: string, status: string): Promise<ActionResult> {
  await requireAdmin();
  const parsed = statusSchema.safeParse({ id, status });
  if (!parsed.success) return { ok: false, message: "Невалиден статус." };
  try {
    await setAppointmentStatus(getDb(), parsed.data.id, parsed.data.status);
  } catch (error) {
    if (isBookingError(error)) return { ok: false, message: error.message };
    throw error;
  }
  refresh();
  return { ok: true };
}

const adminBookingSchema = bookingRequestSchema.extend({
  status: z.enum(["booked", "confirmed"]),
  /** Час извън свободните (напр. клиент без час): проверява се само за припокриване. */
  outsideAvailability: z.boolean(),
});

export type AdminBookingResult =
  | { ok: true; token: string; date: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

export async function adminCreateBookingAction(payload: unknown): Promise<AdminBookingResult> {
  await requireAdmin();
  const parsed = adminBookingSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, message: "Проверете попълнените данни.", fieldErrors: fieldErrors(parsed.error) };
  }
  const { outsideAvailability, ...input } = parsed.data;
  try {
    const { appointment, cancelToken } = await createBooking(getDb(), {
      ...input,
      source: "admin",
      skipAvailabilityCheck: outsideAvailability,
    });
    refresh();
    return { ok: true, token: cancelToken!, date: toSofiaDate(appointment.startsAt) };
  } catch (error) {
    if (isBookingError(error)) {
      const message =
        error.code === "SLOT_UNAVAILABLE"
          ? "В това време бръснарят вече има час (или не работи). Изберете друг час или друг бръснар."
          : error.message;
      return { ok: false, message };
    }
    throw error;
  }
}
