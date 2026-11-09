import { inject, vi } from "vitest";

// Кодът на приложението (getDb, API ключа) чете тези променливи.
process.env.DATABASE_URL = inject("databaseUrl");
process.env.AGENT_API_KEY = "test-agent-key-0123456789abcdef0123456789abcdef";
process.env.APP_URL = "https://mustak.test";

// Route handler-ите се викат директно, без Next.js сървър: connection() няма какво да чака.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));
