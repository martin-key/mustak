"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { isBookingError } from "@/server/booking/errors";
import { cancelBookingByToken } from "@/server/booking/service";
import { getDb } from "@/server/db/client";
import { clientIp, rateLimit, RATE_LIMITS } from "@/server/rate-limit";

export type CancelResult = { ok: true } | { ok: false; message: string };

/** Отказ от клиента през уникалния линк. POST (Server Action), за да не го задейства преглед на линка. */
export async function cancelBookingAction(token: string): Promise<CancelResult> {
  const db = getDb();
  const limit = await rateLimit(db, `public-cancel:${clientIp(await headers())}`, RATE_LIMITS.publicCancelPerIp);
  if (!limit.ok) return { ok: false, message: "Твърде много опити. Опитайте отново след няколко минути." };

  try {
    await cancelBookingByToken(db, String(token));
  } catch (error) {
    if (isBookingError(error)) return { ok: false, message: error.message };
    console.error("[booking] Неочаквана грешка при отказ:", error);
    return { ok: false, message: "Нещо се обърка. Опитайте отново или се обадете в салона." };
  }
  refresh();
  return { ok: true };
}
