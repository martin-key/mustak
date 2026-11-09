import Link from "next/link";
import { business } from "@/config/business";
import { formatDuration, formatPrice } from "@/lib/format";
import { getPublicCatalog } from "@/server/queries/public";
import { BarberPortrait } from "./barber-portrait";

export function SectionHeading({ id, title, intro }: { id: string; title: string; intro?: string }) {
  return (
    <div className="mb-10">
      <h2 id={id} className="font-display text-4xl leading-tight text-cream md:text-5xl">
        {title}
      </h2>
      {intro && <p className="mt-3 max-w-xl text-cream-muted">{intro}</p>}
    </div>
  );
}

/** Ценоразпис като табела на стената: име, пунктир, цена. */
export async function ServicesMenu() {
  const { services } = await getPublicCatalog();
  if (services.length === 0) {
    return <p className="text-cream-muted">Услугите скоро ще бъдат публикувани. Обадете ни се на {business.phone}.</p>;
  }
  return (
    <ul className="divide-y divide-line border-y border-line">
      {services.map((service) => (
        <li key={service.id}>
          <Link
            href={`/zapazi-chas?usluga=${service.id}`}
            className="group -mx-3 block rounded-lg px-3 py-6 transition-colors hover:bg-bottle-900"
          >
            <span className="flex items-baseline">
              <span className="font-display text-xl text-cream group-hover:text-gold-bright md:text-2xl">
                {service.name}
              </span>
              <span className="leader" aria-hidden />
              <span className="font-display text-xl text-gold tabular-nums md:text-2xl">
                {formatPrice(service.priceCents)}
              </span>
            </span>
            <span className="mt-2 flex items-start justify-between gap-6 text-sm">
              <span className="max-w-md text-cream-muted">{service.description}</span>
              <span className="shrink-0 text-cream-faint">{formatDuration(service.durationMin)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ServicesMenuSkeleton() {
  return (
    <ul className="divide-y divide-line border-y border-line" aria-busy="true" aria-label="Зареждане на услугите">
      {Array.from({ length: 5 }, (_, i) => (
        <li key={i} className="py-6">
          <div className="h-6 w-2/3 animate-pulse rounded bg-bottle-700" />
          <div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-bottle-800" />
        </li>
      ))}
    </ul>
  );
}

export async function Team() {
  const { barbers } = await getPublicCatalog();
  if (barbers.length === 0) return <p className="text-cream-muted">Скоро ще ви представим екипа.</p>;
  return (
    <ul className="grid gap-10 sm:grid-cols-2 sm:gap-12 lg:grid-cols-3">
      {barbers.map((barber) => (
        <li key={barber.id} className="grid grid-cols-[6.5rem_1fr] items-start gap-5 sm:flex sm:flex-col sm:gap-0">
          <BarberPortrait name={barber.name} photoUrl={barber.photoUrl} className="aspect-[3/4] w-full sm:max-w-xs" />
          <div>
            <h3 className="font-display text-2xl text-cream sm:mt-6">{barber.name}</h3>
            <p className="mt-2 max-w-xs text-cream-muted">{barber.bio}</p>
            <Link
              href={`/zapazi-chas?bradnar=${barber.id}`}
              className="mt-4 inline-block text-sm text-gold underline-offset-4 hover:text-gold-bright hover:underline"
            >
              Запази час при {barber.name.split(" ")[0]}
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function TeamSkeleton() {
  return (
    <ul className="grid gap-12 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Зареждане на екипа">
      {Array.from({ length: 3 }, (_, i) => (
        <li key={i}>
          <div className="mirror aspect-[3/4] w-full max-w-xs animate-pulse bg-bottle-800" />
          <div className="mt-6 h-6 w-1/2 animate-pulse rounded bg-bottle-700" />
        </li>
      ))}
    </ul>
  );
}

export function OpeningHours() {
  return (
    <dl className="divide-y divide-line border-y border-line">
      {business.openingHours.map((row) => (
        <div key={row.days} className="flex justify-between gap-6 py-4">
          <dt className="text-cream">{row.days}</dt>
          <dd className={row.hours ? "tabular-nums text-cream" : "text-cream-faint"}>{row.hours ?? "Почивен ден"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Без вградена външна карта: стилизиран план и линк, който се отваря при клиента. */
export function MapPlaceholder() {
  return (
    <a
      href={business.mapUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block aspect-[4/3] overflow-hidden rounded-xl border border-line bg-bottle-800"
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(28deg, transparent 47%, rgb(181 187 168 / 0.22) 47.5%, rgb(181 187 168 / 0.22) 52.5%, transparent 53%)," +
            "linear-gradient(-62deg, transparent 46%, rgb(181 187 168 / 0.16) 46.5%, rgb(181 187 168 / 0.16) 50%, transparent 50.5%)," +
            "repeating-linear-gradient(90deg, transparent 0 46px, rgb(45 69 58 / 0.9) 46px 48px)," +
            "repeating-linear-gradient(0deg, transparent 0 46px, rgb(45 69 58 / 0.9) 46px 48px)",
        }}
      />
      <div aria-hidden className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
        <svg viewBox="0 0 24 32" className="h-10 w-8 text-gold drop-shadow-[0_4px_8px_rgb(0_0_0/0.5)]" fill="currentColor">
          <path d="M12 0C5.4 0 0 5.2 0 11.7 0 20.5 12 32 12 32s12-11.5 12-20.3C24 5.2 18.6 0 12 0Zm0 16a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9Z" />
        </svg>
      </div>
      <span className="absolute inset-x-0 bottom-0 bg-bottle-950/85 px-4 py-3 text-sm text-cream group-hover:text-gold-bright">
        Отвори картата в нов прозорец
      </span>
    </a>
  );
}
