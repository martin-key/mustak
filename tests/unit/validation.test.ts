import { describe, expect, it } from "vitest";
import { bookingRequestSchema, fieldErrors, normalizePhone } from "@/lib/validation";

describe("телефонни номера", () => {
  it("нормализира българските номера до +359", () => {
    expect(normalizePhone("0888 123 456")).toBe("+359888123456");
    expect(normalizePhone("+359 88 812 3456")).toBe("+359888123456");
    expect(normalizePhone("00359888123456")).toBe("+359888123456");
  });

  it("приема чужди номера с код на държава", () => {
    expect(normalizePhone("+44 20 7946 0958")).toBe("+442079460958");
  });

  it("отказва невалидни номера", () => {
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("абв")).toBeNull();
  });
});

describe("заявка за записване", () => {
  const base = {
    serviceId: "8a0d7c9e-3b8f-4c1e-9a2b-1f2e3d4c5b6a",
    start: "2026-11-12T10:00",
    customer: { name: "  Петър  ", phone: "0888123456", email: "" },
  };

  it("приема местен час в София и нормализира данните", () => {
    const result = bookingRequestSchema.parse(base);
    expect(result.start.toISOString()).toBe("2026-11-12T08:00:00.000Z");
    expect(result.customer).toEqual({ name: "Петър", phone: "+359888123456", email: null });
    expect(result.note).toBeNull();
  });

  it("приема ISO час с отместване", () => {
    const result = bookingRequestSchema.parse({ ...base, start: "2026-11-12T10:00:00+02:00" });
    expect(result.start.toISOString()).toBe("2026-11-12T08:00:00.000Z");
  });

  it("връща грешките на български по полета", () => {
    const result = bookingRequestSchema.safeParse({
      ...base,
      start: "утре",
      customer: { name: "П", phone: "12", email: "не-е-имейл" },
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(fieldErrors(result.error)).toEqual({
      start: "Невалиден начален час.",
      "customer.name": "Въведете име (поне 2 символа).",
      "customer.phone": "Невалиден телефонен номер.",
      "customer.email": "Невалиден имейл адрес.",
    });
  });
});
