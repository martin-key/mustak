import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { listActiveBarbers, listActiveServices } from "@/server/booking/catalog";
import { customerCancelCheck, getBookingByToken } from "@/server/booking/service";
import { getDb } from "@/server/db/client";

/**
 * Данни за публичния сайт. connection() казва на Next.js, че данните идват при заявка
 * (не при build) и винаги са актуални след промяна в админ панела.
 */
export const getPublicCatalog = cache(async () => {
  await connection();
  const db = getDb();
  const [services, barbers] = await Promise.all([listActiveServices(db), listActiveBarbers(db)]);
  return { services, barbers };
});

/** Данните за страницата на часа (линка за отказ), с изчислено дали може да се откаже. */
export async function getBookingPage(token: string) {
  await connection();
  const booking = await getBookingByToken(getDb(), token);
  if (!booking) return null;
  const now = new Date();
  return {
    booking,
    cancelCheck: customerCancelCheck(booking, now),
    isPast: booking.endsAt.getTime() < now.getTime(),
  };
}
