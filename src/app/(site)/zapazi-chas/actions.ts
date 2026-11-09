"use server";

import { headers } from "next/headers";
import { bookingRequestSchema, fieldErrors } from "@/lib/validation";
import { isBookingError } from "@/server/booking/errors";
import { createBooking } from "@/server/booking/service";
import { getDb } from "@/server/db/client";
import { clientIp, rateLimit, RATE_LIMITS } from "@/server/rate-limit";
import { TURNSTILE_MESSAGES, verifyTurnstile } from "@/server/turnstile";

export interface BookingPayload {
  serviceId: string;
  barberId: string | null;
  start: string;
  customer: { name: string; phone: string; email: string };
  note: string;
  /** Скрито поле срещу ботове: хората не го виждат и го оставят празно. */
  website: string;
  /** Токен от Cloudflare Turnstile (празен, ако защитата е изключена). */
  turnstileToken: string;
}

export type BookingActionResult =
  | { ok: true; token: string }
  | { ok: false; code: string; message: string; fieldErrors?: Record<string, string> };

export async function createBookingAction(payload: BookingPayload): Promise<BookingActionResult> {
  if (payload?.website) {
    return { ok: false, code: "REJECTED", message: "Записването не беше прието." };
  }

  const db = getDb();
  const ip = clientIp(await headers());
  const perIp = await rateLimit(db, `public-booking:${ip}`, RATE_LIMITS.publicBookingPerIp);
  const global = await rateLimit(db, "public-booking:global", RATE_LIMITS.publicBookingGlobal);
  if (!perIp.ok || !global.ok) {
    return {
      ok: false,
      code: "RATE_LIMITED",
      message: "Твърде много опити за записване. Опитайте отново след няколко минути или се обадете в салона.",
    };
  }

  const parsed = bookingRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Проверете попълнените данни.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  // Проверка „Не съм робот“ (Cloudflare Turnstile), ако е включена. Само след валидацията,
  // за да не се вика Cloudflare за заявки, които така или иначе се отказват.
  const human = await verifyTurnstile(payload.turnstileToken, ip);
  if (!human.ok) {
    return { ok: false, code: "BOT_CHECK_FAILED", message: TURNSTILE_MESSAGES[human.reason] };
  }

  try {
    const { cancelToken } = await createBooking(db, { ...parsed.data, source: "web" });
    return { ok: true, token: cancelToken! };
  } catch (error) {
    if (isBookingError(error)) return { ok: false, code: error.code, message: error.message };
    console.error("[booking] Неочаквана грешка при записване:", error);
    return { ok: false, code: "INTERNAL", message: "Нещо се обърка. Опитайте отново или се обадете в салона." };
  }
}
