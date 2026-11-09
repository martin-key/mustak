import type { Metadata } from "next";
import Link from "next/link";
import { BarberForm } from "@/components/admin/forms";

export const metadata: Metadata = { title: "Нов бръснар" };

export default function NewBarberPage() {
  return (
    <div>
      <Link href="/admin/barbers" className="text-sm text-cream-muted hover:text-cream">
        Всички бръснари
      </Link>
      <h1 className="mb-2 mt-2 font-display text-3xl text-cream md:text-4xl">Нов бръснар</h1>
      <p className="mb-8 text-cream-muted">След като запазите профила, ще можете да въведете работното време.</p>
      <BarberForm />
    </div>
  );
}
