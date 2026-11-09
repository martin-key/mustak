import "server-only";
import { z } from "zod";
import { business } from "@/config/business";

/**
 * Чат с AI асистента (n8n). Браузърът говори само с нашия сървър (/api/chat), а сървърът
 * препраща съобщението към Chat Trigger-а на n8n. Така адресът и паролата на n8n не стигат
 * до браузъра, CSP остава `connect-src 'self'`, а чатът минава през нашите лимити.
 */

export type ChatConfig =
  | { status: "disabled" }
  | { status: "misconfigured"; reason: string }
  | { status: "enabled"; webhookUrl: string; authorization: string | null };

export function chatConfig(env: Record<string, string | undefined> = process.env): ChatConfig {
  const url = env.N8N_CHAT_WEBHOOK_URL?.trim() ?? "";
  const user = env.N8N_CHAT_USERNAME ?? "";
  const password = env.N8N_CHAT_PASSWORD ?? "";
  if (!url) return { status: "disabled" };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { status: "misconfigured", reason: "N8N_CHAT_WEBHOOK_URL не е валиден адрес." };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { status: "misconfigured", reason: "N8N_CHAT_WEBHOOK_URL трябва да започва с http:// или https://." };
  }
  if (Boolean(user) !== Boolean(password)) {
    return { status: "misconfigured", reason: "Задайте и N8N_CHAT_USERNAME, и N8N_CHAT_PASSWORD (или нито едно)." };
  }
  const authorization = user ? `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}` : null;
  return { status: "enabled", webhookUrl: parsed.toString(), authorization };
}

export function chatEnabled(): boolean {
  return chatConfig().status === "enabled";
}

/** Какво приемаме от widget-а. Файлове и история не се препращат. */
export const chatRequestSchema = z.object({
  action: z.literal("sendMessage"),
  sessionId: z.string().regex(/^[A-Za-z0-9-]{8,64}$/),
  chatInput: z.string().trim().min(1).max(1000),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export const CHAT_MESSAGES = {
  invalid: "Не разбрах съобщението. Напиши го отново (до 1000 знака).",
  rateLimited: "Пишеш ми твърде често. Изчакай малко и опитай пак.",
  unavailable: `Асистентът не е на линия в момента. Запази час от сайта или се обади на ${business.phone}.`,
} as const;

const UPSTREAM_TIMEOUT_MS = 90_000;

/**
 * Изпраща съобщението към n8n и връща отговора на агента.
 * При грешка връща null: тогава показваме CHAT_MESSAGES.unavailable.
 */
export async function forwardChatMessage(
  message: ChatRequest,
  config: Extract<ChatConfig, { status: "enabled" }>,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  try {
    const response = await fetchImpl(config.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(config.authorization ? { Authorization: config.authorization } : {}),
      },
      body: JSON.stringify({ action: message.action, sessionId: message.sessionId, chatInput: message.chatInput }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) {
      console.warn(`[chat] n8n върна ${response.status}`);
      return null;
    }
    return extractOutput(await response.json());
  } catch (error) {
    console.warn("[chat] n8n не отговори:", error instanceof Error ? error.message : error);
    return null;
  }
}

/** n8n връща { output } (AI Agent) или { text }; понякога като масив с един елемент. */
export function extractOutput(data: unknown): string | null {
  const item = Array.isArray(data) ? data[0] : data;
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const value = record.output ?? record.text;
  if (typeof value !== "string" || !value.trim()) return null;
  return value.slice(0, 8000);
}
