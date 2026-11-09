import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DeleteButton, ServiceForm } from "@/components/admin/forms";
import { deleteServiceAction } from "@/app/admin/(panel)/manage-actions";
import { idSchema } from "@/lib/validation";
import { requireAdmin } from "@/server/auth/session";
import { getService } from "@/server/booking/manage";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = { title: "Услуга" };

export default function EditServicePage({ params }: PageProps<"/admin/services/[id]">) {
  return (
    <div>
      <Link href="/admin/services" className="text-sm text-cream-muted hover:text-cream">
        Всички услуги
      </Link>
      <Suspense fallback={<div className="mt-8 h-96 animate-pulse rounded-xl bg-bottle-900" />}>
        <EditService params={params} />
      </Suspense>
    </div>
  );
}

async function EditService({ params }: Pick<PageProps<"/admin/services/[id]">, "params">) {
  await requireAdmin();
  const { id } = await params;
  if (!idSchema("").safeParse(id).success) notFound();
  const service = await getService(getDb(), id);
  if (!service) notFound();
  return (
    <>
      <h1 className="mb-2 mt-2 font-display text-3xl text-cream md:text-4xl">{service.name}</h1>
      <p className="mb-8 text-sm text-cream-muted">
        Промяната на цената или продължителността не засяга вече записаните часове.
      </p>
      <ServiceForm service={service} />
      <div className="mt-12 max-w-xl border-t border-line pt-6">
        <DeleteButton
          action={deleteServiceAction.bind(null, service.id)}
          label="Изтрий услугата"
          confirmText="Услугата ще бъде изтрита завинаги. Ако има записани часове, по-добре я направете неактивна."
        />
      </div>
    </>
  );
}
