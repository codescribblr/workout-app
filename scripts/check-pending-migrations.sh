#!/bin/bash

# Exit on error
set -e

# Load environment variables
if [ -f .env.local ]; then
    set -a
    source .env.local
    set +a
elif [ -f .env ]; then
    set -a
    source .env
    set +a
fi

# Construct database URL if not provided
if [ -z "$SUPABASE_DB_URL" ]; then
    if [ -z "$SUPABASE_DB_PASSWORD" ] || [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
        echo "⚠️  Cannot check migrations without database connection"
        exit 1
    fi
    
    SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}"
    PROJECT_REF=$(echo "$SUPABASE_URL" | sed -E 's|https://([^.]+)\.supabase\.co.*|\1|')
    SUPABASE_DB_URL="postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.${PROJECT_REF}.supabase.co:5432/postgres"
fi

# Check if migrations table exists
if ! psql "$SUPABASE_DB_URL" -t -c "SELECT 1 FROM migrations LIMIT 1;" > /dev/null 2>&1; then
    echo "📋 Migrations table doesn't exist - migrations needed"
    exit 0
fi

# Get applied migrations
APPLIED_MIGRATIONS=$(psql "$SUPABASE_DB_URL" -t -c "SELECT name FROM migrations ORDER BY applied_at;" 2>/dev/null | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | grep -v '^$' || echo "")

# Get migration files
MIGRATION_FILES=$(ls -1 migrations/*.sql 2>/dev/null | xargs -n1 basename | sort || echo "")

# Check if there are unapplied migrations
for MIGRATION_FILE in $MIGRATION_FILES; do
    if ! echo "$APPLIED_MIGRATIONS" | grep -q "^$MIGRATION_FILE$"; then
        exit 0  # Found pending migration
    fi
done

exit 1  # No pending migrations
