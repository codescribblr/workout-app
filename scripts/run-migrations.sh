#!/bin/bash

# Database Migration Runner
# This script runs all SQL migration files against Supabase
#
# Usage:
# ./scripts/run-migrations.sh
#
# Environment Variables Required:
# SUPABASE_DB_URL - PostgreSQL connection string
# Format: postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres

set -e # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MIGRATIONS_DIR="migrations"
MIGRATIONS_TABLE="migrations"

# Validate environment variables
if [ -z "$SUPABASE_DB_URL" ]; then
  echo -e "${RED}❌ Error: SUPABASE_DB_URL environment variable is not set${NC}"
  echo ""
  echo "Get your database URL from Supabase:"
  echo "1. Go to Project Settings > Database"
  echo "2. Copy the 'Connection string' under 'Connection pooling'"
  echo "3. Replace [YOUR-PASSWORD] with your database password"
  echo ""
  echo "Example:"
  echo "export SUPABASE_DB_URL='postgresql://postgres:your-password@db.xxx.supabase.co:5432/postgres'"
  exit 1
fi

echo -e "${BLUE}🚀 Starting database migrations...${NC}\n"

# Create migrations tracking table if it doesn't exist
echo -e "${YELLOW}📊 Creating migrations tracking table...${NC}"
if ! psql "$SUPABASE_DB_URL" -c "
 CREATE TABLE IF NOT EXISTS $MIGRATIONS_TABLE (
 id SERIAL PRIMARY KEY,
 name VARCHAR(255) UNIQUE NOT NULL,
 applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
 checksum VARCHAR(64) NOT NULL
 );
" 2>&1; then
 echo -e "${RED}❌ Failed to create migrations table${NC}"
 echo -e "${RED} Check your SUPABASE_DB_URL and database connection${NC}"
 exit 2
fi

echo -e "${GREEN}✓${NC} Migrations table ready\n"

# Get list of executed migrations
EXECUTED_MIGRATIONS=$(psql "$SUPABASE_DB_URL" -t -c "SELECT name FROM $MIGRATIONS_TABLE ORDER BY name;" 2>/dev/null | tr -d ' ')

# Count executed migrations
EXECUTED_COUNT=$(echo "$EXECUTED_MIGRATIONS" | grep -c . || echo "0")
echo -e "${GREEN}✓${NC} Found $EXECUTED_COUNT previously executed migrations\n"

# Get all migration files
MIGRATION_FILES=$(ls -1 $MIGRATIONS_DIR/*.sql 2>/dev/null | sort)

if [ -z "$MIGRATION_FILES" ]; then
 echo -e "${RED}❌ No migration files found in $MIGRATIONS_DIR/${NC}"
 exit 1
fi

# Count total migrations
TOTAL_COUNT=$(echo "$MIGRATION_FILES" | wc -l | tr -d ' ')
echo -e "${BLUE}📁 Found $TOTAL_COUNT migration files${NC}\n"

# Track pending migrations
PENDING_COUNT=0

# Execute each migration
for MIGRATION_FILE in $MIGRATION_FILES; do
 MIGRATION_NAME=$(basename "$MIGRATION_FILE")
 
 # Check if migration has already been executed
 if echo "$EXECUTED_MIGRATIONS" | grep -q "^$MIGRATION_NAME$"; then
 echo -e "${GREEN}⏭${NC} Skipping (already executed): $MIGRATION_NAME"
 continue
 fi
 
 PENDING_COUNT=$((PENDING_COUNT + 1))
 
 echo -e "${YELLOW}📝 Running migration: $MIGRATION_NAME${NC}"

 # Execute the migration with error detection
 # Use ON_ERROR_STOP=1 to ensure psql exits on any error
 # Capture both stdout and stderr to check for errors
 MIGRATION_OUTPUT=$(psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION_FILE" 2>&1)
 MIGRATION_EXIT_CODE=$?

 # Check for errors in the output (PostgreSQL errors start with "ERROR:")
 if [ $MIGRATION_EXIT_CODE -ne 0 ] || echo "$MIGRATION_OUTPUT" | grep -qiE "ERROR|FATAL|syntax error"; then
 echo -e "${RED}❌ Migration failed: $MIGRATION_NAME${NC}"
 echo -e "${RED} Error output:${NC}"
 echo "$MIGRATION_OUTPUT" | grep -iE "ERROR|FATAL|syntax error" | head -10
 echo -e "${RED} Check the SQL syntax and database connection${NC}"
 echo -e "${RED} Migration was NOT recorded and will be retried on next run${NC}"
 exit 1
 fi

 # Record the migration as executed (only if execution succeeded)
 CHECKSUM=$(sha256sum "$MIGRATION_FILE" 2>/dev/null | cut -d' ' -f1 || shasum -a 256 "$MIGRATION_FILE" 2>/dev/null | cut -d' ' -f1 || echo "")
 if ! psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c "INSERT INTO $MIGRATIONS_TABLE (name, checksum) VALUES ('$MIGRATION_NAME', '$CHECKSUM');" 2>&1 >/dev/null; then
 echo -e "${RED}❌ Failed to record migration${NC}"
 echo -e "${RED} Migration executed successfully but could not be recorded${NC}"
 exit 1
 fi
 
 echo -e "${GREEN}✅ Migration completed: $MIGRATION_NAME${NC}\n"
done

# Summary
echo ""
if [ $PENDING_COUNT -eq 0 ]; then
 echo -e "${GREEN}✨ No pending migrations to run${NC}"
else
 echo -e "${GREEN}✅ All $PENDING_COUNT pending migrations completed successfully!${NC}"

 # Reload PostgREST schema cache
 echo ""
 echo -e "${YELLOW}🔄 Reloading PostgREST schema cache...${NC}"
 if psql "$SUPABASE_DB_URL" -c "NOTIFY pgrst, 'reload schema';" 2>&1; then
 echo -e "${GREEN}✅ Schema cache reloaded${NC}"
 else
 echo -e "${YELLOW}⚠️ Could not reload schema cache (this is normal if PostgREST is not listening)${NC}"
 echo -e "${YELLOW} The schema will be reloaded automatically on next API request${NC}"
 fi
fi
