import { connection } from "next/server";
import { CHAT_MESSAGES, chatConfig, chatRequestSchema, forwardChatMessage } from "@/server/chat";
import { getDb } from "@/server/db/client";
import { json } from "@/server/http";
import { clientIp, rateLimit, RATE_LIMITS } from "@/server/rate-limit";

const MAX_BODY_BYTES = 8 * 1024;

/**
 * POST /api/public/chat: съобщение от чат балончето на сайта към AI асистента в n8n.
 * Отговорът винаги е { output }, защото widget-ът показва точно него (и при грешка).
 */
export async function POST(request: Request) {
  await connection();
  const config = chatConfig();
  if (config.status !== "enabled") {
    if (config.status === "misconfigured") console.warn(`[chat] ${config.reason}`);
    return json({ output: CHAT_MESSAGES.unavailable }, { status: 404 });
  }

  // Само от нашия сайт: чужди страници не могат да ползват асистента през браузъра на посетителя.
  if (!fromOurSite(request)) return json({ output: CHAT_MESSAGES.unavailable }, { status: 403 });

  const db = getDb();
  const ip = clientIp(request.headers);
  const [perIp, global] = await Promise.all([
    rateLimit(db, `chat:ip:${ip}`, RATE_LIMITS.chatPerIp),
    rateLimit(db, "chat:global", RATE_LIMITS.chatGlobal),
  ]);
  if (!perIp.ok || !global.ok) {
    const retryAfter = Math.max(perIp.ok ? 0 : perIp.retryAfterSeconds, global.ok ? 0 : global.retryAfterSeconds);
    return json({ output: CHAT_MESSAGES.rateLimited }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
  }

  const raw = await request.text();
  let body: unknown = null;
  if (raw.length <= MAX_BODY_BYTES) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = null;
    }
  }
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) return json({ output: CHAT_MESSAGES.invalid }, { status: 400 });

  const output = await forwardChatMessage(parsed.data, config);
  if (output === null) return json({ output: CHAT_MESSAGES.unavailable }, { status: 502 });
  return json({ output });
}

/** Заявка без Origin (curl, сървър) минава; с Origin трябва да е нашият адрес. */
function fromOurSite(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const host = new URL(origin).host;
    const appHost = process.env.APP_URL ? new URL(process.env.APP_URL).host : null;
    return host === new URL(request.url).host || host === request.headers.get("host") || host === appHost;
  } catch {
    return false;
  }
}
