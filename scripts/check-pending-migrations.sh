#!/bin/bash

# Exit on error
set -e

# Validate environment variables
if [ -z "$SUPABASE_DB_URL" ]; then
    echo "⚠️  Cannot check migrations without SUPABASE_DB_URL"
    exit 1
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
