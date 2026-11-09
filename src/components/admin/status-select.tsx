"use client";

import { useState, useTransition } from "react";
import { setStatusAction } from "@/app/admin/(panel)/actions";
import { STATUS_LABELS, STATUS_ORDER } from "@/lib/labels";
import type { AppointmentStatus } from "@/server/db/schema";

export function StatusSelect({ id, status }: { id: string; status: AppointmentStatus }) {
  const [value, setValue] = useState(status);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <label className="sr-only" htmlFor={`status-${id}`}>
        Статус
      </label>
      <select
        id={`status-${id}`}
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as AppointmentStatus;
          const previous = value;
          setValue(next);
          setError(null);
          startTransition(async () => {
            const result = await setStatusAction(id, next);
            if (!result.ok) {
              setValue(previous);
              setError(result.message);
            }
          });
        }}
        className="h-9 w-full rounded-md border border-line bg-bottle-950 px-2 text-sm text-cream focus:border-gold/70 focus:outline-none disabled:opacity-60"
      >
        {STATUS_ORDER.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-oxblood-bright">
          {error}
        </p>
      )}
    </div>
  );
}
