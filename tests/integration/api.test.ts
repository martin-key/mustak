import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { GET as getAvailability } from "@/app/api/v1/availability/route";
import { GET as getBarbers } from "@/app/api/v1/barbers/route";
import { POST as postBooking } from "@/app/api/v1/bookings/route";
import { GET as getServices } from "@/app/api/v1/services/route";
import { GET as getPublicAvailability } from "@/app/api/public/availability/route";
import { appointments, services } from "@/server/db/schema";
import { closeTestDb, createFixture, futureDate, resetDb, testDb, uniquePhone } from "./helpers";

const db = testDb();
const KEY = process.env.AGENT_API_KEY!;

beforeEach(() => resetDb(db));
afterAll(() => closeTestDb());

function req(path: string, init: RequestInit & { key?: string | null } = {}) {
  const headers = new Headers(init.headers);
  const key = init.key === undefined ? KEY : init.key;
  if (key) headers.set("x-api-key", key);
  headers.set("x-forwarded-for", "203.0.113.7");
  return new Request(`http://localhost:3000${path}`, { ...init, headers });
}

function bookingBody(serviceId: string, start: string, extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    serviceId,
    start,
    customer: { name: "Клиент от агента", phone: uniquePhone() },
    ...extra,
  });
}

describe("API ключ", () => {
  it("връща 401 без ключ и с грешен ключ", async () => {
    const missing = await getServices(req("/api/v1/services", { key: null }));
    expect(missing.status).toBe(401);
    expect((await missing.json()).error.code).toBe("UNAUTHORIZED");

    const wrong = await getServices(req("/api/v1/services", { key: "x".repeat(48) }));
    expect(wrong.status).toBe(401);

    const booking = await postBooking(req("/api/v1/bookings", { key: null, method: "POST", body: "{}" }));
    expect(booking.status).toBe(401);
  });

  it("връща 503, ако ключът не е настроен на сървъра", async () => {
    const saved = process.env.AGENT_API_KEY;
    process.env.AGENT_API_KEY = "";
    try {
      const res = await getServices(req("/api/v1/services"));
      expect(res.status).toBe(503);
    } finally {
      process.env.AGENT_API_KEY = saved;
    }
  });
});

describe("API за AI агента", () => {
  it("дава активните услуги с цени и бръснарите", async () => {
    const { service } = await createFixture(db);
    await db.insert(services).values({ name: "Стара услуга", priceCents: 1000, durationMin: 30, isActive: false });

    const res = await getServices(req("/api/v1/services"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.services).toEqual([
      {
        id: service.id,
        name: "Подстригване",
        description: "",
        durationMinutes: 30,
        price: "25.00",
        priceCents: 2500,
        currency: "EUR",
      },
    ]);

    const barbers = await (await getBarbers(req("/api/v1/barbers"))).json();
    expect(barbers.barbers).toHaveLength(1);
    expect(barbers.barbers[0].workingWeekdays).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("дава свободните часове и записва час само веднъж", async () => {
    const { service, barbers } = await createFixture(db);
    const date = futureDate();

    const avail = await getAvailability(req(`/api/v1/availability?serviceId=${service.id}&date=${date}`));
    expect(avail.status).toBe(200);
    const slots = (await avail.json()).slots;
    expect(slots[0]).toMatchObject({ time: "09:00", barbers: [{ id: barbers[0].id, name: "Бръснар 1" }] });
    expect(slots[0].start).toMatch(new RegExp(`^${date}T09:00:00\\+0[23]:00$`));

    const created = await postBooking(req("/api/v1/bookings", { method: "POST", body: bookingBody(service.id, `${date}T10:00`) }));
    expect(created.status).toBe(201);
    const booking = (await created.json()).booking;
    expect(booking).toMatchObject({
      status: "booked",
      date,
      time: "10:00",
      barber: { id: barbers[0].id },
      service: { id: service.id, price: "25.00" },
    });
    expect(booking.cancelUrl).toMatch(/^https:\/\/mustak\.test\/chas\/[\w-]{43}$/);

    const [row] = await db.select().from(appointments).where(eq(appointments.id, booking.id));
    expect(row.source).toBe("api");

    const again = await postBooking(req("/api/v1/bookings", { method: "POST", body: bookingBody(service.id, `${date}T10:00`) }));
    expect(again.status).toBe(409);
    expect((await again.json()).error.code).toBe("SLOT_UNAVAILABLE");

    const after = await (await getAvailability(req(`/api/v1/availability?serviceId=${service.id}&date=${date}`))).json();
    expect(after.slots.map((s: { time: string }) => s.time)).not.toContain("10:00");
  });

  it("повторна заявка със същия Idempotency-Key не създава втори час", async () => {
    const { service } = await createFixture(db);
    const body = bookingBody(service.id, `${futureDate()}T11:00`);
    const headers = { "content-type": "application/json", "idempotency-key": "n8n-run-42" };

    const first = await postBooking(req("/api/v1/bookings", { method: "POST", body, headers }));
    const second = await postBooking(req("/api/v1/bookings", { method: "POST", body, headers }));
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    const [a, b] = [await first.json(), await second.json()];
    expect(b.replayed).toBe(true);
    expect(b.booking.id).toBe(a.booking.id);
    expect(await db.select().from(appointments)).toHaveLength(1);
  });

  it("връща ясни грешки при невалидни данни", async () => {
    const { service } = await createFixture(db);

    const badJson = await postBooking(req("/api/v1/bookings", { method: "POST", body: "не е json" }));
    expect(badJson.status).toBe(400);

    const invalid = await postBooking(
      req("/api/v1/bookings", {
        method: "POST",
        body: JSON.stringify({ serviceId: service.id, start: "утре", customer: { name: "А", phone: "1" } }),
      }),
    );
    expect(invalid.status).toBe(422);
    expect((await invalid.json()).error.details).toMatchObject({
      start: expect.any(String),
      "customer.name": expect.any(String),
      "customer.phone": expect.any(String),
    });

    const badQuery = await getAvailability(req(`/api/v1/availability?serviceId=${service.id}&date=12.11.2026`));
    expect(badQuery.status).toBe(422);

    const unknown = await getAvailability(
      req(`/api/v1/availability?serviceId=00000000-0000-4000-8000-000000000000&date=${futureDate()}`),
    );
    expect(unknown.status).toBe(404);
  });
});

describe("публичен endpoint за свободни часове", () => {
  it("работи без ключ и има лимит на IP", async () => {
    const { service } = await createFixture(db);
    const url = `/api/public/availability?serviceId=${service.id}&date=${futureDate()}`;
    const ok = await getPublicAvailability(req(url, { key: null }));
    expect(ok.status).toBe(200);

    // Прозорецът е фиксиран (60 s): ако минутата се смени по време на цикъла, броячът започва отначало.
    let last = ok;
    for (let i = 0; i < 125 && last.status !== 429; i++) last = await getPublicAvailability(req(url, { key: null }));
    expect(last.status).toBe(429);
    expect(last.headers.get("retry-after")).toBeTruthy();
  });
});
