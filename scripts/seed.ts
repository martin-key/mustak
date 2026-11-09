import { createDb } from "../src/server/db/create";
import { seed } from "../src/server/db/seed";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[seed] Липсва DATABASE_URL.");
  process.exit(1);
}

const { db, pool } = createDb(url, { max: 1 });

seed(db, {
  adminEmail: process.env.ADMIN_EMAIL,
  adminPassword: process.env.ADMIN_PASSWORD,
  adminName: process.env.ADMIN_NAME,
  demoData: process.env.SEED_DEMO_DATA === "true",
})
  .then(() => console.log("[seed] Готово."))
  .catch((error) => {
    console.error("[seed] Грешка:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
