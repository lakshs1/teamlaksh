import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  pgEnum,
  text,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// ── Role enum ──────────────────────────────────────────────
export const roleEnum = pgEnum("user_role", ["user", "admin"]);

// ── Users table ────────────────────────────────────────────
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: roleEnum("role").notNull().default("user"),
  photoUrl: text("photo_url"),
  emailVerified: boolean("email_verified").notNull().default(false),
  verificationToken: varchar("verification_token", { length: 255 }),
  resetToken: varchar("reset_token", { length: 255 }),
  resetTokenExpiry: timestamp("reset_token_expiry"),
  refreshToken: varchar("refresh_token", { length: 512 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Auto-generated Zod schemas from Drizzle table ──────────
export const insertUserSchema = createInsertSchema(users, {
  email: (schema) => schema.email("Invalid email format"),
  password: (schema) => schema.min(8, "Password must be at least 8 characters"),
  name: (schema) => schema.min(2, "Name must be at least 2 characters"),
});

export const selectUserSchema = createSelectSchema(users);

// ── Safe user (omits sensitive fields) ─────────────────────
export const safeUserSchema = selectUserSchema.omit({
  password: true,
  refreshToken: true,
  verificationToken: true,
  resetToken: true,
  resetTokenExpiry: true,
});

export type User = z.infer<typeof selectUserSchema>;
export type NewUser = z.infer<typeof insertUserSchema>;
export type SafeUser = z.infer<typeof safeUserSchema>;
