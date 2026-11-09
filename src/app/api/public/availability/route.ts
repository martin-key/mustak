import { toSofiaIso, toSofiaTime } from "@/lib/time";
import { availabilityQuerySchema, fieldErrors } from "@/lib/validation";
import { isBookingError } from "@/server/booking/errors";
import { getAvailability } from "@/server/booking/service";
import { getDb } from "@/server/db/client";
import { bookingErrorStatus, errorJson, json, tooManyRequests } from "@/server/http";
import { clientIp, rateLimit, RATE_LIMITS } from "@/server/rate-limit";

/** Свободни часове за формата за записване на сайта. */
export async function GET(request: Request) {
  const db = getDb();
  const limit = await rateLimit(db, `public-availability:${clientIp(request.headers)}`, RATE_LIMITS.publicAvailability);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  const params = new URL(request.url).searchParams;
  const parsed = availabilityQuerySchema.safeParse({
    serviceId: params.get("serviceId"),
    barberId: params.get("barberId") || null,
    date: params.get("date"),
  });
  if (!parsed.success) {
    return errorJson(400, "VALIDATION_ERROR", "Невалидна заявка.", { details: fieldErrors(parsed.error) });
  }

  try {
    const result = await getAvailability(db, parsed.data);
    return json({
      date: result.date,
      slots: result.slots.map((slot) => ({
        start: toSofiaIso(slot.start),
        time: toSofiaTime(slot.start),
        barberIds: slot.barberIds,
      })),
    });
  } catch (error) {
    if (isBookingError(error)) return errorJson(bookingErrorStatus[error.code], error.code, error.message);
    throw error;
  }
}
