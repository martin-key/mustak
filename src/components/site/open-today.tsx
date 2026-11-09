"use client";

import { useEffect, useState } from "react";
import { business } from "@/config/business";
import { isoWeekday, todayInSofia } from "@/lib/time";

/** „Днес: 10:00 – 20:00“ според работното време от конфигурацията. Смята се в браузъра. */
export function OpenToday({ className = "" }: { className?: string }) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const weekday = isoWeekday(todayInSofia());
    const entry = business.openingHours.find((h) => (h.weekdays as readonly number[]).includes(weekday));
    // Еднократно изчисление след зареждане, за да не се разминава с HTML-а от сървъра.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setText(entry?.hours ? `Днес работим ${entry.hours}` : "Днес салонът почива. Можеш да запазиш час за друг ден.");
  }, []);

  return (
    <p className={className} aria-live="polite">
      {text ?? " "}
    </p>
  );
}
