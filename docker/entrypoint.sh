#!/bin/sh
# При всяко стартиране: миграции → начални данни (само ако липсват) → сървър.
set -e

node scripts/migrate.mjs
node scripts/seed.mjs

exec node server.js
