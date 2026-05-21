#!/bin/sh
set -e

echo "Running database migrations..."
node node_modules/.bin/typeorm migration:run -d dist/database/ormconfig.js

echo "Starting application..."
exec node dist/main
