import { lt, sql } from "drizzle-orm";
import type { DbLike } from "./db/create";
import { rateLimits } from "./db/schema";
import { sha256 } from "./crypto";

export interface RateLimitRule {
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/** Лимитите на едно място. */
export const RATE_LIMITS = {
  /** Свободни часове от публичния сайт, на IP. */
  publicAvailability: { limit: 60, windowSeconds: 60 },
  /** Записвания от публичната форма, на IP. */
  publicBookingPerIp: { limit: 5, windowSeconds: 600 },
  /** Записвания от публичната форма общо (защита, ако IP-тата се подменят). */
  publicBookingGlobal: { limit: 60, windowSeconds: 3600 },
  /** Откази през линка, на IP. */
  publicCancelPerIp: { limit: 10, windowSeconds: 600 },
  /** Опити за вход, на IP + имейл. */
  loginPerIpAndEmail: { limit: 5, windowSeconds: 900 },
  /** Опити за вход, на IP. */
  loginPerIp: { limit: 20, windowSeconds: 900 },
  /** Всички заявки към API-то, на IP (преди проверката на ключа). */
  apiPerIp: { limit: 120, windowSeconds: 60 },
  /** Заявки с валиден ключ. */
  apiPerKey: { limit: 60, windowSeconds: 60 },
  /** Записвания през API-то. */
  apiBookingPerKey: { limit: 10, windowSeconds: 60 },
} satisfies Record<string, RateLimitRule>;

/**
 * Брояч с фиксиран прозорец в Postgres: работи и при няколко инстанции на приложението.
 * Ключът се пази като хеш (в него има IP адреси).
 */
export async function rateLimit(
  db: DbLike,
  key: string,
  rule: RateLimitRule,
  now: Date = new Date(),
): Promise<RateLimitResult> {
  const windowMs = rule.windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);

  const [row] = await db
    .insert(rateLimits)
    .values({ key: sha256(key), windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.key, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count });

  // Понякога чистим старите броячи.
  if (Math.random() < 0.01) {
    await db.delete(rateLimits).where(lt(rateLimits.windowStart, new Date(now.getTime() - 86_400_000)));
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((windowStart.getTime() + windowMs - now.getTime()) / 1000));
  return { ok: row.count <= rule.limit, remaining: Math.max(0, rule.limit - row.count), retryAfterSeconds };
}

/**
 * IP адресът на клиента. Взимаме най-десния адрес от X-Forwarded-For: това е адресът,
 * който е видял последният прокси (или самият Next.js, ако няма прокси).
 * В продукция приложението трябва да стои зад reverse proxy, който задава този хедър.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}
