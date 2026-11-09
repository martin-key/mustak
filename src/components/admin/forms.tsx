"use client";

import { useActionState, useState, useTransition } from "react";
import {
  addTimeOffAction,
  saveBarberAction,
  saveServiceAction,
  saveWorkingHoursAction,
  type FormState,
} from "@/app/admin/(panel)/manage-actions";
import { buttonClass } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/ui/input";
import { WEEKDAY_NAMES } from "@/lib/time";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span role="alert" className="mt-1.5 block text-sm text-oxblood-bright">
      {message}
    </span>
  );
}

function FormMessage({ state }: { state: FormState }) {
  if (!state.message) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={`rounded-lg border px-4 py-3 text-sm ${
        state.ok ? "border-sage/50 bg-sage/10 text-sage" : "border-oxblood/60 bg-oxblood/15 text-oxblood-bright"
      }`}
    >
      {state.message}
    </p>
  );
}

function Checkbox({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center gap-2.5 text-cream">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 accent-[var(--color-gold)]" />
      {label}
    </label>
  );
}

// --- Услуга -------------------------------------------------------------------------------------

export interface ServiceFormValues {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  durationMin: number;
  isActive: boolean;
  sortOrder: number;
}

export function ServiceForm({ service }: { service?: ServiceFormValues }) {
  const [state, action, pending] = useActionState(saveServiceAction.bind(null, service?.id ?? null), {});
  const v = state.values;
  const e = state.errors ?? {};
  const price = service ? (service.priceCents / 100).toFixed(2).replace(".", ",") : "";

  return (
    <form action={action} className="max-w-xl space-y-5">
      <label className="block">
        <span className={labelClass}>Име</span>
        <input name="name" defaultValue={v?.name ?? service?.name} className={inputClass(!!e.name)} />
        <FieldError message={e.name} />
      </label>
      <label className="block">
        <span className={labelClass}>Описание</span>
        <textarea
          name="description"
          rows={3}
          defaultValue={v?.description ?? service?.description}
          className={inputClass(!!e.description, "h-auto py-3")}
        />
        <FieldError message={e.description} />
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className={labelClass}>Цена, €</span>
          <input name="price" inputMode="decimal" placeholder="25,00" defaultValue={v?.price ?? price} className={inputClass(!!e.price)} />
          <FieldError message={e.price} />
        </label>
        <label className="block">
          <span className={labelClass}>Продължителност, мин</span>
          <input
            name="durationMin"
            type="number"
            min={5}
            max={480}
            step={5}
            defaultValue={v?.durationMin ?? service?.durationMin ?? 30}
            className={inputClass(!!e.durationMin)}
          />
          <FieldError message={e.durationMin} />
        </label>
      </div>
      <label className="block max-w-40">
        <span className={labelClass}>Подредба в списъка</span>
        <input name="sortOrder" type="number" min={0} max={999} defaultValue={v?.sortOrder ?? service?.sortOrder ?? 0} className={inputClass()} />
      </label>
      <Checkbox name="isActive" label="Активна (вижда се на сайта и може да се записва)" defaultChecked={service?.isActive ?? true} />
      <FormMessage state={state} />
      <button type="submit" disabled={pending} className={buttonClass()}>
        {pending ? "Запазване…" : service ? "Запази промените" : "Добави услугата"}
      </button>
    </form>
  );
}

// --- Бръснар ------------------------------------------------------------------------------------

export interface BarberFormValues {
  id: string;
  name: string;
  bio: string;
  photoUrl: string | null;
  isActive: boolean;
  sortOrder: number;
}

