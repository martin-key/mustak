import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingWizard } from "@/components/booking/booking-wizard";
import { SiteHeader } from "@/components/site/header";
import { business } from "@/config/business";
import { todayInSofia } from "@/lib/time";
import { getPublicCatalog } from "@/server/queries/public";

export const metadata: Metadata = {
  title: "Запази час",
  description: `Запази час онлайн в ${business.legalName}: избери услуга, бръснар и свободен час.`,
};

export default function BookingPage({ searchParams }: PageProps<"/zapazi-chas">) {
  return (
    <>
      <SiteHeader showCta={false} />
      <main className="flex flex-1 flex-col">
        <Suspense fallback={<WizardSkeleton />}>
          <BookingLoader searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function BookingLoader({ searchParams }: { searchParams: PageProps<"/zapazi-chas">["searchParams"] }) {
  const [params, { services, barbers }] = await Promise.all([searchParams, getPublicCatalog()]);
  const pick = (value: string | string[] | undefined) => (typeof value === "string" ? value : null);

  if (services.length === 0 || barbers.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-5 py-20 text-center">
        <h1 className="font-display text-3xl">Онлайн записването не е налично</h1>
        <p className="mt-4 text-cream-muted">
          Обади ни се на{" "}
          <a href={business.phoneHref} className="text-gold">
            {business.phone}
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <BookingWizard
      services={services}
      barbers={barbers}
      initialServiceId={pick(params.usluga)}
      initialBarberId={pick(params.brasnar)}
      today={todayInSofia()}
      maxDaysAhead={business.booking.maxDaysAhead}
      salonPhone={business.phone}
      salonPhoneHref={business.phoneHref}
    />
  );
}

function WizardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 pt-12" aria-busy="true" aria-label="Зареждане">
      <div className="h-2 w-full animate-pulse rounded bg-bottle-800" />
      <div className="mt-10 h-9 w-2/3 animate-pulse rounded bg-bottle-700" />
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="mt-6 h-16 animate-pulse rounded-lg bg-bottle-800" />
      ))}
    </div>
  );
}
