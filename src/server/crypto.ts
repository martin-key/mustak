import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Случаен токен за URL или бисквитка (32 байта, base64url). */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** SHA-256 в hex. В базата пазим само хеша на токените, не самите токени. */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Сравнение с постоянно време (не издава колко символа съвпадат). */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}
