import type { Metadata } from "next";
import Link from "next/link";
import { ServiceForm } from "@/components/admin/forms";

export const metadata: Metadata = { title: "Нова услуга" };

export default function NewServicePage() {
  return (
    <div>
      <Link href="/admin/services" className="text-sm text-cream-muted hover:text-cream">
        Всички услуги
      </Link>
      <h1 className="mb-8 mt-2 font-display text-3xl text-cream md:text-4xl">Нова услуга</h1>
      <ServiceForm />
    </div>
  );
}