export function BarberForm({ barber }: { barber?: BarberFormValues }) {
  const [state, action, pending] = useActionState(saveBarberAction.bind(null, barber?.id ?? null), {});
  const v = state.values;
  const e = state.errors ?? {};
  return (
    <form action={action} className="max-w-xl space-y-5">
      <label className="block">
        <span className={labelClass}>Име</span>
        <input name="name" defaultValue={v?.name ?? barber?.name} className={inputClass(!!e.name)} />
        <FieldError message={e.name} />
      </label>
      <label className="block">
        <span className={labelClass}>Кратко описание</span>
        <textarea name="bio" rows={3} defaultValue={v?.bio ?? barber?.bio} className={inputClass(!!e.bio, "h-auto py-3")} />
        <FieldError message={e.bio} />
      </label>
      <label className="block">
        <span className={labelClass}>Снимка (по желание)</span>
        <input
          name="photoUrl"
          placeholder="/barbers/ivan.jpg"
          defaultValue={v?.photoUrl ?? barber?.photoUrl ?? ""}
          className={inputClass(!!e.photoUrl)}
        />
        {e.photoUrl ? (
          <FieldError message={e.photoUrl} />
        ) : (
          <span className="mt-1.5 block text-sm text-cream-faint">
            Път до файл в папката public. Без снимка показваме инициалите.
          </span>
        )}
      </label>
      <label className="block max-w-40">
        <span className={labelClass}>Подредба</span>
        <input name="sortOrder" type="number" min={0} max={999} defaultValue={v?.sortOrder ?? barber?.sortOrder ?? 0} className={inputClass()} />
      </label>
      <Checkbox name="isActive" label="Активен (приема записвания)" defaultChecked={barber?.isActive ?? true} />
      <FormMessage state={state} />
      <button type="submit" disabled={pending} className={buttonClass()}>
        {pending ? "Запазване…" : barber ? "Запази профила" : "Добави бръснаря"}
      </button>
    </form>
  );
}

// --- Работно време ------------------------------------------------------------------------------

interface HoursRow {
  weekday: number;
  startTime: string;
  endTime: string;
}

