import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import "dotenv/config";
import * as schema from "./schema.js";
import { insertUserSchema } from "./schema.js";

const connectionString =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5431/postgres";

// Client for queries
const queryClient = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Drizzle instance configured with schema
export const db = drizzle(queryClient, { schema });

/**
 * Example helper function with Zod validation
 */
export async function createUser(data: unknown) {
  // Validate input using Zod schema
  const validatedData = insertUserSchema.parse(data);

  // Insert into PostgreSQL via Drizzle ORM
  const [newUser] = await db
    .insert(schema.users)
    .values(validatedData)
    .returning();

  return newUser;
}

/**
 * Quick connection health check
 */
export async function checkConnection() {
  try {
    const result = await queryClient`SELECT 1 as connected`;
    console.log(" PostgreSQL connection successful:", result);
    return true;
  } catch (error) {
    console.error(" PostgreSQL connection failed:", error);
    return false;
  }
}

// Self-test execution when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("Testing connection to PostgreSQL on port 5431...");
  checkConnection().then((success) => {
    if (success) {
      console.log("Ready to accept queries.");
    }
  });
}

export * from "./schema.js";
