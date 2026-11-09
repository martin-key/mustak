import "server-only";
import { connection } from "next/server";
import { centsToDecimal } from "@/lib/format";
import { toSofiaDate, toSofiaIso, toSofiaTime } from "@/lib/time";
import { business } from "@/config/business";
import type { BookingView } from "@/server/booking/service";
import { safeEqual, sha256 } from "@/server/crypto";
import { getDb } from "@/server/db/client";
import { errorJson, tooManyRequests } from "@/server/http";
import { clientIp, rateLimit, RATE_LIMITS } from "@/server/rate-limit";

const MIN_KEY_LENGTH = 32;

export type AgentAuth = { ok: true; keyId: string } | { ok: false; response: Response };

/**
 * Проверка за всеки API endpoint: лимит на IP, таен ключ в хедъра X-API-Key, лимит на ключ.
 * Ключът се сравнява с постоянно време. Ако AGENT_API_KEY не е зададен, API-то е изключено.
 */
export async function authorizeAgent(request: Request): Promise<AgentAuth> {
  await connection(); // API-то винаги работи при заявка, никога при build
  const db = getDb();
  const ip = clientIp(request.headers);
  const perIp = await rateLimit(db, `api:ip:${ip}`, RATE_LIMITS.apiPerIp);
  if (!perIp.ok) return { ok: false, response: tooManyRequests(perIp.retryAfterSeconds) };

  const configured = process.env.AGENT_API_KEY ?? "";
  if (configured.length < MIN_KEY_LENGTH) {
    if (configured) console.warn(`[api] AGENT_API_KEY е по-къс от ${MIN_KEY_LENGTH} символа, API-то е изключено.`);
    return { ok: false, response: errorJson(503, "API_DISABLED", "API-то не е включено на този сървър.") };
  }

  const provided = request.headers.get("x-api-key") ?? "";
  if (!provided || !safeEqual(provided, configured)) {
    return {
      ok: false,
      response: errorJson(401, "UNAUTHORIZED", "Липсва или е невалиден API ключ (хедър X-API-Key).", {
        headers: { "WWW-Authenticate": 'ApiKey header="X-API-Key"' },
      }),
    };
  }

  const keyId = sha256(configured).slice(0, 16);
  const perKey = await rateLimit(db, `api:key:${keyId}`, RATE_LIMITS.apiPerKey);
  if (!perKey.ok) return { ok: false, response: tooManyRequests(perKey.retryAfterSeconds) };
  return { ok: true, keyId };
}

export function apiPrice(cents: number) {
  return { price: centsToDecimal(cents), priceCents: cents, currency: business.currency };
}

/** Публичният адрес за линка за отказ. */
export function publicBaseUrl(request: Request): string {
  return (process.env.APP_URL || new URL(request.url).origin).replace(/\/+$/, "");
}

export function bookingJson(booking: BookingView, extra: { serviceId: string; cancelUrl: string | null }) {
  return {
    id: booking.id,
    status: booking.status,
    start: toSofiaIso(booking.startsAt),
    end: toSofiaIso(booking.endsAt),
    date: toSofiaDate(booking.startsAt),
    time: toSofiaTime(booking.startsAt),
    timezone: business.timezone,
    service: {
      id: extra.serviceId,
      name: booking.serviceName,
      durationMinutes: booking.durationMin,
      ...apiPrice(booking.priceCents),
    },
    barber: { id: booking.barberId, name: booking.barberName },
    customer: { name: booking.customerName, phone: booking.customerPhone, email: booking.customerEmail },
    note: booking.note,
    cancelUrl: extra.cancelUrl,
  };
}