export function WorkingHoursEditor({ barberId, initial }: { barberId: string; initial: HoursRow[] }) {
  const [rows, setRows] = useState<(HoursRow & { key: number })[]>(() =>
    initial.map((r, i) => ({ weekday: r.weekday, startTime: r.startTime.slice(0, 5), endTime: r.endTime.slice(0, 5), key: i })),
  );
  const [nextKey, setNextKey] = useState(initial.length);
  const [state, setState] = useState<FormState>({});
  const [pending, startTransition] = useTransition();

  const update = (key: number, patch: Partial<HoursRow>) => setRows((all) => all.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const add = (weekday: number) => {
    const last = rows.filter((r) => r.weekday === weekday).at(-1);
    setRows((all) => [
      ...all,
      { weekday, startTime: last ? last.endTime : "10:00", endTime: last ? "19:00" : "18:00", key: nextKey },
    ]);
    setNextKey((k) => k + 1);
  };
  const copyMondayToWeekdays = () => {
    const monday = rows.filter((r) => r.weekday === 1);
    let key = nextKey;
    const copies = [2, 3, 4, 5].flatMap((weekday) => monday.map((r) => ({ ...r, weekday, key: key++ })));
    setRows((all) => [...all.filter((r) => r.weekday === 1 || r.weekday > 5), ...copies]);
    setNextKey(key);
  };

  return (
    <div>
      <div className="divide-y divide-line border-y border-line">
        {[1, 2, 3, 4, 5, 6, 7].map((weekday) => {
          const day = rows.filter((r) => r.weekday === weekday);
          return (
            <div key={weekday} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start">
              <p className="w-32 shrink-0 pt-2 text-cream">{WEEKDAY_NAMES[weekday]}</p>
              <div className="flex-1 space-y-2">
                {day.length === 0 && <p className="pt-2 text-sm text-cream-faint">Почивен ден</p>}
                {day.map((r) => (
                  <div key={r.key} className="flex items-center gap-2">
                    <input
                      type="time"
                      step={300}
                      aria-label={`${WEEKDAY_NAMES[weekday]}, начало`}
                      value={r.startTime}
                      onChange={(e) => update(r.key, { startTime: e.target.value })}
                      className={inputClass(false, "h-10 w-32 [color-scheme:dark]")}
                    />
                    <span className="text-cream-faint">до</span>
                    <input
                      type="time"
                      step={300}
                      aria-label={`${WEEKDAY_NAMES[weekday]}, край`}
                      value={r.endTime}
                      onChange={(e) => update(r.key, { endTime: e.target.value })}
                      className={inputClass(false, "h-10 w-32 [color-scheme:dark]")}
                    />
                    <button
                      type="button"
                      onClick={() => setRows((all) => all.filter((x) => x.key !== r.key))}
                      className={buttonClass({ variant: "ghost", size: "sm" })}
                    >
                      Махни
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => add(weekday)} className={buttonClass({ variant: "secondary", size: "sm" })}>
                {day.length === 0 ? "Добави работно време" : "Добави интервал"}
              </button>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-sm text-cream-faint">Почивка за обяд: два интервала в един ден, напр. 10:00–14:00 и 15:00–19:00.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setState(await saveWorkingHoursAction(barberId, rows.map(({ weekday, startTime, endTime }) => ({ weekday, startTime, endTime }))));
            })
          }
          className={buttonClass()}
        >
          {pending ? "Запазване…" : "Запази работното време"}
        </button>
        <button type="button" onClick={copyMondayToWeekdays} className={buttonClass({ variant: "ghost" })}>
          Копирай понеделник във вторник–петък
        </button>
      </div>
      <div className="mt-4">
        <FormMessage state={state} />
      </div>
    </div>
  );
}

// --- Почивки ------------------------------------------------------------------------------------

export function TimeOffForm({ barberId, today }: { barberId: string; today: string }) {
  const [state, action, pending] = useActionState(addTimeOffAction.bind(null, barberId), {});
  const [allDay, setAllDay] = useState(true);
  const e = state.errors ?? {};
  return (
    <form action={action} className="max-w-xl space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className={labelClass}>От дата</span>
          <input type="date" name="fromDate" defaultValue={today} className={inputClass(!!e.fromDate, "[color-scheme:dark]")} />
          <FieldError message={e.fromDate} />
        </label>
        <label className="block">
          <span className={labelClass}>До дата (включително)</span>
          <input type="date" name="toDate" defaultValue={today} className={inputClass(!!e.toDate, "[color-scheme:dark]")} />
          <FieldError message={e.toDate} />
        </label>
      </div>
      <label className="flex items-center gap-2.5 text-cream">
        <input
          type="checkbox"
          name="allDay"
          checked={allDay}
          onChange={(ev) => setAllDay(ev.target.checked)}
          className="h-4 w-4 accent-[var(--color-gold)]"
        />
        Цели дни
      </label>
      {!allDay && (
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className={labelClass}>От час (първия ден)</span>
            <input type="time" name="fromTime" defaultValue="12:00" className={inputClass(!!e.fromTime, "[color-scheme:dark]")} />
            <FieldError message={e.fromTime} />
          </label>
          <label className="block">
            <span className={labelClass}>До час (последния ден)</span>
            <input type="time" name="toTime" defaultValue="14:00" className={inputClass(!!e.toTime, "[color-scheme:dark]")} />
            <FieldError message={e.toTime} />
          </label>
        </div>
      )}
      <label className="block">
        <span className={labelClass}>Причина (по желание)</span>
        <input name="reason" placeholder="Отпуск" className={inputClass(!!e.reason)} />
      </label>
      <FormMessage state={state} />
      <button type="submit" disabled={pending} className={buttonClass({ variant: "secondary" })}>
        {pending ? "Добавяне…" : "Добави почивка"}
      </button>
    </form>
  );
}

// --- Изтриване ----------------------------------------------------------------------------------

export function DeleteButton({
  action,
  label,
  confirmText,
}: {
  action: () => Promise<FormState>;
  label: string;
  confirmText: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={buttonClass({ variant: "ghost", className: "text-oxblood-bright" })}>
        {label}
      </button>
    );
  }
  return (
    <div className="rounded-lg border border-oxblood/60 bg-oxblood/10 p-4">
      <p className="text-sm text-cream">{confirmText}</p>
      {error && <p role="alert" className="mt-2 text-sm text-oxblood-bright">{error}</p>}
      <div className="mt-3 flex gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await action();
              if (result?.message) setError(result.message);
            })
          }
          className={buttonClass({ variant: "danger", size: "sm" })}
        >
          Да, изтрий
        </button>
        <button type="button" onClick={() => setConfirming(false)} className={buttonClass({ variant: "ghost", size: "sm" })}>
          Отказ
        </button>
      </div>
    </div>
  );
}
