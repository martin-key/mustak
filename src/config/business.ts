/**
 * Всичко, което описва бизнеса, е на едно място.
 * За да смените името, адреса, контактите или правилата за записване,
 * редактирайте само този файл.
 *
 * Тук няма секрети: файлът се ползва и в браузъра.
 */
export const business = {
  name: "Мустак",
  legalName: "Бръснарница „Мустак“",
  /** Вторият ред на табелата под името. */
  signLine: "бръснарница в центъра на София",
  description:
    "Бръснарница в центъра на София. Подстригване, оформяне на брада и бръснене с бръснач и горещи кърпи. Запази час онлайн по всяко време.",

  phone: "+359 88 123 4567",
  phoneHref: "tel:+359881234567",
  email: "zdravei@mustak.example",

  address: {
    street: "ул. „Примерна“ 12",
    city: "София",
    postalCode: "1000",
    note: "До спирката на трамвай 12, влизане откъм двора.",
  },
  /** Само линк. Не вграждаме външни карти. */
  mapUrl: "https://www.openstreetmap.org/?mlat=42.6977&mlon=23.3219#map=18/42.6977/23.3219",

  social: {
    instagram: "https://instagram.com/mustak.example",
    facebook: "https://facebook.com/mustak.example",
  },

  /** Работно време на салона за сайта (hours: null = почивен ден). Свободните часове се смятат от графика на всеки бръснар. */
  openingHours: [
    { days: "Понеделник – Петък", weekdays: [1, 2, 3, 4, 5], hours: "10:00 – 20:00" },
    { days: "Събота", weekdays: [6], hours: "10:00 – 16:00" },
    { days: "Неделя", weekdays: [7], hours: null },
  ],

  timezone: "Europe/Sofia",
  locale: "bg-BG",
  currency: "EUR",

  booking: {
    /** През колко минути започват свободните часове. */
    slotStepMinutes: 15,
    /** Най-рано колко минути от сега може да се запише час. */
    minLeadMinutes: 60,
    /** До колко дни напред може да се записва. */
    maxDaysAhead: 30,
    /** До колко минути преди началото клиентът може сам да откаже часа. */
    cancelMinNoticeMinutes: 120,
    /** Най-много бъдещи активни часа на един телефонен номер (онлайн и през API). */
    maxActiveBookingsPerPhone: 3,
  },
} as const;

export type Business = typeof business;
