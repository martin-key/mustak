import path from "node:path";
import { runMigrations } from "../src/server/db/migrate";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[migrate] Липсва DATABASE_URL.");
  process.exit(1);
}

const folder = process.env.MIGRATIONS_DIR ?? path.join(process.cwd(), "drizzle");

runMigrations(url, folder)
  .then(() => console.log("[migrate] Миграциите са приложени."))
  .catch((error) => {
    console.error("[migrate] Грешка:", error);
    process.exit(1);
  });
