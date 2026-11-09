"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fieldErrors } from "@/lib/validation";
import { requireAdmin } from "@/server/auth/session";
import {
  addTimeOff,
  barberInputSchema,
  createBarber,
  createService,
  deleteBarber,
  deleteService,
  deleteTimeOff,
  ManageError,
  replaceWorkingHours,
  serviceInputSchema,
  timeOffInputSchema,
  updateBarber,
  updateService,
  workingHoursInputSchema,
} from "@/server/booking/manage";
import { getDb } from "@/server/db/client";

export interface FormState {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
  values?: Record<string, string>;
}

const idSchema = z.uuid();

function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$")) values[key] = value;
  }
  return values;
}

function assertId(id: string | null): string | null {
  if (id === null) return null;
  if (!idSchema.safeParse(id).success) throw new Error("Невалиден идентификатор.");
  return id;
}

// --- Услуги -------------------------------------------------------------------------------------

export async function saveServiceAction(id: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const serviceId = assertId(id);
  const values = formValues(formData);
  const parsed = serviceInputSchema.safeParse(values);
  if (!parsed.success) return { message: "Проверете полетата.", errors: fieldErrors(parsed.error), values };

  const db = getDb();
  if (serviceId) await updateService(db, serviceId, parsed.data);
  else await createService(db, parsed.data);
  redirect("/admin/services");
}

export async function deleteServiceAction(id: string): Promise<FormState> {
  await requireAdmin();
  try {
    await deleteService(getDb(), assertId(id)!);
  } catch (error) {
    if (error instanceof ManageError) return { message: error.message };
    throw error;
  }
  redirect("/admin/services");
}

// --- Бръснари -----------------------------------------------------------------------------------

export async function saveBarberAction(id: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const barberId = assertId(id);
  const values = formValues(formData);
  const parsed = barberInputSchema.safeParse(values);
  if (!parsed.success) return { message: "Проверете полетата.", errors: fieldErrors(parsed.error), values };

  const db = getDb();
  if (!barberId) {
    const barber = await createBarber(db, parsed.data);
    redirect(`/admin/barbers/${barber.id}?nov=1`);
  }
  await updateBarber(db, barberId, parsed.data);
  refresh();
  return { ok: true, message: "Профилът е запазен.", values };
}

export async function deleteBarberAction(id: string): Promise<FormState> {
  await requireAdmin();
  try {
    await deleteBarber(getDb(), assertId(id)!);
  } catch (error) {
    if (error instanceof ManageError) return { message: error.message };
    throw error;
  }
  redirect("/admin/barbers");
}

export async function saveWorkingHoursAction(barberId: string, rows: unknown): Promise<FormState> {
  await requireAdmin();
  const parsed = workingHoursInputSchema.safeParse(rows);
  if (!parsed.success) {
    return { message: parsed.error.issues[0]?.message ?? "Невалидно работно време.", errors: fieldErrors(parsed.error) };
  }
  await replaceWorkingHours(getDb(), assertId(barberId)!, parsed.data);
  refresh();
  return { ok: true, message: "Работното време е запазено. Вече записаните часове не се променят." };
}

export async function addTimeOffAction(barberId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const values = formValues(formData);
  const parsed = timeOffInputSchema.safeParse(values);
  if (!parsed.success) return { message: "Проверете полетата.", errors: fieldErrors(parsed.error), values };

  const overlapping = await addTimeOff(getDb(), assertId(barberId)!, parsed.data);
  refresh();
  return {
    ok: true,
    message:
      overlapping > 0
        ? `Почивката е добавена. Внимание: ${overlapping} вече записани часа попадат в нея. Обадете се на клиентите или ги откажете от графика.`
        : "Почивката е добавена.",
  };
}

export async function deleteTimeOffAction(barberId: string, id: string): Promise<void> {
  await requireAdmin();
  await deleteTimeOff(getDb(), assertId(barberId)!, assertId(id)!);
  refresh();
}
