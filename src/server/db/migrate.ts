import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";

// Произволно, но постоянно число: само един процес прилага миграциите в даден момент.
const MIGRATION_LOCK_ID = 727_274_001;

async function connectWithRetry(connectionString: string, attempts = 30): Promise<Client> {
  for (let attempt = 1; ; attempt++) {
    const client = new Client({ connectionString });
    try {
      await client.connect();
      return client;
    } catch (error) {
      await client.end().catch(() => {});
      if (attempt >= attempts) throw error;
      console.log(`[migrate] Базата още не е готова (опит ${attempt}/${attempts}), чакам...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

export async function runMigrations(connectionString: string, migrationsFolder: string): Promise<void> {
  const client = await connectWithRetry(connectionString);
  try {
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_ID]);
    await migrate(drizzle({ client }), { migrationsFolder });
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_ID]).catch(() => {});
    await client.end();
  }
}
