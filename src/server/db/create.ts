import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

/** Създава връзка към базата. Ползва се от приложението, скриптовете и тестовете. */
export function createDb(connectionString: string, options: { max?: number } = {}) {
  const pool = new Pool({ connectionString, max: options.max ?? 10 });
  const db = drizzle({ client: pool, schema });
  return { db, pool };
}

/** Транзакция, отворена с db.transaction(...). */
export type DbTx = Parameters<Parameters<Db["transaction"]>[0]>[0];
/** Функциите, които може да се викат и в транзакция, приемат и двете. */
export type DbLike = Db | DbTx;
