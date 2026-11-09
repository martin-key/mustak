import type { Metadata } from "next";
import { Suspense } from "react";
import { Mustache } from "@/components/site/mustache";
import { business } from "@/config/business";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Вход за администратори",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm">
        <Mustache className="mx-auto w-20 text-gold" />
        <h1 className="mt-4 text-center font-display text-3xl text-cream">{business.name}</h1>
        <p className="mt-1 text-center text-cream-muted">Вход в админ панела</p>
        <div className="mt-10">
          <Suspense fallback={<div className="h-64" />}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
