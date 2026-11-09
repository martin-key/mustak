/** Кодове на грешки от PostgreSQL, които обработваме. */
export const PG_EXCLUSION_VIOLATION = "23P01";
export const PG_UNIQUE_VIOLATION = "23505";

interface PgLikeError {
  code?: string;
  constraint?: string;
  cause?: unknown;
}

/** Намира грешката от драйвера `pg` (Drizzle я обвива в DrizzleQueryError с `cause`). */
function findPgError(error: unknown): PgLikeError | null {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current && typeof current === "object"; depth++) {
    const candidate = current as PgLikeError;
    if (typeof candidate.code === "string" && /^[0-9A-Z]{5}$/.test(candidate.code)) return candidate;
    current = candidate.cause;
  }
  return null;
}

export function pgErrorCode(error: unknown): string | null {
  return findPgError(error)?.code ?? null;
}

export function pgConstraint(error: unknown): string | null {
  return findPgError(error)?.constraint ?? null;
}

export function isOverlapViolation(error: unknown): boolean {
  return pgErrorCode(error) === PG_EXCLUSION_VIOLATION;
}
