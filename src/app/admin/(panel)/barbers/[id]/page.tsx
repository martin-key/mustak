import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BarberForm, DeleteButton, TimeOffForm, WorkingHoursEditor } from "@/components/admin/forms";
import { deleteBarberAction, deleteTimeOffAction } from "@/app/admin/(panel)/manage-actions";
import { idSchema } from "@/lib/validation";
import { formatDateLong, toSofiaDate, toSofiaTime, todayInSofia } from "@/lib/time";
import { requireAdmin } from "@/server/auth/session";
import { getBarberDetail } from "@/server/booking/manage";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = { title: "Бръснар" };

export default function BarberPage({ params, searchParams }: PageProps<"/admin/barbers/[id]">) {
  return (
    <div>
      <Link href="/admin/barbers" className="text-sm text-cream-muted hover:text-cream">
        Всички бръснари
      </Link>
      <Suspense fallback={<div className="mt-8 h-96 animate-pulse rounded-xl bg-bottle-900" />}>
        <BarberDetail params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

/** "10 ное 2026, 00:00" → четим почивката като цели дни, ако започва и свършва в полунощ. */
function timeOffText(startsAt: Date, endsAt: Date): string {
  const startTime = toSofiaTime(startsAt);
  const endTime = toSofiaTime(endsAt);
  if (startTime === "00:00" && endTime === "00:00") {
    const first = toSofiaDate(startsAt);
    const last = toSofiaDate(new Date(endsAt.getTime() - 1));
    return first === last ? formatDateLong(first) : `${formatDateLong(first)} – ${formatDateLong(last)}`;
  }
  return `${formatDateLong(toSofiaDate(startsAt))}, ${startTime} – ${formatDateLong(toSofiaDate(endsAt))}, ${endTime}`;
}

async function BarberDetail({
  params,
  searchParams,
}: Pick<PageProps<"/admin/barbers/[id]">, "params" | "searchParams">) {
  await requireAdmin();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!idSchema("").safeParse(id).success) notFound();
  const detail = await getBarberDetail(getDb(), id);
  if (!detail) notFound();
  const { barber, hours, timeOff } = detail;

  return (
    <>
      <h1 className="mt-2 font-display text-3xl text-cream md:text-4xl">{barber.name}</h1>
      {query.nov === "1" && (
        <p role="status" className="mt-4 max-w-xl rounded-lg border border-sage/50 bg-sage/10 px-4 py-3 text-sm text-sage">
          Бръснарят е добавен. Сега въведете работното му време, иначе няма да има свободни часове.
        </p>
      )}

      <div className="mt-10 grid gap-14 xl:grid-cols-2">
        <section aria-labelledby="hours">
          <h2 id="hours" className="mb-4 font-display text-2xl text-cream">
            Работно време
          </h2>
          <WorkingHoursEditor barberId={barber.id} initial={hours} />
        </section>

        <section aria-labelledby="time-off">
          <h2 id="time-off" className="mb-4 font-display text-2xl text-cream">
            Почивни дни и отпуски
          </h2>
          {timeOff.length === 0 ? (
            <p className="mb-6 text-sm text-cream-faint">Няма предстоящи почивки.</p>
          ) : (
            <ul className="mb-8 divide-y divide-line border-y border-line">
              {timeOff.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-4 py-3">
                  <span>
                    <span className="block text-cream">{timeOffText(o.startsAt, o.endsAt)}</span>
                    {o.reason && <span className="block text-sm text-cream-muted">{o.reason}</span>}
                  </span>
                  <form action={deleteTimeOffAction.bind(null, barber.id, o.id)}>
                    <button type="submit" className="text-sm text-oxblood-bright hover:underline">
                      Махни
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <TimeOffForm barberId={barber.id} today={todayInSofia()} />
        </section>
      </div>

      <section aria-labelledby="profile" className="mt-16 border-t border-line pt-10">
        <h2 id="profile" className="mb-6 font-display text-2xl text-cream">
          Профил
        </h2>
        <BarberForm barber={barber} />
        <div className="mt-12 max-w-xl border-t border-line pt-6">
          <DeleteButton
            action={deleteBarberAction.bind(null, barber.id)}
            label="Изтрий бръснаря"
            confirmText="Бръснарят ще бъде изтрит завинаги заедно с графика му. Ако има записани часове, по-добре го направете неактивен."
          />
        </div>
      </section>
    </>
  );
}
