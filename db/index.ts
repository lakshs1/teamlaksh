import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import * as schema from "./schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../backend/.env") });
dotenv.config({ path: path.resolve(__dirname, "./.env") });
dotenv.config();

const connectionString =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@bore.pub:52276/postgres";

// Connection pool for queries
export const queryClient = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 30,
});

// Drizzle ORM instance configured with all schemas & relations
export const db = drizzle(queryClient, { schema });

/**
 * Health check to verify database connectivity. Call at server startup to fail-fast.
 */
export async function checkDbConnection(): Promise<boolean> {
  try {
    await queryClient`SELECT 1 as connected`;
    console.log("✅ PostgreSQL connection successful");
    return true;
  } catch (error) {
    console.error("❌ PostgreSQL connection failed:", error);
    return false;
  }
}

// Backwards-compatible alias
export const checkConnection = checkDbConnection;

/**
 * Helper function with Zod validation
 */
export async function createUser(data: unknown) {
  const validatedData = schema.insertUserSchema.parse(data);
  const [newUser] = await db
    .insert(schema.users)
    .values(validatedData as any)
    .returning();
  return newUser;
}

// Self-test execution when run directly via tsx / node
const isMain = process.argv[1] && (
  import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url.replace(/\\/g, '/').toLowerCase().endsWith(process.argv[1].replace(/\\/g, '/').toLowerCase())
);

if (isMain) {
  console.log("Testing connection to PostgreSQL...");
  checkDbConnection().then((success) => {
    if (success) {
      console.log("Ready to accept queries.");
      process.exit(0);
    } else {
      process.exit(1);
    }
  });
}

// Re-export all tables, relations, Zod schemas, and types
export * from "./schema.js";
