# Мустак: онлайн записване за бръснарница

@AGENTS.md

Уеб приложение за измислената бръснарница „Мустак“: публичен сайт с онлайн записване на час, админ панел за собственика и защитено API за AI агент (n8n). Всичко работи на собствен сървър (Docker: Next.js + PostgreSQL). Как се пуска и как работи API-то: [README.md](README.md).

## Стек

- Next.js 16 (App Router, TypeScript, Tailwind v4), `output: "standalone"`, **Cache Components включени** (виж „Next.js 16“ по-долу)
- PostgreSQL 18, Drizzle ORM + drizzle-kit, драйвер `pg`
- Zod 4 за валидация, `@node-rs/argon2` за пароли, `@date-fns/tz` за часовата зона, `libphonenumber-js` за телефони
- Vitest; интеграционните тестове вдигат Postgres с Testcontainers
- Docker (multi-stage, non-root, read-only) + docker compose

## Правила

- **Текстовете в интерфейса са на български.** Грешките от валидацията и API-то също. Кодът и имената са на английски; коментарите може да са на български.
- **Без секрети в кода.** Всичко тайно идва от променливи на средата; новите променливи се добавят и в `.env.example`, `docker-compose.yml` и README.
- **Без външни услуги.** Без SaaS за данни, вход, анализи, карти или шрифтове по време на работа. CSP в `next.config.ts` позволява само собствения домейн; не го разхлабвайте. Снимките на бръснарите са само локални файлове от `public/`.
  - **Единственото изключение е Cloudflare Turnstile** (проверката „Не съм робот“ при записване), по решение на собственика. Тя е по избор: включва се само с `TURNSTILE_SITE_KEY` и `TURNSTILE_SECRET` и се зарежда само на последната стъпка от записването. Без ключовете сайтът не прави нищо към Cloudflare. CSP позволява само `https://challenges.cloudflare.com` за `script-src` и `frame-src`. Токенът се проверява на сървъра в `src/server/turnstile.ts` (fail closed: при грешка или липсваща връзка записването се отказва). Не добавяйте други външни услуги по този модел без изрично решение.
  - **Чат асистентът в n8n** също е по решение на собственика и по избор (`N8N_CHAT_WEBHOOK_URL`). Браузърът говори само с `/api/public/chat`; сървърът (`src/server/chat.ts`) препраща към Chat Trigger-а на n8n с Basic Auth. CSP не се променя: адресът на n8n никога не стига до браузъра. Балончето е наш React компонент (`src/components/site/chat-bubble.tsx`), който говори протокола на Chat Trigger-а (`sendMessage`, `sessionId`, `chatInput` → `output`). Не ползваме `@n8n/chat`: дърпа Vue и голяма част от пакетите на n8n с 16 уязвимости в `npm audit`. Отговорите на модела се рисуват от `src/lib/chat-markdown.ts` като React елементи, никога като HTML. Агентът в n8n ползва само `/api/v1` с `AGENT_API_KEY`; не му давайте инструменти, които четат или променят чужди данни (клиентът може да пише каквото си иска). Workflow-ът се генерира от `scripts/n8n-workflow.ts` (`npm run n8n:workflow -- <адрес>`) и данните от `business.ts`: при промяна в API-то или в правилата за записване обновете скрипта и генерирайте `n8n/mustak-chat-agent.json` наново. Версиите на възлите са в `NODE_VERSIONS` и трябва да ги има в n8n 1.123 (собственикът е на n8n 2.12.2): не ги вдигайте до най-новите. Подробно: [docs/n8n-chat-agent.md](docs/n8n-chat-agent.md).
- **Всяка промяна на базата е миграция.** Сменяте `src/server/db/schema.ts`, после `npm run db:generate` и commit-вате SQL файла от `drizzle/`. SQL, който Drizzle не описва (EXCLUDE ограничения и т.н.), е в ръчна миграция: `npx drizzle-kit generate --custom --name=...`. Никога не се пипа база на ръка и не се редактира приложена миграция.
- **Двойното записване се пази от базата** (ограничение `appointments_no_overlap` в `drizzle/0001_appointments_no_overlap.sql`). Не го махайте и не го заобикаляйте. Списъкът с активни статуси там трябва да съвпада с `activeAppointmentStatuses` в схемата.
- **Бизнес логиката е на едно място:** `src/server/booking/` (`service.ts` записва, отказва и сменя статуси; `availability.ts` е чистата функция за слотовете). Server Actions, админ панелът и API-то само валидират входа и викат тези функции. Не дублирайте логика в route handler-и или компоненти.
- **Времето:** в базата всичко е `timestamptz` (UTC). Всички изчисления и показване стават в `Europe/Sofia` чрез `src/lib/time.ts`. Не ползвайте `Date#getHours()`, `toLocaleString()` без зона и т.н.: тестовете вървят в `America/New_York`, за да хванат такива грешки.
- **Сигурност:** всяка админ страница, заявка и Server Action започва с `requireAdmin()` (proxy.ts проверява само дали има бисквитка). API route handler-ите започват с `authorizeAgent()`. Публичните действия минават през `rateLimit()`.
- Бизнес настройките (име, адрес, работно време на сайта, правила за записване) са в `src/config/business.ts`. Няма секрети там: файлът стига и до браузъра.
- **Всяка стъпка от разработката се записва в `docs/`, за да могат хората да повторят проекта.** Проектът е open source и служи за пример как се строи приложение с Claude Code. За всяка стъпка (нова функция, поправка, промяна на дизайна, инфраструктура, публикуване) обновете [docs/how-we-built-it.md](docs/how-we-built-it.md):
  - в „Следващите искания“ добавете точния текст на искането, както е дадено;
  - в таблицата с хронологията добавете ред: час, какво е направено, как е проверено;
  - ако е имало проблем, добавете в „На какво се натъкнахме“ какво се е случило и как е решено;
  - при по-голяма тема (напр. нова интеграция) напишете отделен файл в `docs/` и го свържете от `how-we-built-it.md`.

  Документацията влиза в същия commit като промяната. Стъпка без запис в `docs/` не е завършена.

