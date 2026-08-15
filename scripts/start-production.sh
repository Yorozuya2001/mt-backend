#!/bin/sh
set -e

echo "MT API boot: PORT=${PORT:-unset} NODE_ENV=${NODE_ENV:-unset}"

if [ ! -f dist/src/main.js ]; then
  echo "ERROR: dist/src/main.js not found — build may have failed"
  ls -la dist/ 2>/dev/null || echo "dist/ missing"
  exit 1
fi

npx prisma migrate deploy
exec node dist/src/main.js
