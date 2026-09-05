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
    email: z.string().email("Invalid email format").openapi({ example: "john@example.com" }),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .openapi({ example: "securepassword123" }),
    name: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .openapi({ example: "John Doe" }),
  })
  .openapi("RegisterRequest");

export const loginSchema = z
  .object({
    email: z.string().email("Invalid email format").openapi({ example: "john@example.com" }),
    password: z.string().min(1, "Password is required").openapi({ example: "securepassword123" }),
  })
  .openapi("LoginRequest");

export const refreshSchema = z
  .object({
    refreshToken: z.string().min(1, "Refresh token is required"),
  })
  .openapi("RefreshRequest");

export const forgotPasswordSchema = z
  .object({
    email: z.string().email("Invalid email format").openapi({ example: "john@example.com" }),
  })
  .openapi("ForgotPasswordRequest");

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Reset token is required"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .openapi({ example: "newSecurePassword456" }),
  })
  .openapi("ResetPasswordRequest");

export const verifyEmailSchema = z
  .object({
    token: z.string().min(1, "Verification token is required"),
  })
  .openapi("VerifyEmailRequest");

// ═══════════════════════════════════════════════════════════
// RESPONSE SCHEMAS
// ═══════════════════════════════════════════════════════════

export const safeUserResponseSchema = z
  .object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
    role: z.enum(["user", "admin"]),
    emailVerified: z.boolean(),
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
  method: "post",
  path: "/auth/forgot-password",
  tags: ["Auth"],
  summary: "Request password reset",
  request: { body: { content: { "application/json": { schema: forgotPasswordSchema } } } },
  responses: {
    200: { description: "Reset token generated", content: { "application/json": { schema: messageResponseSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/reset-password",
  tags: ["Auth"],
  summary: "Reset password with token",
  request: { body: { content: { "application/json": { schema: resetPasswordSchema } } } },
  responses: {
    200: { description: "Password reset", content: { "application/json": { schema: messageResponseSchema } } },
    400: { description: "Invalid or expired token" },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/verify-email",
  tags: ["Auth"],
  summary: "Verify email with token",
  request: { body: { content: { "application/json": { schema: verifyEmailSchema } } } },
  responses: {
    200: { description: "Email verified", content: { "application/json": { schema: messageResponseSchema } } },
    400: { description: "Invalid token" },
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
