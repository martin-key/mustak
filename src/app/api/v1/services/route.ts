import { apiPrice, authorizeAgent } from "@/server/api/agent";
import { listActiveServices } from "@/server/booking/catalog";
import { getDb } from "@/server/db/client";
import { json } from "@/server/http";

/** GET /api/v1/services: активните услуги с цени и продължителност. */
export async function GET(request: Request) {
  const auth = await authorizeAgent(request);
  if (!auth.ok) return auth.response;

  const services = await listActiveServices(getDb());
  return json({
    services: services.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      durationMinutes: s.durationMin,
      ...apiPrice(s.priceCents),
    })),
  });
}
