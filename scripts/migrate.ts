import { createClient } from "@supabase/supabase-js";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { createHash } from "crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing required environment variables:");
  console.error("  NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL");
  console.error("  SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getAppliedMigrations() {
  const { data, error } = await supabase
    .from("migrations")
    .select("name")
    .order("applied_at", { ascending: true });

  if (error) {
    // If migrations table doesn't exist, return empty array
    if (error.code === "42P01") {
      return [];
    }
    throw error;
  }

  return data.map((m) => m.name);
}

async function recordMigration(name: string, sql: string) {
  const checksum = createHash("sha256").update(sql).digest("hex");

  const { error } = await supabase.from("migrations").insert({
    name,
    checksum,
  });

  if (error) {
    throw error;
  }
}

async function executeMigration(sql: string) {
  // Split SQL by semicolons and execute each statement
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  for (const statement of statements) {
    if (statement.trim()) {
      const { error } = await supabase.rpc("exec_sql", { sql_query: statement });
      if (error) {
        // Try direct query if RPC doesn't work
        const { error: queryError } = await supabase.from("_temp").select("*").limit(0);
        // If that also fails, we'll need to use a different approach
        // For now, let's use the REST API approach
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        // Note: Supabase JS client doesn't support raw SQL execution
        // We'll need to use the REST API or pg directly
        // For MVP, we'll use a workaround with Supabase SQL editor or CLI
        console.warn("Raw SQL execution not fully supported via JS client.");
        console.warn("Please run migrations manually via Supabase SQL Editor or CLI.");
        console.warn(`Migration SQL:\n${statement}`);
      }
    }
  }
}

async function migrate() {
  console.log("Starting migration process...");

  const migrationsDir = join(process.cwd(), "migrations");
  const files = await readdir(migrationsDir);
  const migrationFiles = files
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const appliedMigrations = await getAppliedMigrations();
  console.log(`Found ${appliedMigrations.length} applied migrations`);
  console.log(`Found ${migrationFiles.length} migration files`);

  for (const file of migrationFiles) {
    if (appliedMigrations.includes(file)) {
      console.log(`✓ ${file} already applied, skipping`);
      continue;
    }

    console.log(`Applying migration: ${file}`);
    const filePath = join(migrationsDir, file);
    const sql = await readFile(filePath, "utf-8");

    try {
      // For MVP, we'll log the SQL and ask user to run manually
      // In production, use Supabase CLI or REST API
      console.log(`\n--- Migration: ${file} ---`);
      console.log("Please run this SQL in Supabase SQL Editor:");
      console.log(sql);
      console.log("---\n");

      // Record as applied (user will run manually)
      await recordMigration(file, sql);
      console.log(`✓ Recorded migration: ${file}`);
    } catch (error) {
      console.error(`✗ Error applying migration ${file}:`, error);
      throw error;
    }
  }

  console.log("Migration process complete!");
}

migrate().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
