import type { BookingErrorCode } from "@/server/booking/errors";

const noStore = { "Cache-Control": "no-store" };

export function json(data: unknown, init: { status?: number; headers?: Record<string, string> } = {}): Response {
  return Response.json(data, { status: init.status ?? 200, headers: { ...noStore, ...init.headers } });
}

export function errorJson(
  status: number,
  code: string,
  message: string,
  extra: { details?: unknown; headers?: Record<string, string> } = {},
): Response {
  return json(
    { error: { code, message, ...(extra.details !== undefined ? { details: extra.details } : {}) } },
    { status, headers: extra.headers },
  );
}

export function tooManyRequests(retryAfterSeconds: number): Response {
  return errorJson(429, "RATE_LIMITED", "Твърде много заявки. Опитайте отново по-късно.", {
    headers: { "Retry-After": String(retryAfterSeconds) },
  });
}

/** HTTP статус за всяка бизнес грешка. */
export const bookingErrorStatus: Record<BookingErrorCode, number> = {
  SERVICE_NOT_FOUND: 404,
  BARBER_NOT_FOUND: 404,
  DATE_OUT_OF_RANGE: 422,
  SLOT_UNAVAILABLE: 409,
  TOO_MANY_BOOKINGS: 409,
  NOT_FOUND: 404,
  ALREADY_CANCELLED: 409,
  NOT_CANCELLABLE: 409,
  TOO_LATE_TO_CANCEL: 409,
};
