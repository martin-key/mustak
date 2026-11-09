import "server-only";
import { TURNSTILE_ACTION } from "@/lib/turnstile";

/**
 * Защита от ботове при записване: Cloudflare Turnstile.
 *
 * По избор: включва се само ако са зададени TURNSTILE_SITE_KEY и TURNSTILE_SECRET.
 * Без тях записването работи както преди (самостоятелен сървър без Cloudflare).
 * Токенът от браузъра се проверява тук, на сървъра, срещу siteverify на Cloudflare.
 * Токените са за еднократна употреба: повторно подаване на същия токен се отказва.
 */

export { TURNSTILE_ACTION };
const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Публичните тестови secret-и на Cloudflare. Отговорите за тях нямат action и имат hostname "example.com". */
const TEST_SECRETS = new Set([
  "1x0000000000000000000000000000000AA",
  "2x0000000000000000000000000000000AA",
  "3x0000000000000000000000000000000AA",
]);

export type TurnstileConfig =
  | { status: "disabled" }
  | { status: "misconfigured"; reason: string }
  | { status: "enabled"; siteKey: string; secret: string; hostnames: Set<string> };

function hostFromUrl(url: string | undefined): string {
  try {
    return url ? new URL(url).hostname : "";
  } catch {
    return "";
  }
}

export function turnstileConfig(env: Record<string, string | undefined> = process.env): TurnstileConfig {
  const siteKey = env.TURNSTILE_SITE_KEY?.trim() ?? "";
  const secret = env.TURNSTILE_SECRET?.trim() ?? "";
  if (!siteKey && !secret) return { status: "disabled" };
  if (!siteKey || !secret) {
    return { status: "misconfigured", reason: "Задайте и TURNSTILE_SITE_KEY, и TURNSTILE_SECRET (или нито едното)." };
  }
  // Разрешените адреси на сайта (hostname от отговора на Cloudflare). По подразбиране: адресът от APP_URL.
  const raw = env.TURNSTILE_HOSTNAMES?.trim() || hostFromUrl(env.APP_URL);
  const hostnames = new Set(
    raw
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean),
  );
  if (hostnames.size === 0 && !TEST_SECRETS.has(secret)) {
    return { status: "misconfigured", reason: "Задайте TURNSTILE_HOSTNAMES или APP_URL." };
  }
  return { status: "enabled", siteKey, secret, hostnames };
}

/** Публичният ключ за браузъра или null, ако защитата е изключена. */
export function turnstileSiteKey(): string | null {
  const config = turnstileConfig();
  return config.status === "enabled" ? config.siteKey : null;
}

export type TurnstileResult =
  | { ok: true }
  | { ok: false; reason: "missing-token" | "invalid" | "unavailable" | "misconfigured" };

interface SiteverifyResponse {
  success?: boolean;
  action?: string;
  hostname?: string;
  "error-codes"?: string[];
  metadata?: { result_with_testing_key?: boolean };
}

/** Проверява токена от браузъра. При изключена защита винаги е успешна; при грешка отказва (fail closed). */
export async function verifyTurnstile(
  token: unknown,
  remoteIp: string | null,
  config: TurnstileConfig = turnstileConfig(),
  fetchImpl: typeof fetch = fetch,
): Promise<TurnstileResult> {
  if (config.status === "disabled") return { ok: true };
  if (config.status === "misconfigured") {
    console.error(`[turnstile] Грешна настройка: ${config.reason}`);
    return { ok: false, reason: "misconfigured" };
  }
  if (typeof token !== "string" || token.length === 0 || token.length > 2048) {
    return { ok: false, reason: "missing-token" };
  }

  const body = new URLSearchParams({ secret: config.secret, response: token });
  if (remoteIp && remoteIp !== "unknown") body.set("remoteip", remoteIp);

  let result: SiteverifyResponse;
  try {
    const res = await fetchImpl(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`siteverify HTTP ${res.status}`);
    result = (await res.json()) as SiteverifyResponse;
  } catch (error) {
    console.error("[turnstile] Няма връзка със siteverify:", error instanceof Error ? error.message : error);
    return { ok: false, reason: "unavailable" };
  }

  if (result.success !== true) return { ok: false, reason: "invalid" };

  // Тестов ключ, настроен изрично от собственика (локална разработка): няма action и реален hostname.
  if (TEST_SECRETS.has(config.secret) && result.metadata?.result_with_testing_key === true) {
    return { ok: true };
  }

  if (result.action !== TURNSTILE_ACTION || !config.hostnames.has(String(result.hostname ?? "").toLowerCase())) {
    return { ok: false, reason: "invalid" };
  }
  return { ok: true };
}

export const TURNSTILE_MESSAGES: Record<Exclude<TurnstileResult, { ok: true }>["reason"], string> = {
  "missing-token": "Изчакайте проверката „Не съм робот“ да завърши и опитайте отново.",
  invalid: "Проверката „Не съм робот“ не беше успешна. Опитайте отново.",
  unavailable: "Проверката срещу ботове не отговаря. Опитайте след малко или се обадете в салона.",
  misconfigured: "Онлайн записването временно не работи. Моля, обадете се в салона.",
};
