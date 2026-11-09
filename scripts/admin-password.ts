/**
 * Задава парола на администратор (или създава нов), напр. при забравена парола.
 * Чете ADMIN_EMAIL, ADMIN_PASSWORD и ADMIN_NAME от средата. Изтрива всички сесии на този администратор.
 *
 *   npm run admin:password                                   (локално, с .env)
 *   docker compose run --rm --entrypoint node app scripts/admin-password.mjs  (в Docker)
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import { hashPassword, MIN_PASSWORD_LENGTH } from "../src/server/auth/password";
import { createDb } from "../src/server/db/create";
import { admins, sessions } from "../src/server/db/schema";

async function main() {
  const url = process.env.DATABASE_URL;
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!url) throw new Error("Липсва DATABASE_URL.");
  if (!z.email().safeParse(email).success) throw new Error("ADMIN_EMAIL не е валиден имейл.");
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`ADMIN_PASSWORD трябва да е поне ${MIN_PASSWORD_LENGTH} символа.`);
  }

  const { db, pool } = createDb(url, { max: 1 });
  try {
    const passwordHash = await hashPassword(password);
    const [existing] = await db.select({ id: admins.id }).from(admins).where(eq(admins.email, email));
    if (existing) {
      await db.update(admins).set({ passwordHash }).where(eq(admins.id, existing.id));
      await db.delete(sessions).where(eq(sessions.adminId, existing.id));
      console.log(`[admin] Паролата на ${email} е сменена. Старите сесии са прекратени.`);
    } else {
      await db.insert(admins).values({ email, passwordHash, name: process.env.ADMIN_NAME?.trim() || "Администратор" });
      console.log(`[admin] Създаден е администратор ${email}.`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[admin] Грешка:", error instanceof Error ? error.message : error);
  process.exit(1);
});
