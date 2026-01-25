#!/bin/bash

# Exit on error
set -e

BACKUP_DIR="${1:-database/backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/backup_${TIMESTAMP}.sql"
METADATA_FILE="$BACKUP_DIR/backup_${TIMESTAMP}.metadata.json"

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
        echo "❌ Cannot create backup without database connection"
        exit 1
    fi
    
    SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}"
    PROJECT_REF=$(echo "$SUPABASE_URL" | sed -E 's|https://([^.]+)\.supabase\.co.*|\1|')
    SUPABASE_DB_URL="postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.${PROJECT_REF}.supabase.co:5432/postgres"
fi

mkdir -p "$BACKUP_DIR"

echo "💾 Creating database backup..."

# Create backup
pg_dump "$SUPABASE_DB_URL" > "$BACKUP_FILE"

# Create metadata
cat > "$METADATA_FILE" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "date": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "git_sha": "${GITHUB_SHA:-local}",
  "git_ref": "${GITHUB_REF:-local}",
  "run_id": "${GITHUB_RUN_ID:-local}",
  "backup_file": "$(basename "$BACKUP_FILE")"
}
EOF

echo "✅ Backup created: $BACKUP_FILE"
echo "✅ Metadata created: $METADATA_FILE"
