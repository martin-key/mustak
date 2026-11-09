import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { getDb } from "@/server/db/client";
import { json } from "@/server/http";

/** Проверка за Docker: приложението работи и вижда базата. */
export async function GET() {
  await connection(); // винаги при заявка, никога при build
  try {
    await getDb().execute(sql`select 1`);
    return json({ status: "ok" });
  } catch {
    return json({ status: "error", message: "Няма връзка с базата." }, { status: 503 });
  }
}
