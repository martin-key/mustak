import Link from "next/link";
import { business } from "@/config/business";
import { Mustache } from "./mustache";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-bottle-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 text-sm text-cream-muted md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Mustache className="h-3.5 w-12 text-gold" />
          <span>{business.legalName}</span>
        </div>
        <address className="not-italic">
          {business.address.street}, {business.address.city}
        </address>
        <div className="flex gap-5">
          <a href={business.phoneHref} className="hover:text-cream">
            {business.phone}
          </a>
          <Link href="/zapazi-chas" className="text-gold hover:text-gold-bright">
            Запази час
          </Link>
        </div>
      </div>
    </footer>
  );
}
