import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminBookingForm } from "@/components/admin/admin-booking-form";
import { isLocalDate, todayInSofia } from "@/lib/time";
import { requireAdmin } from "@/server/auth/session";
import { listActiveServices } from "@/server/booking/catalog";
import { listBarberOptions } from "@/server/booking/schedule";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = { title: "Нов час" };

export default function NewAppointmentPage({ searchParams }: PageProps<"/admin/appointments/new">) {
  return (
    <div>
      <h1 className="font-display text-3xl text-cream md:text-4xl">Нов час</h1>
      <p className="mt-1 text-cream-muted">За клиенти, които се обаждат по телефона или идват без час.</p>
      <div className="mt-8">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-bottle-900" />}>
          <FormLoader searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function FormLoader({ searchParams }: Pick<PageProps<"/admin/appointments/new">, "searchParams">) {
  await requireAdmin();
  const params = await searchParams;
  const db = getDb();
  const [services, barbers] = await Promise.all([listActiveServices(db), listBarberOptions(db)]);
  const initialDate = typeof params.date === "string" && isLocalDate(params.date) ? params.date : todayInSofia();
  if (services.length === 0 || barbers.length === 0) {
    return <p className="text-cream-muted">Първо добавете поне една активна услуга и един бръснар.</p>;
  }
  return <AdminBookingForm services={services} barbers={barbers} initialDate={initialDate} />;
}
