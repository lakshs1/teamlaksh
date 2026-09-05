import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { env } from "../config/env.js";

/**
 * Run all pending migrations from the ./drizzle folder.
 * Usage: bun src/db/migrate.ts
 */
async function main() {
  console.log("🔄 Running migrations...");

  const pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
  });

  const db = drizzle(pool);

  await migrate(db, { migrationsFolder: "./drizzle" });

  console.log("✅ Migrations completed successfully");
  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
