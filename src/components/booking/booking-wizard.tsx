"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { createBookingAction } from "@/app/(site)/zapazi-chas/actions";
import { BarberPortrait } from "@/components/site/barber-portrait";
import { buttonClass } from "@/components/ui/button";
import { formatDuration, formatPrice } from "@/lib/format";
import {
  addDays,
  daysBetween,
  formatDateLong,
  formatDayMonth,
  isoWeekday,
  startOfIsoWeek,
  type LocalDate,
} from "@/lib/time";
import { customerSchema, fieldErrors as zodFieldErrors, noteSchema } from "@/lib/validation";
import type { PublicBarber, PublicService } from "@/server/booking/catalog";

const STEPS = [
  { key: "usluga", title: "Избери услуга" },
  { key: "brasnar", title: "Избери бръснар" },
  { key: "den", title: "Избери ден" },
  { key: "chas", title: "Избери час" },
  { key: "danni", title: "Твоите данни" },
  { key: "potvarzhdenie", title: "Провери и потвърди" },
] as const;
type StepKey = (typeof STEPS)[number]["key"];

const ANY = "any";

interface SlotDto {
  start: string;
  time: string;
  barberIds: string[];
}

type SlotsState =
  | { status: "ready"; slots: SlotDto[] }
  | { status: "error"; message: string };

interface Props {
  services: PublicService[];
  barbers: PublicBarber[];
  initialServiceId: string | null;
  initialBarberId: string | null;
  today: LocalDate;
  maxDaysAhead: number;
  salonPhone: string;
  salonPhoneHref: string;
}

const WEEKDAY_HEADERS = ["пн", "вт", "ср", "чт", "пт", "сб", "нд"];

