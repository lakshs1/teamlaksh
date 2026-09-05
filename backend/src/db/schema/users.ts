import {
  pgTable,
  serial,
  varchar,
  boolean,
  timestamp,
  text,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// ── Role constants & types ─────────────────────────────────
export const USER_ROLES = ["admin", "manager", "rep", "finance"] as const;
export type UserRole = (typeof USER_ROLES)[number];

// ── Users table (aligned with live PostgreSQL database) ────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: text("password"),
  role: varchar("role", { length: 50 }).notNull().default("rep"),
  avatarUrl: text("avatar_url"),
  githubUrl: text("github_url"),
  refreshToken: text("refresh_token"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Auto-generated Zod schemas from Drizzle table ──────────
export const insertUserSchema = createInsertSchema(users, {
  email: (schema) => schema.email("Invalid email format"),
  password: (schema) => schema.min(8, "Password must be at least 8 characters").optional(),
  name: (schema) => schema.min(2, "Name must be at least 2 characters"),
  role: (schema) => schema.refine((val) => USER_ROLES.includes(val as UserRole), {
    message: `Role must be one of: ${USER_ROLES.join(", ")}`,
  }),
});

export const selectUserSchema = createSelectSchema(users);

// ── Safe user (omits sensitive fields) ─────────────────────
export const safeUserSchema = selectUserSchema.omit({
  password: true,
  refreshToken: true,
});

export type User = z.infer<typeof selectUserSchema>;
export type NewUser = z.infer<typeof insertUserSchema>;
export type SafeUser = z.infer<typeof safeUserSchema>;
