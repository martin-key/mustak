import { business } from "@/config/business";
import { toSofiaIso, toSofiaTime } from "@/lib/time";
import { availabilityQuerySchema, fieldErrors } from "@/lib/validation";
import { apiPrice, authorizeAgent } from "@/server/api/agent";
import { isBookingError } from "@/server/booking/errors";
import { getAvailability } from "@/server/booking/service";
import { getDb } from "@/server/db/client";
import { bookingErrorStatus, errorJson, json } from "@/server/http";

/** GET /api/v1/availability?serviceId=…&date=YYYY-MM-DD[&barberId=…]: свободните часове за деня. */
export async function GET(request: Request) {
  const auth = await authorizeAgent(request);
  if (!auth.ok) return auth.response;

  const params = new URL(request.url).searchParams;
  const parsed = availabilityQuerySchema.safeParse({
    serviceId: params.get("serviceId"),
    barberId: params.get("barberId") || null,
    date: params.get("date"),
  });
  if (!parsed.success) {
    return errorJson(422, "VALIDATION_ERROR", "Невалидни параметри.", { details: fieldErrors(parsed.error) });
  }

  try {
    const result = await getAvailability(getDb(), parsed.data);
    const names = new Map(result.barbers.map((b) => [b.id, b.name]));
    return json({
      date: result.date,
      timezone: business.timezone,
      service: {
        id: result.service.id,
        name: result.service.name,
        durationMinutes: result.service.durationMin,
        ...apiPrice(result.service.priceCents),
      },
      barberId: parsed.data.barberId ?? null,
      slots: result.slots.map((slot) => ({
        start: toSofiaIso(slot.start),
        end: toSofiaIso(slot.end),
        time: toSofiaTime(slot.start),
        barbers: slot.barberIds.map((id) => ({ id, name: names.get(id) ?? "" })),
      })),
    });
  } catch (error) {
    if (isBookingError(error)) return errorJson(bookingErrorStatus[error.code], error.code, error.message);
    throw error;
  }
}
