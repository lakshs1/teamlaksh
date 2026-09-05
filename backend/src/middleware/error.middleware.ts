import { type Request, type Response, type NextFunction } from "express";
import { ZodError } from "zod";
import { ApiError } from "../lib/api-error.js";
import { env } from "../config/env.js";

/**
 * Global error handling middleware.
 *
 * Catches all errors thrown in route handlers and middleware:
 * - ApiError       → returns structured JSON with correct status code
 * - ZodError       → formats into { field, message }[] with 422 status
 * - Unknown errors → returns generic 500 (details hidden in production)
 *
 * Must be registered LAST in the Express middleware chain.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // ── Zod validation errors ────────────────────────────────
  if (err instanceof ZodError) {
    const errors = err.errors.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    }));

    res.status(422).json({
      success: false,
      message: "Validation failed",
      errors,
    });
    return;
  }

  // ── ApiError (our custom errors) ─────────────────────────
  if (err instanceof ApiError) {
    // Check if message is a JSON string (from validate middleware)
    let body: any;
    try {
      body = JSON.parse(err.message);
    } catch {
      body = { message: err.message };
    }

    res.status(err.statusCode).json({
      success: false,
      ...body,
    });
    return;
  }

  // ── Unknown / unexpected errors ──────────────────────────
  console.error("💥 Unhandled error:", err);

  res.status(500).json({
    success: false,
    message:
      env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message || "Internal server error",
    ...(env.NODE_ENV !== "production" && { stack: err.stack }),
  });
}
