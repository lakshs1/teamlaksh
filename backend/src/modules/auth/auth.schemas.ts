import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { registry } from "../../config/swagger.js";

// Extend Zod with OpenAPI methods
extendZodWithOpenApi(z);

// ═══════════════════════════════════════════════════════════
// REQUEST SCHEMAS
// ═══════════════════════════════════════════════════════════

export const registerSchema = z
  .object({
    email: z.string().email("Invalid email format").openapi({ example: "rep@dealflow360.dev" }),
    password: z
      .string()
      .min(4, "Password must be at least 4 characters")
      .openapi({ example: "password123" }),
    name: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .openapi({ example: "Jane Sales" }),
    role: z
      .enum(["admin", "manager", "rep", "finance_operations", "finance", "operations", "customer"])
      .default("rep")
      .openapi({ example: "rep" }),
  })
  .openapi("RegisterRequest");

export const loginSchema = z
  .object({
    email: z.string().email("Invalid email format").openapi({ example: "rep@dealflow360.dev" }),
    password: z.string().min(1, "Password is required").openapi({ example: "password123" }),
  })
  .openapi("LoginRequest");

export const refreshSchema = z
  .object({
    refreshToken: z.string().min(1, "Refresh token is required"),
  })
  .openapi("RefreshRequest");

export const roleSelectSchema = z
  .object({
    role: z.enum(["admin", "manager", "rep", "finance_operations", "finance", "operations", "customer"]).openapi({ example: "manager" }),
  })
  .openapi("RoleSelectRequest");

// ═══════════════════════════════════════════════════════════
// RESPONSE SCHEMAS
// ═══════════════════════════════════════════════════════════

export const safeUserResponseSchema = z
  .object({
    id: z.number().int().openapi({ example: 1 }),
    email: z.string().email(),
    name: z.string(),
    role: z.string().openapi({ example: "rep" }),
    avatarUrl: z.string().nullable().optional(),
    githubUrl: z.string().nullable().optional(),
    isActive: z.boolean(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
  })
  .openapi("SafeUser");

export const authResponseSchema = z
  .object({
    success: z.literal(true),
    message: z.string(),
    data: z.object({
      user: safeUserResponseSchema,
      accessToken: z.string(),
      refreshToken: z.string(),
    }),
  })
  .openapi("AuthResponse");

export const messageResponseSchema = z
  .object({
    success: z.literal(true),
    message: z.string(),
  })
  .openapi("MessageResponse");

// ═══════════════════════════════════════════════════════════
// SWAGGER ROUTE REGISTRATIONS
// ═══════════════════════════════════════════════════════════

registry.registerPath({
  method: "post",
  path: "/auth/register",
  tags: ["Auth"],
  summary: "Register a new user",
  request: { body: { content: { "application/json": { schema: registerSchema } } } },
  responses: {
    201: { description: "User registered", content: { "application/json": { schema: authResponseSchema } } },
    409: { description: "Email already exists" },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/login",
  tags: ["Auth"],
  summary: "Login with email and password",
  request: { body: { content: { "application/json": { schema: loginSchema } } } },
  responses: {
    200: { description: "Login successful", content: { "application/json": { schema: authResponseSchema } } },
    401: { description: "Invalid credentials" },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/refresh",
  tags: ["Auth"],
  summary: "Refresh access token",
  request: { body: { content: { "application/json": { schema: refreshSchema } } } },
  responses: {
    200: { description: "Tokens refreshed", content: { "application/json": { schema: authResponseSchema } } },
    401: { description: "Invalid refresh token" },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/logout",
  tags: ["Auth"],
  summary: "Logout (invalidate refresh token)",
  security: [{ BearerAuth: [] }],
  responses: {
    200: { description: "Logged out", content: { "application/json": { schema: messageResponseSchema } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/auth/me",
  tags: ["Auth"],
  summary: "Get current authenticated user",
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "Current user",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: safeUserResponseSchema,
          }),
        },
      },
    },
    401: { description: "Unauthorized" },
  },
});
