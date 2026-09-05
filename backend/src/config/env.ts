import { z } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";


const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load from various possible paths
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "backend/.env") });
dotenv.config();

const envSchema = z.object({
  // Database
  DATABASE_URL: z
    .string()
    .url("DATABASE_URL must be a valid PostgreSQL connection string")
    .default("postgresql://postgres:postgres@bore.pub:44533/postgres"),

  // JWT
  JWT_ACCESS_SECRET: z
    .string()
    .min(10, "JWT_ACCESS_SECRET must be at least 10 characters")
    .default("dealflow360-jwt-super-secure-access-secret-token-key-2026"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(10, "JWT_REFRESH_SECRET must be at least 10 characters")
    .default("dealflow360-jwt-super-secure-refresh-secret-token-key-2026"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  // Server
  PORT: z.coerce.number().default(5001),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),


  // CORS
  CORS_ORIGIN: z.string().default("*"),
});


const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
