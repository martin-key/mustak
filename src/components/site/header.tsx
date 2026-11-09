import Link from "next/link";
import { business } from "@/config/business";
import { buttonClass } from "@/components/ui/button";
import { Mustache } from "./mustache";

const nav = [
  { href: "/#uslugi", label: "Услуги" },
  { href: "/#ekip", label: "Бръснари" },
  { href: "/#kontakti", label: "Контакти" },
];

export function SiteHeader({ showCta = true, ctaOnMobile = true }: { showCta?: boolean; ctaOnMobile?: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-bottle-900/90 backdrop-blur supports-[backdrop-filter]:bg-bottle-900/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
        <Link href="/" className="flex items-center gap-2.5 text-gold" aria-label={`${business.name}, начало`}>
          <Mustache className="h-4 w-14" />
          <span className="font-display text-2xl leading-none text-cream">{business.name}</span>
        </Link>
        <nav aria-label="Основна навигация" className="flex items-center gap-1">
          <ul className="hidden items-center gap-1 md:flex">
            {nav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={buttonClass({ variant: "ghost", size: "sm" })}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          {showCta && (
            <Link
              href="/zapazi-chas"
              className={buttonClass({ size: "sm", className: `ml-2 ${ctaOnMobile ? "" : "max-md:hidden"}` })}
            >
              Запази час
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
