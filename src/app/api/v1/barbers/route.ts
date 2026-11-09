import { authorizeAgent } from "@/server/api/agent";
import { listActiveBarbers } from "@/server/booking/catalog";
import { getDb } from "@/server/db/client";
import { json } from "@/server/http";

/** GET /api/v1/barbers: активните бръснари и дните, в които работят (1 = понеделник … 7 = неделя). */
export async function GET(request: Request) {
  const auth = await authorizeAgent(request);
  if (!auth.ok) return auth.response;

  const barbers = await listActiveBarbers(getDb());
  return json({
    barbers: barbers.map((b) => ({ id: b.id, name: b.name, bio: b.bio, workingWeekdays: b.workingWeekdays })),
  });
}
