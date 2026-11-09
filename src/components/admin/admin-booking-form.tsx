"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { adminCreateBookingAction } from "@/app/admin/(panel)/actions";
import { buttonClass } from "@/components/ui/button";
import { inputClass, labelClass, selectClass } from "@/components/ui/input";
import { formatDuration, formatPrice } from "@/lib/format";
import type { LocalDate } from "@/lib/time";

interface Option {
  id: string;
  name: string;
}

interface ServiceOption extends Option {
  durationMin: number;
  priceCents: number;
}

interface SlotDto {
  start: string;
  time: string;
}

type Slots = { key: string; slots: SlotDto[] } | { key: string; error: string };

export function AdminBookingForm({
  services,
  barbers,
  initialDate,
}: {
  services: ServiceOption[];
  barbers: Option[];
  initialDate: LocalDate;
}) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [barberId, setBarberId] = useState("");
  const [date, setDate] = useState(initialDate);
  const [start, setStart] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [manualTime, setManualTime] = useState("10:00");
  const [status, setStatus] = useState<"confirmed" | "booked">("confirmed");
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "", note: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [created, setCreated] = useState<{ token: string; date: string } | null>(null);
  const [slots, setSlots] = useState<Slots | null>(null);
  const [pending, startTransition] = useTransition();

  const key = `${serviceId}|${barberId}|${date}`;
  const current = slots?.key === key ? slots : null;

  useEffect(() => {
    if (manual || !serviceId || !date) return;
    const params = new URLSearchParams({ serviceId, date });
    if (barberId) params.set("barberId", barberId);
    const controller = new AbortController();
    fetch(`/api/public/availability?${params}`, { signal: controller.signal })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message ?? "Свободните часове не се заредиха.");
        setSlots({ key, slots: body.slots });
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted) setSlots({ key, error: error.message });
      });
    return () => controller.abort();
  }, [key, manual, serviceId, barberId, date]);

  if (created) {
    const link = `${window.location.origin}/chas/${created.token}`;
    return (
      <div className="max-w-xl rounded-xl border border-gold/40 bg-bottle-900 p-6">
        <h2 className="font-display text-2xl text-cream">Часът е записан</h2>
        <p className="mt-2 text-cream-muted">
          Линк за клиента (може да го изпратите по SMS): през него клиентът вижда часа и може да го откаже.
        </p>
        <input readOnly value={link} className={inputClass(false, "mt-4 text-sm")} onFocus={(e) => e.target.select()} />
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={`/admin?date=${created.date}`} className={buttonClass()}>
            Към графика за деня
          </Link>
          <button
            type="button"
            className={buttonClass({ variant: "secondary" })}
            onClick={() => {
              setCreated(null);
              setStart(null);
              setCustomer({ name: "", phone: "", email: "", note: "" });
            }}
          >
            Запиши още един
          </button>
        </div>
      </div>
    );
  }

  const submit = () => {
    setMessage(null);
    setErrors({});
    const startValue = manual ? `${date}T${manualTime}` : start;
    if (!startValue) {
      setMessage("Изберете час.");
      return;
    }
    startTransition(async () => {
      const result = await adminCreateBookingAction({
        serviceId,
        barberId: barberId || null,
        start: startValue,
        customer: { name: customer.name, phone: customer.phone, email: customer.email },
        note: customer.note,
        status,
        outsideAvailability: manual,
      });
      if (result.ok) {
        setCreated({ token: result.token, date: result.date });
      } else {
        setMessage(result.message);
        if (result.fieldErrors) setErrors(result.fieldErrors);
      }
    });
  };

  return (
    <form
      noValidate
      className="grid max-w-3xl gap-8 lg:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <fieldset className="space-y-5">
        <legend className="mb-4 font-display text-xl text-cream">Час</legend>
        <label className="block">
          <span className={labelClass}>Услуга</span>
          <select value={serviceId} onChange={(e) => (setServiceId(e.target.value), setStart(null))} className={selectClass()}>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({formatDuration(s.durationMin)}, {formatPrice(s.priceCents)})
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Бръснар</span>
          <select value={barberId} onChange={(e) => (setBarberId(e.target.value), setStart(null))} className={selectClass()}>
            <option value="">Първият свободен</option>
            {barbers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Дата</span>
          <input
            type="date"
            value={date}
            onChange={(e) => (setDate(e.target.value), setStart(null))}
            className={inputClass(false, "[color-scheme:dark]")}
          />
        </label>

        <div>
          <span className={labelClass}>Начален час</span>
          {manual ? (
            <input
              type="time"
              step={300}
              value={manualTime}
              onChange={(e) => setManualTime(e.target.value)}
              className={inputClass(false, "[color-scheme:dark]")}
            />
          ) : !current ? (
            <p className="text-sm text-cream-faint">Зареждане…</p>
          ) : "error" in current ? (
            <p className="text-sm text-oxblood-bright">{current.error}</p>
          ) : current.slots.length === 0 ? (
            <p className="text-sm text-cream-muted">Няма свободни часове. Изберете друг ден или въведете час ръчно.</p>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {current.slots.map((s) => (
                <button
                  key={s.start}
                  type="button"
                  onClick={() => setStart(s.start)}
                  aria-pressed={s.start === start}
                  className={`h-10 rounded-md border text-sm tabular-nums ${
                    s.start === start ? "border-gold bg-gold text-bottle-950" : "border-line bg-bottle-800 text-cream hover:border-gold/60"
                  }`}
                >
                  {s.time}
                </button>
              ))}
            </div>
          )}
          <label className="mt-3 flex items-start gap-2 text-sm text-cream-muted">
            <input
              type="checkbox"
              checked={manual}
              onChange={(e) => setManual(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--color-gold)]"
            />
            Друг час (извън свободните, напр. клиент без час). Системата пак не позволява два часа едновременно.
          </label>
        </div>

        <label className="block">
          <span className={labelClass}>Статус</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as "confirmed" | "booked")} className={selectClass()}>
            <option value="confirmed">Потвърден</option>
            <option value="booked">Записан</option>
          </select>
        </label>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="mb-4 font-display text-xl text-cream">Клиент</legend>
        <AdminField label="Име" error={errors["customer.name"]}>
          <input
            value={customer.name}
            onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
            className={inputClass(!!errors["customer.name"])}
          />
        </AdminField>
        <AdminField label="Телефон" error={errors["customer.phone"]}>
          <input
            type="tel"
            inputMode="tel"
            value={customer.phone}
            onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
            className={inputClass(!!errors["customer.phone"])}
          />
        </AdminField>
        <AdminField label="Имейл (по желание)" error={errors["customer.email"]}>
          <input
            type="email"
            value={customer.email}
            onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
            className={inputClass(!!errors["customer.email"])}
          />
        </AdminField>
        <AdminField label="Бележка (по желание)" error={errors.note}>
          <textarea
            rows={3}
            value={customer.note}
            onChange={(e) => setCustomer({ ...customer, note: e.target.value })}
            className={inputClass(!!errors.note, "h-auto py-3")}
          />
        </AdminField>
        {message && (
          <p role="alert" className="rounded-lg border border-oxblood/60 bg-oxblood/15 px-4 py-3 text-sm text-oxblood-bright">
            {message}
          </p>
        )}
        <button type="submit" disabled={pending} className={buttonClass({ size: "lg", className: "w-full" })}>
          {pending ? "Записване…" : "Запиши часа"}
        </button>
      </fieldset>
    </form>
  );
}

function AdminField({ label, error, children }: { label: string; error?: string; children: React.ReactElement }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
      {error && (
        <span role="alert" className="mt-1.5 block text-sm text-oxblood-bright">
          {error}
        </span>
      )}
    </label>
  );
}
