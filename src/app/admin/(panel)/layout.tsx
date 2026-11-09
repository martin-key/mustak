import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminNav, AdminNavLinks } from "@/components/admin/admin-nav";
import { Mustache } from "@/components/site/mustache";
import { business } from "@/config/business";
import { getCurrentAdmin } from "@/server/auth/session";
import { logoutAction } from "../login/actions";

export const metadata: Metadata = {
  title: { default: "Админ", template: `%s | Админ | ${business.name}` },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-gold/15 bg-bottle-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-3 md:flex-row md:items-center md:gap-8">
          <div className="flex items-center justify-between gap-4">
            <Link href="/admin" className="flex items-center gap-2 text-gold">
              <Mustache className="h-3.5 w-12" />
              <span className="font-display text-xl text-cream">{business.name}</span>
              <span className="text-sm text-cream-faint">админ</span>
            </Link>
            <div className="md:hidden">
              <Suspense>
                <AdminUser />
              </Suspense>
            </div>
          </div>
          <Suspense fallback={<AdminNavLinks pathname={null} />}>
            <AdminNav />
          </Suspense>
          <div className="ml-auto hidden md:block">
            <Suspense>
              <AdminUser />
            </Suspense>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-8">{children}</main>
    </div>
  );
}

async function AdminUser() {
  const admin = await getCurrentAdmin();
  if (!admin) return null;
  return (
    <form action={logoutAction} className="flex items-center gap-3 text-sm">
      <span className="hidden text-cream-muted lg:inline">{admin.name}</span>
      <button type="submit" className="text-cream-muted underline-offset-4 hover:text-cream hover:underline">
        Изход
      </button>
    </form>
  );
}
