#!/bin/bash

# Exit on error
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔄 Starting database migrations..."

# Load environment variables
if [ -f .env.local ]; then
    echo "📝 Loading environment from .env.local"
    set -a
    source .env.local
    set +a
elif [ -f .env ]; then
    echo "📝 Loading environment from .env"
    set -a
    source .env
    set +a
else
    echo -e "${RED}❌ No .env.local or .env file found${NC}"
    exit 1
fi

# Check for required variables
if [ -z "$SUPABASE_DB_URL" ] && [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    echo -e "${RED}❌ SUPABASE_DB_URL or NEXT_PUBLIC_SUPABASE_URL not set${NC}"
    exit 1
fi

# Construct database URL if not provided
if [ -z "$SUPABASE_DB_URL" ]; then
    if [ -z "$SUPABASE_DB_PASSWORD" ]; then
        echo -e "${RED}❌ SUPABASE_DB_PASSWORD not set (required for direct DB connection)${NC}"
        echo "💡 Set SUPABASE_DB_PASSWORD in .env.local or provide SUPABASE_DB_URL directly"
        exit 1
    fi
    
    # Extract project ref from SUPABASE_URL
    SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}"
    if [ -z "$SUPABASE_URL" ]; then
        echo -e "${RED}❌ NEXT_PUBLIC_SUPABASE_URL not set${NC}"
        exit 1
    fi
    
    PROJECT_REF=$(echo "$SUPABASE_URL" | sed -E 's|https://([^.]+)\.supabase\.co.*|\1|')
    
    if [ -z "$PROJECT_REF" ]; then
        echo -e "${RED}❌ Could not extract project ref from SUPABASE_URL${NC}"
        exit 1
    fi
    
    SUPABASE_DB_URL="postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.${PROJECT_REF}.supabase.co:5432/postgres"
    echo "🔗 Constructed database URL from environment variables"
fi

echo "🔍 Detecting PostgreSQL server version..."
# Test connection first
if ! psql "$SUPABASE_DB_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${RED}❌ Cannot connect to database${NC}"
    echo "💡 Check your SUPABASE_DB_URL or SUPABASE_DB_PASSWORD"
    echo "💡 URL format: postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres"
    exit 1
fi

SERVER_VERSION=$(psql "$SUPABASE_DB_URL" -t -c "SELECT substring(version() from 'PostgreSQL ([0-9]+)')" 2>/dev/null | tr -d ' ' || echo "")

if [ -z "$SERVER_VERSION" ]; then
    echo -e "${YELLOW}⚠️  Could not detect server version, defaulting to PostgreSQL 17${NC}"
    SERVER_VERSION="17"
else
    echo -e "${GREEN}✅ Detected PostgreSQL server version: $SERVER_VERSION${NC}"
fi

# Ensure we have the right PostgreSQL client version
if ! command -v psql >/dev/null 2>&1; then
    echo -e "${RED}❌ psql not found. Please install PostgreSQL client version $SERVER_VERSION${NC}"
    echo "💡 On macOS: brew install postgresql@$SERVER_VERSION"
    exit 1
fi

# Check psql version matches
INSTALLED_VERSION=$(psql --version | grep -oE '[0-9]+' | head -1)
if [ "$INSTALLED_VERSION" != "$SERVER_VERSION" ]; then
    echo -e "${YELLOW}⚠️  Warning: Installed PostgreSQL client version ($INSTALLED_VERSION) doesn't match server version ($SERVER_VERSION)${NC}"
    echo "💡 Consider installing matching version: brew install postgresql@$SERVER_VERSION"
fi

# Get list of applied migrations
echo "📋 Checking applied migrations..."
# Check if migrations table exists first
MIGRATIONS_TABLE_EXISTS=$(psql "$SUPABASE_DB_URL" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'migrations');" 2>/dev/null | tr -d ' ' || echo "f")

if [ "$MIGRATIONS_TABLE_EXISTS" = "t" ]; then
    APPLIED_MIGRATIONS=$(psql "$SUPABASE_DB_URL" -t -c "SELECT name FROM migrations ORDER BY applied_at;" 2>/dev/null | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | grep -v '^$' || echo "")
else
    echo "📝 Migrations table doesn't exist yet - will be created by first migration"
    APPLIED_MIGRATIONS=""
fi

# Find migration files
MIGRATIONS_DIR="migrations"
if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo -e "${RED}❌ Migrations directory not found${NC}"
    exit 1
fi

MIGRATION_FILES=$(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort || echo "")

if [ -z "$MIGRATION_FILES" ]; then
    echo -e "${YELLOW}⚠️  No migration files found in $MIGRATIONS_DIR${NC}"
    exit 0
fi

# Process each migration file
APPLIED_COUNT=0
NEW_COUNT=0
FAILED_COUNT=0

for MIGRATION_FILE in $MIGRATION_FILES; do
    MIGRATION_NAME=$(basename "$MIGRATION_FILE")
    
    # Check if already applied
    if echo "$APPLIED_MIGRATIONS" | grep -q "^$MIGRATION_NAME$"; then
        echo -e "${GREEN}✓${NC} $MIGRATION_NAME (already applied)"
        ((APPLIED_COUNT++))
        continue
    fi
    
    # Apply migration
    echo -e "${YELLOW}🔄 Applying: $MIGRATION_NAME${NC}"
    
    # Run migration and capture output
    MIGRATION_OUTPUT=$(psql "$SUPABASE_DB_URL" -f "$MIGRATION_FILE" 2>&1)
    MIGRATION_EXIT_CODE=$?
    
    if [ $MIGRATION_EXIT_CODE -eq 0 ]; then
        # Record migration (only if migrations table exists now)
        CHECKSUM=$(sha256sum "$MIGRATION_FILE" 2>/dev/null | cut -d' ' -f1 || shasum -a 256 "$MIGRATION_FILE" 2>/dev/null | cut -d' ' -f1 || echo "")
        
        if [ -n "$CHECKSUM" ]; then
            # Try to record migration, but don't fail if table doesn't exist yet
            psql "$SUPABASE_DB_URL" -c "INSERT INTO migrations (name, checksum) VALUES ('$MIGRATION_NAME', '$CHECKSUM') ON CONFLICT (name) DO NOTHING;" > /dev/null 2>&1 || true
        fi
        
        echo -e "${GREEN}✅ Applied: $MIGRATION_NAME${NC}"
        ((NEW_COUNT++))
    else
        echo -e "${RED}❌ Failed: $MIGRATION_NAME${NC}"
        echo -e "${RED}Error output:${NC}"
        echo "$MIGRATION_OUTPUT" | head -20
        ((FAILED_COUNT++))
        exit 1
    fi
done

echo ""
echo -e "${GREEN}🎉 Migration complete!${NC}"
echo "   Applied: $APPLIED_COUNT"
echo "   New: $NEW_COUNT"
if [ $FAILED_COUNT -gt 0 ]; then
    echo -e "   ${RED}Failed: $FAILED_COUNT${NC}"
    exit 1
fi