## Next.js 16 с Cache Components

- Данни от базата никога не се четат при build. Функциите, които четат за страници, викат `await connection()` (или `cookies()` чрез `requireAdmin()`), а GET route handler-ите викат `connection()` или `authorizeAgent()` първо. `new Date()` в сървърен код за страници е само след `connection()`.
- Всичко, което чете заявката (searchParams, params, бисквитки, база), е в компонент вътре в `<Suspense>`. Статичната част на страницата е извън него.
- `usePathname()`/`useSearchParams()` в клиентски компоненти също са в `<Suspense>`.
- След промяна в Server Action: `refresh()` от `next/cache` (страниците не се кешират).
- Документацията за тази версия е в `node_modules/next/dist/docs/`.

## Структура

```
src/config/business.ts      бизнес настройки
src/app/(site)/             публичен сайт (/, /zapazi-chas, /chas/[token])
src/app/admin/              вход и админ панел (+ actions.ts, manage-actions.ts)
src/app/api/v1/             API за AI агента; src/app/api/public/ за формата и чата
src/server/booking/         бизнес логика: availability, service, schedule, manage, catalog
src/server/db/              схема, връзка, миграции, seed
src/server/auth/            пароли (argon2id) и сесии
src/server/api/agent.ts     проверка на API ключа и формат на отговорите
src/server/rate-limit.ts    лимити (брояч в Postgres)
src/server/chat.ts          препращане на чата към n8n
src/lib/                    time.ts, validation.ts, format.ts, labels.ts
src/components/             site/, booking/, admin/, ui/
drizzle/                    SQL миграции
scripts/                    migrate, seed, admin-password (bundle-ват се за Docker), n8n-workflow
n8n/                        генерираният n8n workflow за чат асистента
tests/unit, tests/integration
.github/workflows/          ci.yml (проверки за всеки PR), docker-publish.yml (образ в GHCR от main)
```

## Команди

```bash
npm run db:up        # Postgres за разработка на 127.0.0.1:5433
npm run db:migrate   # прилага миграциите
npm run db:seed      # администратор + примерни данни
npm run dev          # http://localhost:3000
npm test             # unit + интеграционни тестове (нужен е Docker)
npm run lint && npm run typecheck && npm run build
npm run n8n:workflow -- https://mustak.example   # генерира n8n/mustak-chat-agent.json
docker compose up --build   # целият стек, образът се прави от кода
docker compose pull && docker compose up -d   # целият стек с образа от GHCR (само amd64)
```

Преди commit: `npm run lint`, `npm run typecheck`, `npm test`. При промени по страниците и `npm run build` (хваща грешки в Cache Components, които dev не хваща). И запис на стъпката в `docs/how-we-built-it.md`.

Публичното repo е https://github.com/martin-key/mustak (клон `main`).

## CI/CD

- Всеки pull request към `main` минава през `.github/workflows/ci.yml`: lint, typecheck, unit и интеграционни тестове, build. Нова проверка се добавя там като npm скрипт, който работи и локално.
- Всеки commit в `main` пуска `.github/workflows/docker-publish.yml`: същите проверки, после образ `ghcr.io/martin-key/mustak` с тагове `latest` и `sha-<commit>`. Само с `GITHUB_TOKEN`, без други тайни.
- `docker-compose.yml` ползва този образ: `${APP_IMAGE}:${APP_IMAGE_TAG}`, по подразбиране `ghcr.io/martin-key/mustak:latest`. `build: .` остава, за да работи `--build` (и на arm64: образът в GHCR е само `linux/amd64`).
- Ръчното пускане на същия workflow иска версия в semver (`1.4.0`, `2.0.0-rc.1`, `v` отпред се маха) и добавя тага `<версия>` вместо `latest`. Версията се проверява в задачата `version` преди тестовете. Вече публикувана версия не се презаписва: всички публикувания са в една обща опашка (`concurrency: docker-publish`, не по клон), а проверката на тага продължава само при отговор „not found“ от регистъра (fail closed). Входът стига до скрипта само през `env`, никога директно с `${{ }}`.
- Действията (actions) са закачени към пълен commit SHA с коментар за версията. При обновяване сменете и двете.
- CI тръгва от чисто копие без `.env` и без `.next`. Затова `typecheck` първо пуска `next typegen` (генерира `PageProps`/`LayoutProps`), а build не бива да чете база.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
