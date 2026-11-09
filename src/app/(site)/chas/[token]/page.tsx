import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site/header";
import { Mustache } from "@/components/site/mustache";
import { buttonClass } from "@/components/ui/button";
import { business } from "@/config/business";
import { formatDuration, formatPhone, formatPrice } from "@/lib/format";
import { formatDateLong, toSofiaDate, toSofiaTime } from "@/lib/time";
import { getBookingPage } from "@/server/queries/public";
import { CancelBooking, CopyLink } from "./booking-actions";

export const metadata: Metadata = {
  title: "Твоят час",
  robots: { index: false, follow: false },
};

export default function BookingStatusPage({ params, searchParams }: PageProps<"/chas/[token]">) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Suspense fallback={<div className="mx-auto h-96 max-w-xl px-5 pt-16" aria-busy="true" />}>
          <BookingStatus params={params} searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function BookingStatus({
  params,
  searchParams,
}: Pick<PageProps<"/chas/[token]">, "params" | "searchParams">) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const data = await getBookingPage(token);
  if (!data) notFound();
  const { booking, cancelCheck: check, isPast: past } = data;

  const isNew = query.nov === "1";
  const cancelled = booking.status === "cancelled";

  const title = cancelled ? "Часът е отказан" : isNew ? "Часът е запазен" : "Твоят час";
  const date = toSofiaDate(booking.startsAt);

  return (
    <div className="rise mx-auto max-w-xl px-5 py-12 md:py-16">
      <Mustache className={`w-20 ${cancelled ? "text-cream-faint" : "text-gold"}`} />
      <h1 className={`mt-4 font-display text-4xl md:text-5xl ${cancelled ? "text-cream" : "gilded"}`}>{title}</h1>
      {isNew && !cancelled && (
        <p className="mt-4 text-lg text-cream-muted">
          Очакваме те, {booking.customerName.split(" ")[0]}. Ако нещо се промени, ще ти се обадим на{" "}
          {formatPhone(booking.customerPhone)}.
        </p>
      )}
      {cancelled && (
        <p className="mt-4 text-lg text-cream-muted">
          {booking.cancelledBy === "admin" ? "Салонът отказа този час." : "Отказа часа. Времето вече е свободно за други."}
        </p>
      )}

      <dl className={`mt-10 divide-y divide-line border-y border-line ${cancelled ? "opacity-60" : ""}`}>
        <Row label="Кога" value={`${formatDateLong(date, { withYear: true })}, ${toSofiaTime(booking.startsAt)}`} />
        <Row label="Услуга" value={booking.serviceName} />
        <Row label="Бръснар" value={booking.barberName} />
        <Row label="Продължителност" value={formatDuration(booking.durationMin)} />
        <Row label="Цена" value={formatPrice(booking.priceCents)} />
        <Row label="Къде" value={`${business.address.street}, ${business.address.city}`} />
      </dl>

      {!cancelled && !past && (
        <section className="panel mt-10 p-5">
          <h2 className="font-display text-xl text-cream">Запази този линк</h2>
          <p className="mt-2 text-sm text-cream-muted">
            Само с него можеш да откажеш часа. Добави страницата в отметките или копирай линка.
          </p>
          <div className="mt-4">
            <CopyLink />
          </div>
        </section>
      )}

      <section className="mt-10">
        {check.allowed && <CancelBooking token={token} />}
        {!check.allowed && check.code === "TOO_LATE_TO_CANCEL" && !past && (
          <p className="text-cream-muted">
            До часа остава по-малко от {business.booking.cancelMinNoticeMinutes / 60} часа, затова отказът е само по
            телефона:{" "}
            <a href={business.phoneHref} className="text-gold">
              {business.phone}
            </a>
            .
          </p>
        )}
        {cancelled && (
          <Link href="/zapazi-chas" className={buttonClass()}>
            Запази нов час
          </Link>
        )}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-6 py-3.5">
      <dt className="text-cream-muted">{label}</dt>
      <dd className="text-right text-cream">{value}</dd>
    </div>
  );
}
