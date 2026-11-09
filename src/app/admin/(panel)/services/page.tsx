import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buttonClass } from "@/components/ui/button";
import { formatDuration, formatPrice } from "@/lib/format";
import { requireAdmin } from "@/server/auth/session";
import { listAllServices } from "@/server/booking/manage";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = { title: "Услуги" };

export default function ServicesPage() {
  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-cream md:text-4xl">Услуги</h1>
          <p className="mt-1 text-cream-muted">Неактивните услуги не се показват на сайта.</p>
        </div>
        <Link href="/admin/services/new" className={buttonClass({ size: "sm" })}>
          Нова услуга
        </Link>
      </div>
      <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-xl bg-bottle-900" />}>
        <ServicesTable />
      </Suspense>
    </div>
  );
}

async function ServicesTable() {
  await requireAdmin();
  const services = await listAllServices(getDb());
  if (services.length === 0) {
    return (
      <p className="mt-8 text-cream-muted">
        Още няма услуги. <Link href="/admin/services/new" className="text-gold">Добавете първата</Link>.
      </p>
    );
  }
  return (
    <ul className="mt-8 divide-y divide-line rounded-xl border border-line bg-bottle-900/50">
      {services.map((s) => (
        <li key={s.id}>
          <Link href={`/admin/services/${s.id}`} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 px-4 py-4 hover:bg-bottle-800">
            <span className={`min-w-48 flex-1 font-display text-lg ${s.isActive ? "text-cream" : "text-cream-faint line-through"}`}>
              {s.name}
            </span>
            <span className="text-sm text-cream-muted">{formatDuration(s.durationMin)}</span>
            <span className="w-24 text-right tabular-nums text-gold">{formatPrice(s.priceCents)}</span>
            <span className="w-20 text-right text-sm text-cream-faint">{s.isActive ? "активна" : "неактивна"}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
