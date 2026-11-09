/**
 * Общи схеми за валидация. Ползват се от формите в браузъра, Server Actions и API-то.
 */
import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import { z } from "zod";
import { isLocalDate, sofiaToUtc } from "./time";

/** Нормализира телефон до E.164 (+359...). Номерата без код на държава се приемат за български. */
export function normalizePhone(input: string): string | null {
  const parsed = parsePhoneNumberFromString(input.trim(), "BG");
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number;
}

export const phoneSchema = z
  .string({ error: "Въведете телефон." })
  .trim()
  .min(1, { error: "Въведете телефон." })
  .max(30, { error: "Невалиден телефонен номер." })
  .transform((value, ctx) => {
    const normalized = normalizePhone(value);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "Невалиден телефонен номер." });
      return z.NEVER;
    }
    return normalized;
  });

/** Имейл по желание: празен низ или липса → null. */
export const optionalEmailSchema = z
  .string()
  .trim()
  .max(200, { error: "Имейлът е твърде дълъг." })
  .optional()
  .nullable()
  .transform((value, ctx) => {
    if (!value) return null;
    if (!z.email().safeParse(value).success) {
      ctx.addIssue({ code: "custom", message: "Невалиден имейл адрес." });
      return z.NEVER;
    }
    return value.toLowerCase();
  });

export const customerNameSchema = z
  .string({ error: "Въведете име." })
  .trim()
  .min(2, { error: "Въведете име (поне 2 символа)." })
  .max(80, { error: "Името е твърде дълго." });

export const noteSchema = z
  .string()
  .trim()
  .max(500, { error: "Бележката е твърде дълга (най-много 500 символа)." })
  .optional()
  .nullable()
  .transform((value) => value || null);

export const customerSchema = z.object({
  name: customerNameSchema,
  phone: phoneSchema,
  email: optionalEmailSchema,
});

const LOCAL_DATETIME_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::00)?$/;

/**
 * Начален час: ISO 8601 с отместване ("2026-11-12T10:00:00+02:00" или "...Z")
 * или местно време в София без отместване ("2026-11-12T10:00").
 */
export const startSchema = z.string({ error: "Изберете час." }).transform((value, ctx) => {
  const local = LOCAL_DATETIME_RE.exec(value);
  if (local && isLocalDate(local[1])) return sofiaToUtc(local[1], local[2]);
  if (z.iso.datetime({ offset: true }).safeParse(value).success) return new Date(value);
  ctx.addIssue({ code: "custom", message: "Невалиден начален час." });
  return z.NEVER;
});

export const localDateSchema = z
  .string({ error: "Изберете дата." })
  .refine(isLocalDate, { error: "Невалидна дата (очаква се YYYY-MM-DD)." });

export const idSchema = (message: string) => z.uuid({ error: message });

/** Заявка за записване на час (сайт и API). */
export const bookingRequestSchema = z.object({
  serviceId: idSchema("Изберете услуга."),
  barberId: idSchema("Невалиден бръснар.").nullable().optional(),
  start: startSchema,
  customer: customerSchema,
  note: noteSchema,
});

export type BookingRequest = z.output<typeof bookingRequestSchema>;

export const availabilityQuerySchema = z.object({
  serviceId: idSchema("Изберете услуга."),
  barberId: idSchema("Невалиден бръснар.").nullable().optional(),
  date: localDateSchema,
});

/** Грешките от Zod като { "customer.phone": "съобщение" } (първата грешка за всяко поле). */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!(key in result)) result[key] = issue.message;
  }
  return result;
}
