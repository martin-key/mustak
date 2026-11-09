import { asc, eq } from "drizzle-orm";
import type { DbLike } from "@/server/db/create";
import { barbers, services, workingHours } from "@/server/db/schema";

export interface PublicService {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  durationMin: number;
}

export interface PublicBarber {
  id: string;
  name: string;
  bio: string;
  photoUrl: string | null;
  /** Дни от седмицата (1–7), в които бръснарят работи. */
  workingWeekdays: number[];
}

export async function listActiveServices(db: DbLike): Promise<PublicService[]> {
  return db
    .select({
      id: services.id,
      name: services.name,
      description: services.description,
      priceCents: services.priceCents,
      durationMin: services.durationMin,
    })
    .from(services)
    .where(eq(services.isActive, true))
    .orderBy(asc(services.sortOrder), asc(services.name));
}

export async function listActiveBarbers(db: DbLike): Promise<PublicBarber[]> {
  const [rows, hours] = await Promise.all([
    db
      .select({ id: barbers.id, name: barbers.name, bio: barbers.bio, photoUrl: barbers.photoUrl })
      .from(barbers)
      .where(eq(barbers.isActive, true))
      .orderBy(asc(barbers.sortOrder), asc(barbers.name)),
    db.select({ barberId: workingHours.barberId, weekday: workingHours.weekday }).from(workingHours),
  ]);
  return rows.map((barber) => ({
    ...barber,
    workingWeekdays: [...new Set(hours.filter((h) => h.barberId === barber.id).map((h) => h.weekday))].sort(),
  }));
}
