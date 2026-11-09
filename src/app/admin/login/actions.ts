"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession, destroySession } from "@/server/auth/session";
import { generateToken } from "@/server/crypto";
import { getDb } from "@/server/db/client";
import { admins } from "@/server/db/schema";
import { clientIp, rateLimit, RATE_LIMITS } from "@/server/rate-limit";

export interface LoginState {
  error?: string;
  email?: string;
}

// Хеш за сравнение, когато имейлът не съществува: отговорът отнема същото време.
let dummyHash: Promise<string> | undefined;

/** Пренасочване след вход само към админ страници (без отворени пренасочвания към други сайтове). */
function safeNext(next: string): string {
  return /^\/admin(\/[\w\-/]*)?(\?[\w\-=&%.]*)?$/.test(next) && next !== "/admin/login" ? next : "/admin";
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase()
    .slice(0, 200);
  const password = String(formData.get("password") ?? "").slice(0, 200);
  const next = String(formData.get("next") ?? "");

  const db = getDb();
  const ip = clientIp(await headers());
  const perIp = await rateLimit(db, `login:ip:${ip}`, RATE_LIMITS.loginPerIp);
  const perEmail = await rateLimit(db, `login:${ip}:${email}`, RATE_LIMITS.loginPerIpAndEmail);
  if (!perIp.ok || !perEmail.ok) {
    return { error: "Твърде много неуспешни опити. Опитайте отново след 15 минути.", email };
  }

  if (!email || !password) return { error: "Въведете имейл и парола.", email };

  const [admin] = await db.select().from(admins).where(eq(admins.email, email));
  if (!admin) {
    dummyHash ??= hashPassword(generateToken());
    await verifyPassword(await dummyHash, password);
    return { error: "Грешен имейл или парола.", email };
  }
  if (!(await verifyPassword(admin.passwordHash, password))) {
    return { error: "Грешен имейл или парола.", email };
  }

  await createSession(admin.id);
  await db.update(admins).set({ lastLoginAt: new Date() }).where(eq(admins.id, admin.id));
  redirect(safeNext(next));
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/admin/login");
}
