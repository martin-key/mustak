import { describe, expect, it, vi } from "vitest";
import { chatConfig, chatRequestSchema, extractOutput, forwardChatMessage, type ChatConfig } from "@/server/chat";

const ENABLED: Extract<ChatConfig, { status: "enabled" }> = {
  status: "enabled",
  webhookUrl: "https://n8n.mustak.example/webhook/abc/chat",
  authorization: "Basic dXNlcjpwYXNz",
};
const MESSAGE = { action: "sendMessage" as const, sessionId: "0b7c2f3e-1111-4222-8333-944455556666", chatInput: "Здрасти" };

describe("настройка на чата", () => {
  it("е изключен без адрес и грешен при невалиден адрес или само потребител", () => {
    expect(chatConfig({}).status).toBe("disabled");
    expect(chatConfig({ N8N_CHAT_WEBHOOK_URL: "не е адрес" }).status).toBe("misconfigured");
    expect(chatConfig({ N8N_CHAT_WEBHOOK_URL: "ftp://n8n/chat" }).status).toBe("misconfigured");
    expect(chatConfig({ N8N_CHAT_WEBHOOK_URL: "https://n8n/chat", N8N_CHAT_USERNAME: "u" }).status).toBe("misconfigured");
  });

  it("сглобява Basic Auth хедъра от потребител и парола", () => {
    const config = chatConfig({ N8N_CHAT_WEBHOOK_URL: "https://n8n/chat", N8N_CHAT_USERNAME: "user", N8N_CHAT_PASSWORD: "pass" });
    expect(config).toEqual({ status: "enabled", webhookUrl: "https://n8n/chat", authorization: "Basic dXNlcjpwYXNz" });
    expect(chatConfig({ N8N_CHAT_WEBHOOK_URL: "https://n8n/chat" })).toMatchObject({ authorization: null });
  });
});

describe("заявка от widget-а", () => {
  it("приема само съобщение с нормална сесия и текст до 1000 знака", () => {
    expect(chatRequestSchema.safeParse(MESSAGE).success).toBe(true);
    expect(chatRequestSchema.safeParse({ ...MESSAGE, action: "loadPreviousSession" }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ ...MESSAGE, sessionId: "../../x" }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ ...MESSAGE, chatInput: "   " }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ ...MESSAGE, chatInput: "я".repeat(1001) }).success).toBe(false);
  });
});

describe("препращане към n8n", () => {
  it("праща само action, sessionId и chatInput с Basic Auth и връща output", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ output: "Имаме свободен час в 10:00." }));
    const output = await forwardChatMessage(MESSAGE, ENABLED, fetchImpl as unknown as typeof fetch);
    expect(output).toBe("Имаме свободен час в 10:00.");

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(ENABLED.webhookUrl);
    expect(new Headers(init.headers).get("authorization")).toBe("Basic dXNlcjpwYXNz");
    expect(JSON.parse(init.body as string)).toEqual(MESSAGE);
  });

  it("връща null при грешка от n8n, лош отговор или липсваща връзка", async () => {
    const status500 = vi.fn(async () => new Response("boom", { status: 500 }));
    expect(await forwardChatMessage(MESSAGE, ENABLED, status500 as unknown as typeof fetch)).toBeNull();
    const notJson = vi.fn(async () => new Response("<html>", { status: 200 }));
    expect(await forwardChatMessage(MESSAGE, ENABLED, notJson as unknown as typeof fetch)).toBeNull();
    const offline = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await forwardChatMessage(MESSAGE, ENABLED, offline as unknown as typeof fetch)).toBeNull();
  });

  it("разчита output, text и масив с един елемент", () => {
    expect(extractOutput({ output: "а" })).toBe("а");
    expect(extractOutput({ text: "б" })).toBe("б");
    expect(extractOutput([{ output: "в" }])).toBe("в");
    expect(extractOutput({ output: "" })).toBeNull();
    expect(extractOutput("низ")).toBeNull();
  });
});

describe("markdown в отговорите на асистента", async () => {
  const { parseChatMarkdown, parseInline, safeHref } = await import("@/lib/chat-markdown");

  it("разпознава удебелено, линкове и голи адреси", () => {
    expect(parseInline("Записах те за **петък 10:00**. [Откажи](https://mustak.example/chas/abc)")).toEqual([
      { type: "text", text: "Записах те за " },
      { type: "bold", text: "петък 10:00" },
      { type: "text", text: ". " },
      { type: "link", text: "Откажи", href: "https://mustak.example/chas/abc" },
    ]);
    expect(parseInline("Линк: https://mustak.example/chas/abc.")).toEqual([
      { type: "text", text: "Линк: " },
      { type: "link", text: "https://mustak.example/chas/abc", href: "https://mustak.example/chas/abc" },
      { type: "text", text: "." },
    ]);
  });

  it("не пуска опасни линкове и не прави HTML", () => {
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("//evil.example")).toBeNull();
    expect(safeHref("/zapazi-chas")).toBe("/zapazi-chas");
    expect(parseInline("[натисни](javascript:alert(1))")[0]).toEqual({ type: "text", text: "натисни" });
    expect(parseInline("<img src=x onerror=alert(1)>")).toEqual([{ type: "text", text: "<img src=x onerror=alert(1)>" }]);
  });

  it("разделя абзаци и списъци", () => {
    const blocks = parseChatMarkdown("Имаме:\n- Подстригване – 25 €\n- Брада – 15 €\n\nКое избираш?");
    expect(blocks.map((b) => b.type)).toEqual(["paragraph", "list", "paragraph"]);
    expect(blocks[1]).toMatchObject({ type: "list", ordered: false, items: [[{ text: "Подстригване – 25 €" }], [{ text: "Брада – 15 €" }]] });
    expect(parseChatMarkdown("1. едно\n2. две")[0]).toMatchObject({ type: "list", ordered: true });
  });
});
