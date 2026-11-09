import { Suspense } from "react";
import { requireAdmin } from "@/server/auth/session";

export default function AdminHomePage() {
  return (
    <Suspense fallback={null}>
      <Welcome />
    </Suspense>
  );
}

async function Welcome() {
  const admin = await requireAdmin();
  return <h1 className="font-display text-3xl">Здравей, {admin.name}</h1>;
}
