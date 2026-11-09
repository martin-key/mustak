import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AppointmentLine, DayNav, hoursText, ScheduleSkeleton, timeOffOn } from "@/components/admin/schedule";
import {
  addDays,
  formatDateLong,
  formatDayMonth,
  isLocalDate,
  startOfIsoWeek,
  todayInSofia,
  toSofiaDate,
} from "@/lib/time";
import { requireAdmin } from "@/server/auth/session";
import { getWeekSchedule } from "@/server/booking/schedule";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = { title: "Седмица" };

export default function WeekPage({ searchParams }: PageProps<"/admin/week">) {
  return (
    <Suspense fallback={<ScheduleSkeleton />}>
      <WeekView searchParams={searchParams} />
    </Suspense>
  );
}

async function WeekView({ searchParams }: Pick<PageProps<"/admin/week">, "searchParams">) {
  await requireAdmin();
  const params = await searchParams;
  const today = todayInSofia();
  const requested = typeof params.start === "string" && isLocalDate(params.start) ? params.start : today;
  const monday = startOfIsoWeek(requested);
  const schedule = await getWeekSchedule(getDb(), monday);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl text-cream md:text-4xl">
            {formatDayMonth(monday)} – {formatDayMonth(days[6])}
          </h1>
          <p className="mt-1 text-cream-muted">Седмичен график</p>
        </div>
        <DayNav
          basePath="/admin/week"
          date={monday}
          prev={addDays(monday, -7)}
          next={addDays(monday, 7)}
          today={startOfIsoWeek(today)}
          todayLabel="Тази седмица"
        />
      </div>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[48rem] border-separate border-spacing-0 text-left">
          <thead>
            <tr>
              <th scope="col" className="w-40 border-b border-line pb-3 text-sm font-normal text-cream-faint">
                Ден
              </th>
              {schedule.barbers.map((b) => (
                <th key={b.id} scope="col" className="border-b border-line pb-3 font-display text-lg font-normal text-cream">
                  {b.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day} className={day === today ? "bg-bottle-900/70" : undefined}>
                <th scope="row" className="border-b border-line py-4 pr-4 align-top font-normal">
                  <Link href={`/admin?date=${day}`} className="text-cream hover:text-gold-bright">
                    {formatDateLong(day)}
                  </Link>
                  {day === today && <span className="block text-xs text-gold">днес</span>}
                </th>
                {schedule.barbers.map((barber) => {
                  const list = schedule.appointments.filter(
                    (a) => a.barberId === barber.id && toSofiaDate(a.startsAt) === day,
                  );
                  const off = timeOffOn(barber, day);
                  const hours = hoursText(barber, day);
                  return (
                    <td key={barber.id} className="border-b border-line py-4 pr-4 align-top">
                      <p className="mb-2 text-xs text-cream-faint">
                        {off ? `Почивка: ${off.reason || "почивен ден"}` : (hours ?? "Не работи")}
                      </p>
                      {list.length > 0 && (
                        <ul className="space-y-2">
                          {list.map((a) => (
                            <AppointmentLine key={a.id} appointment={a} />
                          ))}
                        </ul>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
