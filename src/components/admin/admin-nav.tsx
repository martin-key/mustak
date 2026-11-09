"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "Днес", exact: true },
  { href: "/admin/week", label: "Седмица" },
  { href: "/admin/appointments/new", label: "Нов час" },
  { href: "/admin/services", label: "Услуги" },
  { href: "/admin/barbers", label: "Бръснари" },
];

/** Активният раздел зависи от адреса, затова в layout-а е в Suspense с AdminNavLinks като fallback. */
export function AdminNav() {
  return <AdminNavLinks pathname={usePathname()} />;
}

export function AdminNavLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Админ навигация" className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0">
      <ul className="flex gap-1 whitespace-nowrap">
        {items.map((item) => {
          const active = pathname !== null && (item.exact ? pathname === item.href : pathname.startsWith(item.href));
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex h-9 items-center rounded-md px-3 text-sm transition-colors ${
                  active ? "bg-gradient-to-b from-bottle-600 to-bottle-700 text-cream shadow-[inset_0_-2px_0_var(--color-gold)]" : "text-cream-muted hover:bg-bottle-800 hover:text-cream"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
