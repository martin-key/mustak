# syntax=docker/dockerfile:1.7
#
# Образ на няколко етапа: зависимости → build → малък runtime образ само със standalone изхода
# на Next.js. Приложението работи като потребител без root.

ARG NODE_IMAGE=node:24-alpine

# --- 1. Зависимости ------------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# --- 2. Build ------------------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Next.js в standalone режим + самостоятелните скриптове за миграции и начални данни.
RUN npm run build && npm run build:scripts

# --- 3. Runtime ----------------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

# Файловете са собственост на root и само за четене за потребителя на приложението.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/dist-scripts ./scripts
COPY --chmod=755 docker/entrypoint.sh ./entrypoint.sh

# Единствената папка, в която Next.js може да пише по време на работа.
RUN mkdir -p .next/cache && chown nextjs:nodejs .next/cache

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./entrypoint.sh"]
