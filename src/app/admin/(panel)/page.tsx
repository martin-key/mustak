import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  AppointmentCard,
  DayNav,
  hoursText,
  ScheduleSkeleton,
  Stat,
  timeOffOn,
} from "@/components/admin/schedule";
import { buttonClass } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import { addDays, formatDateLong, isLocalDate, todayInSofia } from "@/lib/time";
import { requireAdmin } from "@/server/auth/session";
import { getSchedule } from "@/server/booking/schedule";
import { getDb } from "@/server/db/client";
import { activeAppointmentStatuses } from "@/server/db/schema";

export const metadata: Metadata = { title: "Днес" };

export default function TodayPage({ searchParams }: PageProps<"/admin">) {
  return (
    <Suspense fallback={<ScheduleSkeleton />}>
      <DayView searchParams={searchParams} />
    </Suspense>
  );
}

async function DayView({ searchParams }: Pick<PageProps<"/admin">, "searchParams">) {
  await requireAdmin();
  const params = await searchParams;
  const today = todayInSofia();
  const date = typeof params.date === "string" && isLocalDate(params.date) ? params.date : today;
  const schedule = await getSchedule(getDb(), date, date);

  const active = schedule.appointments.filter((a) =>
    (activeAppointmentStatuses as readonly string[]).includes(a.status),
  );
  const revenue = active.reduce((sum, a) => sum + a.priceCents, 0);
  const arrived = schedule.appointments.filter((a) => a.status === "arrived").length;

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl text-cream md:text-4xl">{date === today ? "Днес" : formatDateLong(date)}</h1>
          <p className="mt-1 text-cream-muted">{formatDateLong(date, { withYear: true })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DayNav
            basePath="/admin"
            date={date}
            prev={addDays(date, -1)}
            next={addDays(date, 1)}
            today={today}
            todayLabel="Днес"
          />
          <Link href={`/admin/appointments/new?date=${date}`} className={buttonClass({ size: "sm" })}>
            Нов час
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3 md:max-w-xl">
        <Stat label="Активни часове" value={active.length} />
        <Stat label="Дошли" value={arrived} />
        <Stat label="Очакван оборот" value={formatPrice(revenue)} />
      </div>

      {schedule.barbers.length === 0 ? (
        <p className="mt-10 text-cream-muted">
          Няма бръснари. <Link href="/admin/barbers/new" className="text-gold">Добави бръснар</Link>.
        </p>
      ) : (
        <div
          className="-mx-5 mt-8 flex snap-x gap-4 overflow-x-auto px-5 pb-4 lg:mx-0 lg:grid lg:overflow-visible lg:px-0"
          style={{ gridTemplateColumns: `repeat(${schedule.barbers.length}, minmax(0, 1fr))` }}
        >
          {schedule.barbers.map((barber) => {
            const list = schedule.appointments.filter((a) => a.barberId === barber.id);
            const hours = hoursText(barber, date);
            const off = timeOffOn(barber, date);
            return (
              <section
                key={barber.id}
                aria-label={barber.name}
                className="w-[85vw] max-w-sm shrink-0 snap-start rounded-xl border border-line bg-bottle-900/50 p-4 lg:w-auto lg:max-w-none"
              >
                <header className="mb-4 border-b border-line pb-3">
                  <h2 className="font-display text-xl text-cream">{barber.name}</h2>
                  <p className="text-sm text-cream-faint">
                    {off ? `Почивка: ${off.reason || "почивен ден"}` : (hours ?? "Не работи днес")}
                    {!barber.isActive && ", неактивен"}
                  </p>
                </header>
                {list.length === 0 ? (
                  <p className="text-sm text-cream-faint">Няма записани часове.</p>
                ) : (
                  <div className="space-y-3">
                    {list.map((a) => (
                      <AppointmentCard key={a.id} appointment={a} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
