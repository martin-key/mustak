import Link from "next/link";
import { Suspense } from "react";
import { business } from "@/config/business";
import { buttonClass } from "@/components/ui/button";
import { SiteHeader } from "@/components/site/header";
import { Mustache } from "@/components/site/mustache";
import { OpenToday } from "@/components/site/open-today";
import {
  MapPlaceholder,
  OpeningHours,
  SectionHeading,
  ServicesMenu,
  ServicesMenuSkeleton,
  Team,
  TeamSkeleton,
} from "@/components/site/sections";

export default function HomePage() {
  return (
    <>
      <SiteHeader ctaOnMobile={false} />
      <main className="flex-1 pb-24 md:pb-0">
        {/* Витрината: позлатеното име на стъклото. */}
        <section className="relative overflow-hidden border-b border-line">
          {/* Сияние зад надписа и рамка на витрина с арка. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_42%,rgb(210_168_89/0.18),transparent_70%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-6 h-[92%] w-[min(94%,58rem)] -translate-x-1/2 rounded-t-[999px] border border-gold/20 bg-gradient-to-b from-bottle-700/35 via-bottle-900/10 to-transparent shadow-[inset_0_0_120px_rgb(0_0_0/0.35)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-10 h-[90%] w-[min(90%,56rem)] -translate-x-1/2 rounded-t-[999px] border border-gold/10"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -left-1/4 top-0 h-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-cream/[0.04] to-transparent"
          />
          <div className="rise relative mx-auto flex max-w-6xl flex-col items-center px-5 pb-24 pt-20 text-center md:pb-32 md:pt-28">
            <Mustache className="w-28 text-gold md:w-40" />
            <h1 className="gilded gilded-sheen mt-4 font-display text-[clamp(4.5rem,19vw,11.5rem)] leading-[0.95]">
              {business.name}
            </h1>
            <p className="mt-5 font-display text-xl text-cream md:text-2xl">
              {business.signLine}
            </p>
            <div className="ornament mt-7 w-full max-w-xs" aria-hidden>
              <span className="h-1.5 w-1.5 rotate-45 bg-gold" />
            </div>
            <p className="mt-7 max-w-md text-lg text-cream-muted">
              Подстригване, брада и бръснене с бръснач. Избери услуга, бръснар и свободен час, без да звъниш.
            </p>
            <div className="mt-10 flex w-full max-w-sm flex-col gap-3 sm:w-auto sm:max-w-none sm:flex-row">
              <Link href="/zapazi-chas" className={buttonClass({ size: "lg" })}>
                Запази час
              </Link>
              <Link href="#uslugi" className={buttonClass({ variant: "secondary", size: "lg" })}>
                Виж цените
              </Link>
            </div>
            <OpenToday className="mt-6 text-sm text-cream-faint" />
          </div>
        </section>

        <section aria-labelledby="uslugi" className="scroll-mt-16">
          <div className="panel mx-auto max-w-3xl px-6 py-14 md:px-14 md:py-20 max-md:mx-4">
            <SectionHeading id="uslugi" title="Услуги и цени" intro="Цените са в евро. Натисни услуга, за да запазиш час за нея." />
            <Suspense fallback={<ServicesMenuSkeleton />}>
              <ServicesMenu />
            </Suspense>
          </div>
        </section>

        <section aria-labelledby="ekip" className="scroll-mt-16">
          <div className="mx-auto max-w-6xl px-5 py-20 md:py-28">
            <SectionHeading
              id="ekip"
              title="Бръснарите"
              intro="Можеш да избереш бръснар или да оставиш системата да намери първия свободен."
            />
            <Suspense fallback={<TeamSkeleton />}>
              <Team />
            </Suspense>
          </div>
        </section>

        <section aria-labelledby="kontakti" className="scroll-mt-16 border-t border-line/60 bg-gradient-to-b from-transparent to-black/25">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-20 md:grid-cols-2 md:gap-10 md:py-28">
            <div className="panel-soft p-6 md:p-10">
              <SectionHeading id="kontakti" title="Работно време" />
              <OpeningHours />
              <h3 className="mt-14 font-display text-2xl text-cream">Контакти</h3>
              <ul className="mt-5 space-y-3">
                <li>
                  <a href={business.phoneHref} className="font-display text-3xl text-gold hover:text-gold-bright">
                    {business.phone}
                  </a>
                </li>
                <li>
                  <a href={`mailto:${business.email}`} className="text-cream hover:text-gold-bright">
                    {business.email}
                  </a>
                </li>
                <li className="flex gap-5 text-cream-muted">
                  <a href={business.social.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-cream">
                    Instagram
                  </a>
                  <a href={business.social.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-cream">
                    Facebook
                  </a>
                </li>
              </ul>
            </div>
            <div className="panel-soft p-6 md:p-10">
              <h3 className="font-display text-4xl text-cream md:text-5xl">Къде сме</h3>
              <address className="mb-8 mt-3 not-italic text-cream-muted">
                <span className="text-cream">{business.address.street}</span>, {business.address.postalCode}{" "}
                {business.address.city}
                <br />
                {business.address.note}
              </address>
              <MapPlaceholder />
            </div>
          </div>
        </section>
      </main>

      {/* На телефон бутонът за записване е винаги под ръка. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bottle-900/95 px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden">
        <Link href="/zapazi-chas" className={buttonClass({ size: "lg", className: "w-full" })}>
          Запази час
        </Link>
      </div>
    </>
  );
}
