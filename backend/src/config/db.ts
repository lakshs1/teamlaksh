import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { env } from "./env.js";
import * as schema from "../db/schema/index.js";

const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });

/**
 * Test database connectivity. Call at startup to fail fast.
 */
export async function checkDbConnection(): Promise<void> {
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    console.log("✅ Database connected successfully");
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    process.exit(1);
  }
}
