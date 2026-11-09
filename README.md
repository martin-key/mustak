# Мустак: онлайн записване за бръснарница

![Началната страница на „Мустак“](docs/screenshots/home.jpg)

> Целият проект е направен за около час с [Claude Code](https://claude.com/claude-code): от празна папка до работещ Docker стек с тестове. Заданието, планът, стъпките и проблемите по пътя са описани в **[Как го направихме](docs/how-we-built-it.md)**, за да може да се повтори.

Уеб приложение за бръснарница „Мустак“ (измислен бизнес):

- **Публичен сайт** на български: услуги и цени в евро, бръснари, работно време, контакти и записване на час в 6 стъпки от телефона.
- **Админ панел** (`/admin`): графикът за деня и седмицата, статуси на часовете, ръчно добавяне на час, услуги, бръснари, работно време и почивни дни.
- **API за AI агент** (`/api/v1`): свободни часове, записване и списък с услугите, защитено с таен ключ.
- **Чат асистент** (по избор): балонче долу вдясно с AI агент в n8n, който отговаря за цени и записва час. Готовият workflow е в [`n8n/`](n8n/mustak-chat-agent.json).

Всичко работи на собствен сървър: Next.js + PostgreSQL в Docker. Няма външни услуги за данни, вход, анализи, карти или шрифтове. Изключенията са по избор: проверката „Не съм робот“ на Cloudflare Turnstile при записване (вижте [Защита от ботове](#защита-от-ботове-cloudflare-turnstile)) и чат асистентът в n8n, който праща разговора към езиков модел (вижте [Чат асистент](#чат-асистент-n8n)).

Името, адресът, контактите и правилата за записване се сменят в един файл: [`src/config/business.ts`](src/config/business.ts).

## Бърз старт с Docker

Нужни са Docker и Docker Compose.

```bash
cp .env.example .env
```

Отворете `.env` и попълнете `POSTGRES_PASSWORD`, `ADMIN_PASSWORD` и `AGENT_API_KEY`. Случайни стойности се генерират така:

```bash
openssl rand -hex 24
```

После изберете откъде да дойде образът на приложението:

- **Готовият образ** `ghcr.io/martin-key/mustak` от GitHub Container Registry. Не трябва build, нито кодът: стигат `docker-compose.yml` и `.env`. Образът е само за `linux/amd64` (обикновен сървър или компютър с Intel/AMD).

  ```bash
  docker compose pull && docker compose up -d
  ```

- **Образ от кода.** Работи на всяка архитектура, вкл. Mac с Apple Silicon и Raspberry Pi.

  ```bash
  docker compose up --build
  ```

  Локалният образ получава същото име като този от GHCR. На amd64 `docker compose pull` го заменя отново с публикувания.

Друга версия на образа се избира с `APP_IMAGE_TAG` в `.env` (`latest`, `1.4.0`, `sha-<commit>`), а друг образ (напр. от fork) с `APP_IMAGE`. Таговете са описани в [CI/CD](#cicd-github-actions).

При всяко стартиране контейнерът прилага миграциите и зарежда началните данни, ако липсват. При първото пускане това са администраторът и примерните данни: 6 услуги, 3 бръснари, работно време и няколко часа за днес и следващите два дни.

- Сайт: http://localhost:3000
- Админ панел: http://localhost:3000/admin (имейл и парола от `ADMIN_EMAIL` / `ADMIN_PASSWORD`)

**От телефон в същата мрежа** отворете `http://<IP-то на компютъра>:3000`. Задайте същия адрес в `APP_URL`, за да са верни линковете за отказ в отговорите на API-то.

Данните се пазят във volume `pgdata`. Пълно нулиране (изтрива всички данни): `docker compose down -v`.

## Администратор

- Първият администратор се създава при първото зареждане на данни от `ADMIN_EMAIL`, `ADMIN_PASSWORD` (поне 12 символа) и `ADMIN_NAME`, само ако в базата още няма администратор. След това паролата може да се махне от `.env`.
- Паролите се пазят само като argon2id хеш. Сесията е случаен токен в httpOnly бисквитка, а в базата е само неговият SHA-256. Бисквитката получава флаг `Secure`, когато `APP_URL` започва с `https://`.
- Смяна на забравена парола (или нов администратор): задайте новата парола в `ADMIN_PASSWORD` в `.env` и пуснете:

  ```bash
  docker compose run --rm --entrypoint node app scripts/admin-password.mjs
  ```

  Локално: `npm run admin:password`. Всички стари сесии на този администратор се прекратяват.

## Локална разработка

Нужни са Node.js 22+ и Docker (за базата).

```bash
npm install
cp .env.example .env   # попълнете паролите; DATABASE_URL сочи към localhost:5433
npm run db:up          # Postgres само на 127.0.0.1:5433
npm run db:migrate
npm run db:seed
npm run dev            # http://localhost:3000
```

| Команда | Какво прави |
| --- | --- |
| `npm run dev` | dev сървър |
| `npm run build` | production build (standalone) |
| `npm test` | unit + интеграционни тестове (интеграционните вдигат Postgres в Docker) |
| `npm run test:unit` | само unit тестове, без Docker |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run db:generate` | нова миграция след промяна в `src/server/db/schema.ts` |
| `npm run db:migrate` / `npm run db:seed` | миграции / начални данни |
| `npm run admin:password` | смяна на парола на администратор |

Интеграционните тестове стартират `postgres:18-alpine` с Testcontainers. Без Docker задайте `TEST_DATABASE_URL` към празна тестова база. Тестовете я изчистват!

## Как се пази от двойно записване

В базата има ограничение, което не позволява два активни часа на един бръснар да се припокриват:

```sql
EXCLUDE USING gist (barber_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)
  WHERE (status IN ('booked', 'confirmed', 'arrived'))
```

Дори два клиента да натиснат „Потвърди“ в една и съща милисекунда, базата приема само единия. Другият получава „Този час току-що беше зает“ и нов списък със свободни часове. При „Първият свободен“ системата пробва следващия свободен бръснар. Отказаните и неявилите се часове не заемат времето. Тестът `tests/integration/booking.test.ts` пуска 20 едновременни заявки за един час и проверява, че минава точно една.

Всички часове се пазят в UTC и се показват и изчисляват в `Europe/Sofia`, включително в дните, когато се сменя лятното и зимното време.

## API за AI агента

Всички заявки изискват хедър `X-API-Key` със стойността на `AGENT_API_KEY` (поне 32 символа). Ако ключът не е зададен, API-то връща `503` и е изключено. Endpoint-ите ползват същата бизнес логика като сайта.

Примерите приемат `BASE=http://localhost:3000` и `KEY=<AGENT_API_KEY>`.

### Списък с услугите

```bash
curl -s -H "X-API-Key: $KEY" "$BASE/api/v1/services"
```

```json
{
  "services": [
    {
      "id": "6f0c…",
      "name": "Мъжко подстригване",
      "description": "Консултация, измиване, подстригване…",
      "durationMinutes": 45,
      "price": "25.00",
      "priceCents": 2500,
      "currency": "EUR"
    }
  ]
}
```

### Бръснари

```bash
curl -s -H "X-API-Key: $KEY" "$BASE/api/v1/barbers"
```

Връща `id`, `name`, `bio` и `workingWeekdays` (1 = понеделник … 7 = неделя).

### Свободни часове

```bash
curl -s -H "X-API-Key: $KEY" \
  "$BASE/api/v1/availability?serviceId=<id>&date=2026-11-12&barberId=<id>"
```

`barberId` не е задължителен: без него се връщат часовете при всички бръснари.

```json
{
  "date": "2026-11-12",
  "timezone": "Europe/Sofia",
  "service": { "id": "6f0c…", "name": "Мъжко подстригване", "durationMinutes": 45, "price": "25.00", "priceCents": 2500, "currency": "EUR" },
  "barberId": null,
  "slots": [
    {
      "start": "2026-11-12T10:00:00+02:00",
      "end": "2026-11-12T10:45:00+02:00",
      "time": "10:00",
      "barbers": [{ "id": "b1…", "name": "Иван Петров" }, { "id": "b3…", "name": "Георги Стоянов" }]
    }
  ]
}
```

### Записване на час

```bash
curl -s -X POST "$BASE/api/v1/bookings" \
  -H "X-API-Key: $KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: n8n-execution-12345" \
  -d '{
    "serviceId": "<id>",
    "barberId": "<id или null за първия свободен>",
    "start": "2026-11-12T10:00",
    "customer": { "name": "Петър Петров", "phone": "0888 123 456", "email": "petar@example.com" },
    "note": "Записан от AI агента"
  }'
```

- `start` е `start` от свободните часове (ISO с отместване) или местно време в София без отместване (`2026-11-12T10:00`).
- Телефонът се нормализира до `+359…`. Имейлът и бележката не са задължителни.
- `Idempotency-Key` не е задължителен, но се препоръчва. Повторна заявка със същия ключ (напр. повторен опит от n8n) връща вече създадения час със статус `200` и `"replayed": true`, вместо да създаде втори.

Отговор `201`:

```json
{
  "booking": {
    "id": "a7e1…",
    "status": "booked",
    "start": "2026-11-12T10:00:00+02:00",
    "end": "2026-11-12T10:45:00+02:00",
    "date": "2026-11-12",
    "time": "10:00",
    "timezone": "Europe/Sofia",
    "service": { "id": "6f0c…", "name": "Мъжко подстригване", "durationMinutes": 45, "price": "25.00", "priceCents": 2500, "currency": "EUR" },
    "barber": { "id": "b1…", "name": "Иван Петров" },
    "customer": { "name": "Петър Петров", "phone": "+359888123456", "email": "petar@example.com" },
    "note": "Записан от AI агента",
    "cancelUrl": "http://localhost:3000/chas/Xy3…"
  },
  "replayed": false
}
```

`cancelUrl` е личният линк на клиента. През него той вижда часа и може да го откаже. Агентът може да го изпрати на клиента. При повторена заявка (`replayed: true`) линкът не се връща отново, защото в базата се пази само хешът му.

### Грешки

Формат: `{ "error": { "code": "...", "message": "съобщение на български", "details": { ... } } }`.

| HTTP | code | Кога |
| --- | --- | --- |
| 400 | `INVALID_JSON` | тялото не е JSON |
| 401 | `UNAUTHORIZED` | липсва или грешен `X-API-Key` |
| 404 | `SERVICE_NOT_FOUND`, `BARBER_NOT_FOUND` | неактивна или несъществуваща услуга / бръснар |
| 409 | `SLOT_UNAVAILABLE` | часът е зает или извън работното време |
| 409 | `TOO_MANY_BOOKINGS` | телефонът вече има 3 бъдещи часа |
| 422 | `VALIDATION_ERROR` | невалидни данни, `details` е по полета |
| 422 | `DATE_OUT_OF_RANGE` | датата е в миналото или след 30 дни напред |
| 429 | `RATE_LIMITED` | твърде много заявки, вижте хедъра `Retry-After` |
| 503 | `API_DISABLED` | `AGENT_API_KEY` не е зададен |

### Лимити (rate limiting)

| Какво | Лимит |
| --- | --- |
| API, на IP (преди проверката на ключа) | 120 заявки / минута |
| API, на ключ | 60 заявки / минута |
| API записвания, на ключ | 10 / минута |
| Публична форма за записване, на IP | 5 / 10 минути (+ 60 / час общо и скрито поле срещу ботове) |
| Свободни часове от сайта, на IP | 60 / минута |
| Вход в админ панела | 5 опита / 15 минути на IP+имейл, 20 на IP |
| Чат асистент, на IP | 30 съобщения / 10 минути (+ 600 / час общо) |

Броячите са в PostgreSQL, затова работят и при няколко инстанции. Лимитите са в `src/server/rate-limit.ts`.

## Защита от ботове (Cloudflare Turnstile)

По избор на последната стъпка от записването („Провери и потвърди“) може да се показва проверката „Не съм робот“ на [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/). Тя спира автоматичните записвания, без да кара хората да разпознават картинки: в режим Managed повечето посетители минават без да натискат нищо.

Как работи:

1. Браузърът зарежда widget-а само на стъпката за потвърждение и получава еднократен токен.
2. Server Action-ът за записване първо валидира данните, после проверява токена на сървъра срещу `siteverify` на Cloudflare и чак тогава записва часа.
3. Приема се само `success: true` с действие `booking` и адрес на сайта от разрешените. Ако Cloudflare не отговори, записването се отказва (fail closed) с молба да се опита отново или да се обади в салона.
4. Всеки токен е за един опит. След неуспешен опит widget-ът се пресъздава с нов токен.

Включване:

1. В таблото на Cloudflare: **Turnstile → Add widget**, режим **Managed**, домейнът на сайта (за локален тест и `localhost`).
2. В `.env`:

   ```bash
   TURNSTILE_SITE_KEY=<site key>
   TURNSTILE_SECRET=<secret key>
   TURNSTILE_HOSTNAMES=mustak.example   # по подразбиране: адресът от APP_URL
   ```

3. Рестартирайте приложението (`docker compose up -d`).

За локален тест без акаунт ползвайте публичните тестови ключове на Cloudflare: `TURNSTILE_SITE_KEY=1x00000000000000000000AA` и `TURNSTILE_SECRET=1x0000000000000000000000000000000AA` (винаги минават) или `TURNSTILE_SECRET=2x0000000000000000000000000000000AA` (винаги отказва).

Без двата ключа защитата е изключена и сайтът не прави нищо към Cloudflare. API-то за AI агента и админ панелът не минават през Turnstile: те са защитени с ключ и с вход. Turnstile допълва, но не заменя лимитите на заявките, скритото поле срещу ботове и лимита от 3 бъдещи часа на телефон.

Поверителност: когато е включена, Cloudflare обработва технически данни от браузъра на посетителя на стъпката за потвърждение. Споменете го в политиката за поверителност на сайта.

## Чат асистент (n8n)

По избор сайтът показва чат балонче долу вдясно. Зад него стои AI агент в [n8n](https://n8n.io), който отговаря за цени и бръснари, търси свободни часове и записва час през API-то по-горе. Готовият workflow е в [`n8n/mustak-chat-agent.json`](n8n/mustak-chat-agent.json), а пълното ръководство е в **[docs/n8n-chat-agent.md](docs/n8n-chat-agent.md)**.

Накратко:

1. `npm run n8n:workflow -- https://<адресът на сайта>` генерира workflow-а с вашия адрес и данните от `business.ts`.
2. Импортирайте го в n8n и създайте 3 credentials: `X-API-Key` с `AGENT_API_KEY`, Basic Auth за чата и ключ за модела (Anthropic по подразбиране).
3. Публикувайте го и сложете Production URL на чата и Basic Auth в `.env`:

   ```bash
   N8N_CHAT_WEBHOOK_URL=https://n8n.example.com/webhook/<id>/chat
   N8N_CHAT_USERNAME=...
   N8N_CHAT_PASSWORD=...
   ```

Браузърът говори само с `/api/public/chat` на сайта, а сървърът препраща към n8n. Адресът и паролата на n8n не стигат до браузъра, а CSP остава само за собствения домейн. Без `N8N_CHAT_WEBHOOK_URL` балончето не се показва. Разговорът (вкл. име и телефон) минава през n8n и доставчика на модела: споменете го в политиката за поверителност.

## Продукция

- Пуснете приложението зад reverse proxy с HTTPS (Caddy, nginx) и задайте `APP_URL=https://…`. Пример с Caddy:

  ```
  mustak.example {
    reverse_proxy localhost:3000
  }
  ```

  Rate limiting-ът разпознава клиента по последния адрес в `X-Forwarded-For`, затова прокси сървърът трябва да задава този хедър (Caddy и nginx го правят).
- В контейнера приложението работи като потребител без root, с файлова система само за четене и без Linux capabilities. Postgres е във вътрешна Docker мрежа без публикуван порт и без достъп до интернет.
- Архив на базата:

  ```bash
  docker compose exec db pg_dump -U mustak mustak > backup.sql
  ```

## CI/CD (GitHub Actions)

Има два workflow-а в [`.github/workflows/`](.github/workflows/):

| Кога | Workflow | Какво прави |
| --- | --- | --- |
| Pull request към `main` | [`ci.yml`](.github/workflows/ci.yml) („Тестове“) | Lint, проверка на типовете, unit и интеграционни тестове (истински PostgreSQL през Testcontainers) и `npm run build`. Нищо не се публикува. |
| Commit в `main` | [`docker-publish.yml`](.github/workflows/docker-publish.yml) („Docker образ“) | Пуска същите проверки, после прави Docker образа (linux/amd64) и го качва в GitHub Container Registry. Ако проверките паднат, образът не се публикува. |
| Ръчно, с версия | [`docker-publish.yml`](.github/workflows/docker-publish.yml) („Docker образ“) | Същото, но образът получава и тага на въведената версия (напр. `1.4.0`). |

Не трябват тайни: публикуването ползва вградения `GITHUB_TOKEN` с право `packages: write`. Всяко действие (action) е закачено към конкретен commit (SHA), а не към таг, който може да се премести.

Образът е `ghcr.io/martin-key/mustak` (във fork: `ghcr.io/<вашият-акаунт>/<repo>`) и има тези тагове:

- `latest`: последният commit в `main`;
- `sha-<първите 7 знака от commit-а>`: конкретен commit, за връщане назад;
- `1.4.0` и т.н.: версия, публикувана ръчно (вижте по-долу).

**Версия по избор.** Actions → „Docker образ“ → Run workflow. В „Use workflow from“ изберете клона (обикновено `main`), а в полето за версия въведете semver: `1.4.0`, `2.0.0-rc.1` или `v1.4.0` (`v` отпред се маха, тагът е `1.4.0`). Workflow-ът:

- спира веднага при невалидна версия (напр. `1.4`, `01.2.3` или `1.2.3+build`: Docker таговете не позволяват `+`);
- пуска тестовете и прави образа с тагове `<версия>` и `sha-<commit>`; `latest` не се мести;
- отказва да публикува версия, която вече съществува: публикуваната версия не се презаписва с друг код. Ако регистърът не отговори ясно, че версията я няма (мрежа, права), run-ът също спира. Затова първата версия се пуска, след като поне един commit в `main` е създал пакета;
- всички публикувания (от `main` и ръчните, от всеки клон) чакат в една опашка. Ако чакат няколко, GitHub пази само най-новия, а по-старият чакащ run се отказва (cancelled) и се пуска отново.

От терминала: `gh workflow run docker-publish.yml -f version=1.4.0`.

**Пускане на сървъра без build.** `docker-compose.yml` вече ползва този образ (`APP_IMAGE` и `APP_IMAGE_TAG` в `.env`, по подразбиране `ghcr.io/martin-key/mustak:latest`). На сървъра трябват само `docker-compose.yml` и `.env`. Обновяване до последната версия:

```bash
docker compose pull && docker compose up -d
```

Миграциите се прилагат автоматично при стартиране. За конкретна версия задайте `APP_IMAGE_TAG=1.4.0` (или `sha-…` за връщане назад) и пуснете същата команда. Във fork задайте `APP_IMAGE=ghcr.io/<вашият-акаунт>/<repo>`.

**Еднократни настройки в GitHub:**

- След първото публикуване пакетът се вижда в профила (Packages → `mustak`). Ако е частен, сървърът влиза с `docker login ghcr.io` и personal access token с право `read:packages`. Публичен образ: Package settings → Change visibility → Public.
- За да не се слива PR с червени тестове, задайте правило за `main` (Settings → Rules → Rulesets или Settings → Branches) с „Require status checks to pass“ и проверката „Lint, типове, тестове, build“.

## Структура

```
src/
  config/business.ts       име, контакти, работно време на сайта, правила за записване
  app/(site)/              публичен сайт: начало, /zapazi-chas, /chas/[token]
  app/admin/               вход и админ панел
  app/api/v1/              API за AI агента
  app/api/public/          свободни часове за формата и чатът към n8n
  server/booking/          бизнес логиката: слотове, записване, отказ, управление
  server/db/               Drizzle схема, връзка, миграции, начални данни
  server/auth/             пароли и сесии
  lib/                     време (Europe/Sofia), валидация, форматиране
drizzle/                   SQL миграции (вкл. ограничението срещу двойно записване)
scripts/                   migrate, seed, смяна на парола, генериране на n8n workflow-а
n8n/                       готовият workflow за чат асистента
tests/unit, tests/integration
.github/workflows/         CI: тестове за pull request, Docker образ в GHCR от main
```

Подробните правила за разработка са в [CLAUDE.md](CLAUDE.md).

## Снимки

| Записване от телефон | Админ панел, „Днес“ |
| --- | --- |
| ![Избор на час на телефон](docs/screenshots/booking-mobile.jpg) | ![Графикът за деня по бръснари](docs/screenshots/admin-today.jpg) |

## Лиценз

[MIT](LICENSE). „Мустак“ е измислен бизнес; адресът, телефоните и хората в примерните данни са измислени.
