// Пакетира скриптовете за миграции и начални данни в самостоятелни .mjs файлове за Docker образа,
// за да не трябват drizzle-kit, tsx и изходният код в крайния образ.
import { build } from "esbuild";

await build({
  entryPoints: { migrate: "scripts/migrate.ts", seed: "scripts/seed.ts", "admin-password": "scripts/admin-password.ts" },
  outdir: "dist-scripts",
  outExtension: { ".js": ".mjs" },
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  tsconfig: "tsconfig.json",
  // Нативният модул идва от node_modules на standalone изхода на Next.js.
  external: ["@node-rs/argon2", "pg-native"],
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
  logLevel: "info",
});
