import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BarberPortrait } from "@/components/site/barber-portrait";
import { buttonClass } from "@/components/ui/button";
import { WEEKDAY_NAMES } from "@/lib/time";
import { requireAdmin } from "@/server/auth/session";
import { listAllBarbers } from "@/server/booking/manage";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = { title: "Бръснари" };

export default function BarbersPage() {
  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-cream md:text-4xl">Бръснари</h1>
          <p className="mt-1 text-cream-muted">Профил, работно време и почивни дни.</p>
        </div>
        <Link href="/admin/barbers/new" className={buttonClass({ size: "sm" })}>
          Нов бръснар
        </Link>
      </div>
      <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-xl bg-bottle-900" />}>
        <BarbersList />
      </Suspense>
    </div>
  );
}

async function BarbersList() {
  await requireAdmin();
  const barbers = await listAllBarbers(getDb());
  if (barbers.length === 0) {
    return (
      <p className="mt-8 text-cream-muted">
        Още няма бръснари. <Link href="/admin/barbers/new" className="text-gold">Добавете първия</Link>.
      </p>
    );
  }
  return (
    <ul className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {barbers.map((b) => (
        <li key={b.id}>
          <Link
            href={`/admin/barbers/${b.id}`}
            className="flex gap-4 rounded-xl border border-line bg-bottle-900/50 p-4 hover:border-gold/50 hover:bg-bottle-800"
          >
            <BarberPortrait name={b.name} photoUrl={b.photoUrl} size="sm" className="h-20 w-16 shrink-0" />
            <span>
              <span className={`block font-display text-xl ${b.isActive ? "text-cream" : "text-cream-faint line-through"}`}>
                {b.name}
              </span>
              <span className="mt-1 block text-sm text-cream-muted">
                {b.workingWeekdays.length === 0
                  ? "Няма работно време"
                  : b.workingWeekdays.map((d) => WEEKDAY_NAMES[d].slice(0, 3).toLowerCase()).join(", ")}
              </span>
              {!b.isActive && <span className="mt-1 block text-sm text-cream-faint">неактивен</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
