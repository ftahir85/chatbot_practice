#!/bin/sh
set -e

MIGRATION_PATH="/docker-entrypoint-initdb.d/migrations"

# Wait for Postgres to be ready
until psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c '\q' 2>/dev/null; do
  echo "Waiting for Postgres..."
  sleep 2
done

echo "Running migrations..."
for file in "$MIGRATION_PATH"/*.sql; do
  echo "Applying $file..."
  psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f "$file"
done

echo "All migrations applied successfully!"
