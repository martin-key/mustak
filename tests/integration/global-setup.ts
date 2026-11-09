import path from "node:path";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { TestProject } from "vitest/node";
import { runMigrations } from "../../src/server/db/migrate";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

/**
 * Вдига истински PostgreSQL в Docker (Testcontainers) и прилага миграциите.
 * Ако е зададен TEST_DATABASE_URL, ползва тази база (напр. в CI без Docker). Тя се изчиства от тестовете!
 */
export default async function setup(project: TestProject) {
  let container: StartedPostgreSqlContainer | undefined;
  let url = process.env.TEST_DATABASE_URL;
  if (!url) {
    container = await new PostgreSqlContainer("postgres:18-alpine").start();
    url = container.getConnectionUri();
  }
  await runMigrations(url, path.resolve(import.meta.dirname, "../../drizzle"));
  project.provide("databaseUrl", url);

  return async () => {
    await container?.stop();
  };
}
