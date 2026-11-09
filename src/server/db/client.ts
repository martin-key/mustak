import "server-only";
import { createDb, type Db } from "./create";

export type { Db } from "./create";

// Една връзка за целия процес (и при презареждане на модулите в dev).
const globalForDb = globalThis as unknown as { __mustakDb?: ReturnType<typeof createDb> };

/** Връзката се създава при първата заявка, а не при import (по време на build няма база). */
export function getDb(): Db {
  if (!globalForDb.__mustakDb) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("Липсва DATABASE_URL. Задайте го в .env (виж .env.example).");
    }
    globalForDb.__mustakDb = createDb(url);
  }
  return globalForDb.__mustakDb.db;
}
