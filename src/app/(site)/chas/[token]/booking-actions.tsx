"use client";

import { useState, useTransition } from "react";
import { buttonClass } from "@/components/ui/button";
import { cancelBookingAction } from "./actions";

export function CopyLink() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={buttonClass({ variant: "secondary", size: "sm" })}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href.split("?")[0]);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        } catch {
          window.prompt("Копирай линка:", window.location.href.split("?")[0]);
        }
      }}
    >
      {copied ? "Линкът е копиран" : "Копирай линка"}
    </button>
  );
}

export function CancelBooking({ token }: { token: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={buttonClass({ variant: "secondary", className: "w-full sm:w-auto" })}
      >
        Откажи часа
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-oxblood/60 bg-oxblood/10 p-5">
      <p className="text-cream">Сигурен ли си? Часът ще се освободи за други клиенти.</p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-oxblood-bright">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await cancelBookingAction(token);
              if (!result.ok) setError(result.message);
            })
          }
          className={buttonClass({ variant: "danger" })}
        >
          {pending ? "Отказваме…" : "Да, откажи часа"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
          className={buttonClass({ variant: "ghost" })}
        >
          Не, запази го
        </button>
      </div>
    </div>
  );
}
