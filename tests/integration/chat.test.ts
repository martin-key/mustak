import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as postChat } from "@/app/api/public/chat/route";
import { RATE_LIMITS } from "@/server/rate-limit";
import { closeTestDb, resetDb, testDb } from "./helpers";

const db = testDb();
const WEBHOOK = "https://n8n.mustak.test/webhook/abc/chat";

beforeEach(async () => {
  await resetDb(db);
  process.env.N8N_CHAT_WEBHOOK_URL = WEBHOOK;
  process.env.N8N_CHAT_USERNAME = "mustak-chat";
  process.env.N8N_CHAT_PASSWORD = "chat-password";
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.N8N_CHAT_WEBHOOK_URL;
  delete process.env.N8N_CHAT_USERNAME;
  delete process.env.N8N_CHAT_PASSWORD;
});
afterAll(() => closeTestDb());

function chatRequest(body: unknown, { ip = "198.51.100.20", origin }: { ip?: string; origin?: string } = {}) {
  const headers = new Headers({ "content-type": "application/json", "x-forwarded-for": ip });
  if (origin) headers.set("origin", origin);
  return new Request("http://localhost:3000/api/public/chat", { method: "POST", headers, body: JSON.stringify(body) });
}

const message = { action: "sendMessage", sessionId: "3f0b8c1a-2222-4333-8444-955566667777", chatInput: "Имате ли час утре?" };

describe("чат асистент през /api/public/chat", () => {
  it("препраща съобщението към n8n с Basic Auth и връща отговора", async () => {
    const fetchMock = vi.fn(async () => Response.json({ output: "Утре има свободно в 11:00." }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await postChat(chatRequest(message, { origin: "http://localhost:3000" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ output: "Утре има свободно в 11:00." });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(WEBHOOK);
    expect(new Headers(init.headers).get("authorization")).toBe(`Basic ${Buffer.from("mustak-chat:chat-password").toString("base64")}`);
  });

  it("е изключен без N8N_CHAT_WEBHOOK_URL и не вика n8n", async () => {
    delete process.env.N8N_CHAT_WEBHOOK_URL;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await postChat(chatRequest(message));
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("отказва заявки от чужд сайт и невалидни съобщения", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await postChat(chatRequest(message, { origin: "https://evil.example" }))).status).toBe(403);
    expect((await postChat(chatRequest({ ...message, chatInput: "" }))).status).toBe(400);
    expect((await postChat(chatRequest({ ...message, action: "loadPreviousSession" }))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("показва приятно съобщение, ако n8n не отговори", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Internal error", { status: 500 })));
    const response = await postChat(chatRequest(message));
    expect(response.status).toBe(502);
    expect((await response.json()).output).toContain("не е на линия");
  });

  it("спира твърде много съобщения от един IP", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ output: "ок" })));
    const ip = "198.51.100.99";
    let limited: Response | null = null;
    for (let i = 0; i <= RATE_LIMITS.chatPerIp.limit + 5 && !limited; i++) {
      const response = await postChat(chatRequest(message, { ip }));
      if (response.status === 429) limited = response;
    }
    expect(limited?.status).toBe(429);
    expect(limited?.headers.get("retry-after")).toBeTruthy();
    // Друг IP не е засегнат.
    expect((await postChat(chatRequest(message, { ip: "198.51.100.100" }))).status).toBe(200);
  });
});
