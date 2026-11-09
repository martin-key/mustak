import { describe, expect, it, vi } from "vitest";
import { turnstileConfig, verifyTurnstile, type TurnstileConfig } from "@/server/turnstile";

const REAL: TurnstileConfig = {
  status: "enabled",
  siteKey: "0x4AAAAAAA-real-site-key",
  secret: "0x4AAAAAAA-real-secret",
  hostnames: new Set(["mustak.example"]),
};

function fakeFetch(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

describe("настройка на Turnstile", () => {
  it("е изключена без ключове и грешна само с единия", () => {
    expect(turnstileConfig({}).status).toBe("disabled");
    expect(turnstileConfig({ TURNSTILE_SITE_KEY: "x" }).status).toBe("misconfigured");
    expect(turnstileConfig({ TURNSTILE_SECRET: "y" }).status).toBe("misconfigured");
  });

  it("взима разрешения адрес от TURNSTILE_HOSTNAMES или от APP_URL", () => {
    const fromList = turnstileConfig({ TURNSTILE_SITE_KEY: "a", TURNSTILE_SECRET: "b", TURNSTILE_HOSTNAMES: "Mustak.example, www.mustak.example" });
    expect(fromList.status === "enabled" && [...fromList.hostnames]).toEqual(["mustak.example", "www.mustak.example"]);
    const fromUrl = turnstileConfig({ TURNSTILE_SITE_KEY: "a", TURNSTILE_SECRET: "b", APP_URL: "https://mustak.example" });
    expect(fromUrl.status === "enabled" && [...fromUrl.hostnames]).toEqual(["mustak.example"]);
    expect(turnstileConfig({ TURNSTILE_SITE_KEY: "a", TURNSTILE_SECRET: "b" }).status).toBe("misconfigured");
  });
});

describe("проверка на токена", () => {
  it("пропуска всичко, когато защитата е изключена", async () => {
    expect(await verifyTurnstile(undefined, null, { status: "disabled" })).toEqual({ ok: true });
  });

  it("отказва при грешна настройка или липсващ токен, без да вика Cloudflare", async () => {
    const fetchImpl = fakeFetch({ success: true });
    expect(await verifyTurnstile("t", null, { status: "misconfigured", reason: "x" }, fetchImpl)).toMatchObject({ ok: false, reason: "misconfigured" });
    expect(await verifyTurnstile("", null, REAL, fetchImpl)).toMatchObject({ ok: false, reason: "missing-token" });
    expect(await verifyTurnstile(42, null, REAL, fetchImpl)).toMatchObject({ ok: false, reason: "missing-token" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("приема само success с очаквания action и hostname", async () => {
    const ok = { success: true, action: "booking", hostname: "mustak.example" };
    expect(await verifyTurnstile("t", "203.0.113.7", REAL, fakeFetch(ok))).toEqual({ ok: true });
    expect(await verifyTurnstile("t", null, REAL, fakeFetch({ ...ok, action: "login" }))).toMatchObject({ reason: "invalid" });
    expect(await verifyTurnstile("t", null, REAL, fakeFetch({ ...ok, hostname: "evil.example" }))).toMatchObject({ reason: "invalid" });
    expect(await verifyTurnstile("t", null, REAL, fakeFetch({ success: false, "error-codes": ["timeout-or-duplicate"] }))).toMatchObject({ reason: "invalid" });
  });

  it("изпраща secret, токена и IP адреса на клиента", async () => {
    const fetchImpl = fakeFetch({ success: true, action: "booking", hostname: "mustak.example" });
    await verifyTurnstile("token-123", "203.0.113.7", REAL, fetchImpl);
    const [url, init] = (fetchImpl as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    const body = new URLSearchParams(String(init.body));
    expect(Object.fromEntries(body)).toEqual({ secret: REAL.secret, response: "token-123", remoteip: "203.0.113.7" });
  });

  it("отказва, ако Cloudflare не отговаря (fail closed)", async () => {
    const down = vi.fn(async () => {
      throw new Error("ECONNRESET");
    }) as unknown as typeof fetch;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await verifyTurnstile("t", null, REAL, down)).toMatchObject({ reason: "unavailable" });
    expect(await verifyTurnstile("t", null, REAL, fakeFetch({}, 500))).toMatchObject({ reason: "unavailable" });
    spy.mockRestore();
  });

  it("приема отговор от тестов ключ само когато е настроен тестов secret", async () => {
    const testResponse = { success: true, hostname: "example.com", metadata: { result_with_testing_key: true } };
    const testConfig: TurnstileConfig = { ...REAL, secret: "1x0000000000000000000000000000000AA" };
    expect(await verifyTurnstile("t", null, testConfig, fakeFetch(testResponse))).toEqual({ ok: true });
    expect(await verifyTurnstile("t", null, REAL, fakeFetch(testResponse))).toMatchObject({ reason: "invalid" });
  });
});