export function BookingWizard(props: Props) {
  const { services, barbers, today, maxDaysAhead } = props;
  const router = useRouter();
  const lastDate = addDays(today, maxDaysAhead);

  const [serviceId, setServiceId] = useState<string | null>(
    services.some((s) => s.id === props.initialServiceId) ? props.initialServiceId : null,
  );
  const [barberId, setBarberId] = useState<string | null>(
    barbers.some((b) => b.id === props.initialBarberId) ? props.initialBarberId : null,
  );
  const [date, setDate] = useState<LocalDate | null>(null);
  const [slot, setSlot] = useState<SlotDto | null>(null);
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "", note: "" });
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [slotsCache, setSlotsCache] = useState<Record<string, SlotsState>>({});
  const [submitting, startSubmit] = useTransition();

  const [step, setStep] = useState<StepKey>(() => (!serviceId ? "usluga" : !barberId ? "brasnar" : "den"));
  const stepIndex = STEPS.findIndex((s) => s.key === step);

  const service = services.find((s) => s.id === serviceId) ?? null;
  const barber = barberId && barberId !== ANY ? (barbers.find((b) => b.id === barberId) ?? null) : null;

  // --- Стъпките и бутонът „Назад“ на браузъра -------------------------------------------------
  const canEnter = useCallback(
    (key: StepKey): boolean => {
      switch (key) {
        case "usluga":
          return true;
        case "brasnar":
          return !!serviceId;
        case "den":
          return !!serviceId && !!barberId;
        case "chas":
          return !!serviceId && !!barberId && !!date;
        case "danni":
        case "potvarzhdenie":
          return !!serviceId && !!barberId && !!date && !!slot;
      }
    },
    [serviceId, barberId, date, slot],
  );

  const goTo = useCallback((key: StepKey) => {
    setStep(key);
    window.history.pushState(null, "", `#${key}`);
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    window.history.replaceState(null, "", `#${step}`);
    // Само при първото показване.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onPop = () => {
      const key = window.location.hash.slice(1) as StepKey;
      if (STEPS.some((s) => s.key === key) && canEnter(key)) setStep(key);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [canEnter]);

  // --- Дни ------------------------------------------------------------------------------------
  const workingWeekdays = useMemo(() => {
    const list = barber ? [barber] : barbers;
    return new Set(list.flatMap((b) => b.workingWeekdays));
  }, [barber, barbers]);

  const isDayEnabled = useCallback(
    (d: LocalDate) =>
      daysBetween(today, d) >= 0 && daysBetween(d, lastDate) >= 0 && workingWeekdays.has(isoWeekday(d)),
    [today, lastDate, workingWeekdays],
  );

  const calendar = useMemo(() => {
    const first = startOfIsoWeek(today);
    const total = daysBetween(first, lastDate) + 1;
    const weeks = Math.ceil(total / 7);
    return Array.from({ length: weeks * 7 }, (_, i) => addDays(first, i));
  }, [today, lastDate]);

  // --- Свободни часове --------------------------------------------------------------------------
  const slotsKey = serviceId && barberId && date ? `${serviceId}|${barberId}|${date}` : null;
  const slotsState = slotsKey ? slotsCache[slotsKey] : undefined;

  useEffect(() => {
    if (step !== "chas" || !slotsKey || slotsState) return;
    const [sId, bId, d] = slotsKey.split("|");
    const params = new URLSearchParams({ serviceId: sId, date: d });
    if (bId !== ANY) params.set("barberId", bId);
    // Докато няма запис в кеша, стъпката показва зареждане.
    const controller = new AbortController();
    fetch(`/api/public/availability?${params}`, { signal: controller.signal })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message ?? "Свободните часове не се заредиха.");
        setSlotsCache((c) => ({ ...c, [slotsKey]: { status: "ready", slots: body.slots } }));
      })
      .catch((error: Error) => {
        if (controller.signal.aborted) return;
        setSlotsCache((c) => ({ ...c, [slotsKey]: { status: "error", message: error.message } }));
      });
    return () => controller.abort();
  }, [step, slotsKey, slotsState]);

  const refreshSlots = () => {
    if (!slotsKey) return;
    setSlotsCache((c) => {
      const next = { ...c };
      delete next[slotsKey];
      return next;
    });
  };

  const nextEnabledDay = (from: LocalDate): LocalDate | null => {
    for (let d = addDays(from, 1); daysBetween(d, lastDate) >= 0; d = addDays(d, 1)) {
      if (isDayEnabled(d)) return d;
    }
    return null;
  };

  // --- Избор ----------------------------------------------------------------------------------
  const chooseService = (id: string) => {
    setServiceId(id);
    setSlot(null);
    setNotice(null);
    goTo(barberId ? "den" : "brasnar");
  };

  const chooseBarber = (id: string) => {
    setBarberId(id);
    setSlot(null);
    setNotice(null);
    if (date && !(id === ANY ? barbers : barbers.filter((b) => b.id === id)).some((b) =>
      b.workingWeekdays.includes(isoWeekday(date)),
    )) {
      setDate(null);
    }
    goTo("den");
  };

  const chooseDate = (d: LocalDate) => {
    setDate(d);
    setSlot(null);
    setNotice(null);
    goTo("chas");
  };

  const chooseSlot = (s: SlotDto) => {
    setSlot(s);
    setNotice(null);
    goTo("danni");
  };

  const submitDetails = () => {
    const parsed = customerSchema.safeParse({ name: customer.name, phone: customer.phone, email: customer.email });
    const note = noteSchema.safeParse(customer.note);
    const next: Record<string, string> = {};
    if (!parsed.success) {
      for (const [k, v] of Object.entries(zodFieldErrors(parsed.error))) next[`customer.${k}`] = v;
    }
    if (!note.success) next.note = note.error.issues[0]?.message ?? "Невалидна бележка.";
    setErrors(next);
    if (Object.keys(next).length === 0) goTo("potvarzhdenie");
  };

  const confirm = () => {
    if (!service || !barberId || !slot) return;
    setNotice(null);
    startSubmit(async () => {
      const result = await createBookingAction({
        serviceId: service.id,
        barberId: barberId === ANY ? null : barberId,
        start: slot.start,
        customer: { name: customer.name, phone: customer.phone, email: customer.email },
        note: customer.note,
        website,
      });
      if (result.ok) {
        setSlot(null);
        router.push(`/chas/${result.token}?nov=1`);
        return;
      }
      if (result.code === "SLOT_UNAVAILABLE") {
        refreshSlots();
        setSlot(null);
        setNotice(result.message);
        goTo("chas");
        return;
      }
      if (result.fieldErrors) {
        setErrors(result.fieldErrors);
        if (Object.keys(result.fieldErrors).some((k) => k.startsWith("customer") || k === "note")) {
          goTo("danni");
          return;
        }
      }
      setNotice(result.message);
    });
  };

  // --- Изглед -----------------------------------------------------------------------------------
  const summary = (
    <dl className="mb-8 grid gap-x-6 gap-y-2 rounded-xl border border-line bg-bottle-950/60 p-4 text-sm sm:grid-cols-[auto_1fr]">
      {service && stepIndex > 0 && (
        <SummaryRow label="Услуга" onEdit={() => goTo("usluga")}>
          {service.name}, {formatDuration(service.durationMin)}, {formatPrice(service.priceCents)}
        </SummaryRow>
      )}
      {barberId && stepIndex > 1 && (
        <SummaryRow label="Бръснар" onEdit={() => goTo("brasnar")}>
          {barber ? barber.name : "Първият свободен"}
        </SummaryRow>
      )}
      {date && stepIndex > 2 && (
        <SummaryRow label="Ден" onEdit={() => goTo("den")}>
          {formatDateLong(date)}
        </SummaryRow>
      )}
      {slot && stepIndex > 3 && (
        <SummaryRow label="Час" onEdit={() => goTo("chas")}>
          {slot.time}
        </SummaryRow>
      )}
    </dl>
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-5 pb-32 pt-8 md:pt-12">
      <div className="mb-6 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => (stepIndex > 0 ? window.history.back() : router.push("/"))}
          className={buttonClass({ variant: "ghost", size: "sm", className: "-ml-3" })}
        >
          Назад
        </button>
        <p className="text-sm text-cream-faint">
          Стъпка {stepIndex + 1} от {STEPS.length}
        </p>
      </div>
      <ol className="mb-8 grid grid-cols-6 gap-1.5" aria-hidden>
        {STEPS.map((s, i) => (
          <li key={s.key} className={`h-1 rounded-full ${i <= stepIndex ? "bg-gold" : "bg-bottle-700"}`} />
        ))}
      </ol>

      <h1 className="font-display text-3xl text-cream md:text-4xl">{STEPS[stepIndex].title}</h1>
      <div className="mt-6">{stepIndex > 0 && step !== "potvarzhdenie" && summary}</div>

      {notice && (
        <p role="alert" className="mb-6 rounded-lg border border-oxblood/60 bg-oxblood/15 px-4 py-3 text-oxblood-bright">
          {notice}
        </p>
      )}

      {step === "usluga" && (
        <ul className="divide-y divide-line border-y border-line">
          {services.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => chooseService(s.id)}
                aria-pressed={s.id === serviceId}
                className="group -mx-3 block w-[calc(100%+1.5rem)] rounded-lg px-3 py-5 text-left transition-colors hover:bg-bottle-800 aria-pressed:bg-bottle-800"
              >
                <span className="flex items-baseline">
                  <span className="font-display text-xl text-cream group-hover:text-gold-bright">{s.name}</span>
                  <span className="leader" aria-hidden />
                  <span className="font-display text-xl text-gold tabular-nums">{formatPrice(s.priceCents)}</span>
                </span>
                <span className="mt-1.5 flex justify-between gap-6 text-sm">
                  <span className="text-cream-muted">{s.description}</span>
                  <span className="shrink-0 text-cream-faint">{formatDuration(s.durationMin)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {step === "brasnar" && (
        <ul className="space-y-3">
          <li>
            <ChoiceButton selected={barberId === ANY} onClick={() => chooseBarber(ANY)}>
              <span className="flex h-16 w-12 shrink-0 items-center justify-center rounded-t-full rounded-b-md border border-gold/35 font-display text-2xl text-gold">
                ?
              </span>
              <span>
                <span className="block font-display text-xl text-cream">Първият свободен</span>
                <span className="block text-sm text-cream-muted">Показваме всички свободни часове при всички бръснари.</span>
              </span>
            </ChoiceButton>
          </li>
          {barbers.map((b) => (
            <li key={b.id}>
              <ChoiceButton selected={barberId === b.id} onClick={() => chooseBarber(b.id)}>
                <BarberPortrait name={b.name} photoUrl={b.photoUrl} size="sm" className="h-16 w-12 shrink-0" />
                <span>
                  <span className="block font-display text-xl text-cream">{b.name}</span>
                  <span className="line-clamp-2 block text-sm text-cream-muted">{b.bio}</span>
                </span>
              </ChoiceButton>
            </li>
          ))}
        </ul>
      )}

      {step === "den" && (
        <div>
          <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-cream-faint">
            {WEEKDAY_HEADERS.map((d) => (
              <span key={d} className="pb-2">
                {d}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {calendar.map((d) => {
              const inRange = daysBetween(today, d) >= 0 && daysBetween(d, lastDate) >= 0;
              if (!inRange) return <span key={d} aria-hidden />;
              const enabled = isDayEnabled(d);
              const dayNum = Number(d.slice(8));
              const label = dayNum === 1 || d === today ? formatDayMonth(d) : String(dayNum);
              return (
                <button
                  key={d}
                  type="button"
                  disabled={!enabled}
                  onClick={() => chooseDate(d)}
                  aria-pressed={d === date}
                  aria-label={`${formatDateLong(d)}${enabled ? "" : ", няма свободни бръснари"}`}
                  className={`flex aspect-square flex-col items-center justify-center rounded-lg border text-sm tabular-nums transition-colors ${
                    d === date
                      ? "border-gold bg-gold text-bottle-950"
                      : enabled
                        ? "border-line bg-bottle-800 text-cream hover:border-gold/70"
                        : "border-transparent text-cream-faint/50 line-through"
                  }`}
                >
                  <span className={label.length > 2 ? "text-[0.7rem] leading-tight" : ""}>{label}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-4 text-sm text-cream-faint">
            Може да записваш до {maxDaysAhead} дни напред. Задрасканите дни са почивни.
          </p>
        </div>
      )}

      {step === "chas" && date && (
        <TimeStep
          state={slotsState}
          onPick={chooseSlot}
          selected={slot?.start ?? null}
          onRetry={refreshSlots}
          onNextDay={() => {
            const next = nextEnabledDay(date);
            if (next) chooseDate(next);
          }}
          hasNextDay={!!nextEnabledDay(date)}
        />
      )}

      {step === "danni" && (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submitDetails();
          }}
          className="space-y-5"
        >
          <Field label="Име" error={errors["customer.name"]}>
            <input
              name="name"
              autoComplete="name"
              value={customer.name}
              onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
              className={inputClass(!!errors["customer.name"])}
              required
            />
          </Field>
          <Field label="Телефон" hint="Ще ти се обадим само ако нещо се промени." error={errors["customer.phone"]}>
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="088 123 4567"
              value={customer.phone}
              onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
              className={inputClass(!!errors["customer.phone"])}
              required
            />
          </Field>
          <Field label="Имейл (по желание)" error={errors["customer.email"]}>
            <input
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={customer.email}
              onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
              className={inputClass(!!errors["customer.email"])}
            />
          </Field>
          <Field label="Бележка за бръснаря (по желание)" error={errors.note}>
            <textarea
              name="note"
              rows={3}
              maxLength={500}
              value={customer.note}
              onChange={(e) => setCustomer({ ...customer, note: e.target.value })}
              className={`${inputClass(!!errors.note)} h-auto py-3`}
            />
          </Field>
          {/* Капан за ботове: скрито от хората, ботовете го попълват. */}
          <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden>
            <label>
              Уебсайт
              <input
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </label>
          </div>
          <StickyBar>
            <button type="submit" className={buttonClass({ size: "lg", className: "w-full" })}>
              Напред
            </button>
          </StickyBar>
        </form>
      )}

      {step === "potvarzhdenie" && service && slot && date && (
        <div>
          <dl className="divide-y divide-line border-y border-line">
            <ReviewRow label="Услуга" value={service.name} />
            <ReviewRow label="Бръснар" value={barber ? barber.name : "Първият свободен"} />
            <ReviewRow label="Кога" value={`${formatDateLong(date)}, ${slot.time}`} />
            <ReviewRow label="Продължителност" value={formatDuration(service.durationMin)} />
            <ReviewRow label="Цена" value={formatPrice(service.priceCents)} />
            <ReviewRow label="Име" value={customer.name.trim()} />
            <ReviewRow label="Телефон" value={customer.phone.trim()} />
            {customer.email.trim() && <ReviewRow label="Имейл" value={customer.email.trim()} />}
            {customer.note.trim() && <ReviewRow label="Бележка" value={customer.note.trim()} />}
          </dl>
          <p className="mt-6 text-sm text-cream-muted">
            Плащаш в салона. След потвърждението ще получиш линк, през който можеш да откажеш часа.
          </p>
          <StickyBar>
            <button
              type="button"
              onClick={confirm}
              disabled={submitting}
              className={buttonClass({ size: "lg", className: "w-full" })}
            >
              {submitting ? "Записваме…" : "Потвърди записването"}
            </button>
          </StickyBar>
        </div>
      )}

      <p className="mt-16 text-center text-sm text-cream-faint">
        Предпочиташ да говориш с човек?{" "}
        <a href={props.salonPhoneHref} className="text-cream-muted underline-offset-4 hover:text-cream hover:underline">
          Обади се на {props.salonPhone}
        </a>
      </p>
    </div>
  );
}

function TimeStep({
  state,
  onPick,
  selected,
  onRetry,
  onNextDay,
  hasNextDay,
}: {
  state: SlotsState | undefined;
  onPick: (slot: SlotDto) => void;
  selected: string | null;
  onRetry: () => void;
  onNextDay: () => void;
  hasNextDay: boolean;
}) {
  if (!state) {
    return (
      <div className="grid grid-cols-4 gap-2" aria-busy="true" aria-label="Зареждане на свободните часове">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-bottle-800" />
        ))}
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="rounded-xl border border-line p-6">
        <p className="text-cream">{state.message}</p>
        <button type="button" onClick={onRetry} className={buttonClass({ variant: "secondary", className: "mt-4" })}>
          Зареди отново
        </button>
      </div>
    );
  }
  if (state.slots.length === 0) {
    return (
      <div className="rounded-xl border border-line p-6">
        <p className="text-cream">В този ден няма свободни часове за избраната услуга.</p>
        {hasNextDay && (
          <button type="button" onClick={onNextDay} className={buttonClass({ variant: "secondary", className: "mt-4" })}>
            Покажи следващия ден
          </button>
        )}
      </div>
    );
  }

  const groups = [
    { title: "Сутрин", slots: state.slots.filter((s) => s.time < "12:00") },
    { title: "След обяд", slots: state.slots.filter((s) => s.time >= "12:00" && s.time < "17:00") },
    { title: "Вечер", slots: state.slots.filter((s) => s.time >= "17:00") },
  ].filter((g) => g.slots.length > 0);

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.title}>
          <h2 className="mb-3 text-sm text-cream-muted">{group.title}</h2>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {group.slots.map((s) => (
              <button
                key={s.start}
                type="button"
                onClick={() => onPick(s)}
                aria-pressed={s.start === selected}
                className={`h-12 rounded-lg border text-base tabular-nums transition-colors ${
                  s.start === selected
                    ? "border-gold bg-gold text-bottle-950"
                    : "border-line bg-bottle-800 text-cream hover:border-gold/70"
                }`}
              >
                {s.time}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ChoiceButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full items-center gap-4 rounded-xl border p-3 text-left transition-colors ${
        selected ? "border-gold bg-bottle-800" : "border-line bg-bottle-900 hover:border-gold/60 hover:bg-bottle-800"
      }`}
    >
      {children}
    </button>
  );
}

function SummaryRow({ label, onEdit, children }: { label: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-cream-faint">{label}</dt>
      <dd className="flex items-baseline justify-between gap-3 text-cream">
        <span>{children}</span>
        <button type="button" onClick={onEdit} className="shrink-0 text-gold hover:text-gold-bright">
          Промени
        </button>
      </dd>
    </>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-6 py-3.5">
      <dt className="text-cream-muted">{label}</dt>
      <dd className="text-right text-cream">{value}</dd>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactElement;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-cream">{label}</span>
      {children}
      {error ? (
        <span role="alert" className="mt-1.5 block text-sm text-oxblood-bright">
          {error}
        </span>
      ) : (
        hint && <span className="mt-1.5 block text-sm text-cream-faint">{hint}</span>
      )}
    </label>
  );
}

export function inputClass(invalid = false) {
  return `block h-12 w-full rounded-[var(--radius-control)] border bg-bottle-950 px-4 text-base text-cream placeholder:text-cream-faint/70 focus:outline-none focus:ring-2 focus:ring-gold/60 ${
    invalid ? "border-oxblood-bright" : "border-line focus:border-gold/70"
  }`;
}

function StickyBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bottle-900/95 px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:static md:mt-8 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
      <div className="mx-auto max-w-2xl">{children}</div>
    </div>
  );
}
