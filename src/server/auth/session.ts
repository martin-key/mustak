import "server-only";
import { and, eq, gt, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { cache } from "react";
import { generateToken, sha256 } from "@/server/crypto";
import { getDb } from "@/server/db/client";
import { admins, sessions } from "@/server/db/schema";
import { SESSION_COOKIE, SESSION_DAYS } from "./constants";

export interface CurrentAdmin {
  id: string;
  email: string;
  name: string;
}

/** Secure само при https: иначе браузърът не би приел бисквитката при достъп по http в локалната мрежа. */
function secureCookies(): boolean {
  return (process.env.APP_URL ?? "").startsWith("https://");
}

/** Нова сесия: случаен токен в httpOnly бисквитка, в базата само неговият хеш. */
export async function createSession(adminId: string): Promise<void> {
  const db = getDb();
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(sessions).values({ id: sha256(token), adminId, expiresAt });
  // Чистим изтеклите сесии от време на време.
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await getDb().delete(sessions).where(eq(sessions.id, sha256(token)));
  jar.delete(SESSION_COOKIE);
}

/** Текущият администратор или null. Кешира се за една заявка. */
export const getCurrentAdmin = cache(async (): Promise<CurrentAdmin | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  // Проверката зависи от текущия час, затова винаги е при заявка (никога в prerender).
  await connection();
  const [row] = await getDb()
    .select({ id: admins.id, email: admins.email, name: admins.name })
    .from(sessions)
    .innerJoin(admins, eq(admins.id, sessions.adminId))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, new Date())));
  return row ?? null;
});

/**
 * Задължително в началото на всяка админ страница, заявка и Server Action.
 * proxy.ts пренасочва само по наличието на бисквитка; истинската проверка е тук.
 */
export async function requireAdmin(): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
