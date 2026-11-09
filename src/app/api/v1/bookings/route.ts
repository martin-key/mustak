import { bookingRequestSchema, fieldErrors } from "@/lib/validation";
import { authorizeAgent, bookingJson, publicBaseUrl } from "@/server/api/agent";
import { isBookingError } from "@/server/booking/errors";
import { createBooking, getBookingById } from "@/server/booking/service";
import { getDb } from "@/server/db/client";
import { bookingErrorStatus, errorJson, json, tooManyRequests } from "@/server/http";
import { rateLimit, RATE_LIMITS } from "@/server/rate-limit";

const IDEMPOTENCY_KEY_RE = /^[\x21-\x7e]{1,200}$/;

/**
 * POST /api/v1/bookings: записва час. Ползва същата логика като сайта.
 * Без barberId системата избира свободен бръснар. Хедърът Idempotency-Key пази от двойно записване при повторен опит.
 */
export async function POST(request: Request) {
  const auth = await authorizeAgent(request);
  if (!auth.ok) return auth.response;

  const db = getDb();
  const limit = await rateLimit(db, `api:booking:${auth.keyId}`, RATE_LIMITS.apiBookingPerKey);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  const idempotencyHeader = request.headers.get("idempotency-key");
  if (idempotencyHeader !== null && !IDEMPOTENCY_KEY_RE.test(idempotencyHeader)) {
    return errorJson(422, "VALIDATION_ERROR", "Idempotency-Key трябва да е до 200 видими ASCII символа.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorJson(400, "INVALID_JSON", "Тялото на заявката трябва да е валиден JSON.");
  }

  const parsed = bookingRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorJson(422, "VALIDATION_ERROR", "Невалидни данни за записване.", { details: fieldErrors(parsed.error) });
  }

  try {
    const result = await createBooking(db, {
      ...parsed.data,
      source: "api",
      idempotencyKey: idempotencyHeader ? `api:${auth.keyId}:${idempotencyHeader}` : null,
    });
    const view = await getBookingById(db, result.appointment.id);
    const cancelUrl = result.cancelToken ? `${publicBaseUrl(request)}/chas/${result.cancelToken}` : null;
    return json(
      { booking: bookingJson(view!, { serviceId: result.appointment.serviceId, cancelUrl }), replayed: result.replayed },
      { status: result.replayed ? 200 : 201 },
    );
  } catch (error) {
    if (isBookingError(error)) return errorJson(bookingErrorStatus[error.code], error.code, error.message);
    throw error;
  }
}
