#!/bin/sh
set -e

echo "Broken Panel: syncing database schema..."
npx prisma db push --skip-generate

if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
  echo "Broken Panel: ensuring admin user exists..."
  npx tsx prisma/seed.ts
fi

exec "$@"
