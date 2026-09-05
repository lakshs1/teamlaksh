import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db } from "../../config/db.js";
import { users } from "../../db/schema/index.js";
import { hashPassword, comparePassword } from "../../lib/password.js";
import { generateTokenPair, verifyRefreshToken } from "../../lib/jwt.js";
import { ApiError } from "../../lib/api-error.js";
import type { SafeUser } from "../../db/schema/users.js";

// ═══════════════════════════════════════════════════════════
// AUTH SERVICE — Business logic layer
// ═══════════════════════════════════════════════════════════

/**
 * Strip sensitive fields from a user record.
 */
function toSafeUser(user: typeof users.$inferSelect): SafeUser {
  const { password, refreshToken, verificationToken, resetToken, resetTokenExpiry, ...safe } = user;
  return safe;
}

/**
 * Register a new user.
 */
export async function register(data: {
  email: string;
  password: string;
  name: string;
}) {
  // Check if email already taken
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, data.email))
    .limit(1);

  if (existing.length > 0) {
    throw ApiError.conflict("Email already registered");
  }

  // Hash password
  const hashedPassword = await hashPassword(data.password);

  // Generate email verification token
  const verificationToken = randomBytes(32).toString("hex");

  // Create user
  const [user] = await db
    .insert(users)
    .values({
      email: data.email,
      password: hashedPassword,
      name: data.name,
      verificationToken,
    })
    .returning();

  // Generate tokens
  const tokenPayload = { id: user.id, email: user.email, role: user.role };
  const tokens = generateTokenPair(tokenPayload);

  // Store refresh token
  await db
    .update(users)
    .set({ refreshToken: tokens.refreshToken })
    .where(eq(users.id, user.id));

  // Log verification token (no email service in template)
  console.log(`📧 Email verification token for ${user.email}: ${verificationToken}`);

  return {
    user: toSafeUser(user),
    ...tokens,
  };
}

/**
 * Login with email and password.
 */
export async function login(data: { email: string; password: string }) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, data.email))
    .limit(1);

  if (!user) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  const isValidPassword = await comparePassword(data.password, user.password);
  if (!isValidPassword) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  // Generate tokens
  const tokenPayload = { id: user.id, email: user.email, role: user.role };
  const tokens = generateTokenPair(tokenPayload);

  // Store refresh token
  await db
    .update(users)
    .set({ refreshToken: tokens.refreshToken })
    .where(eq(users.id, user.id));

  return {
    user: toSafeUser(user),
    ...tokens,
  };
}

/**
 * Logout — invalidate refresh token.
 */
export async function logout(userId: string) {
  await db
    .update(users)
    .set({ refreshToken: null })
    .where(eq(users.id, userId));
}

/**
 * Refresh access token using a valid refresh token.
 * Implements token rotation (old refresh token is replaced).
 */
export async function refresh(refreshTokenValue: string) {
  // Verify the refresh token
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshTokenValue);
  } catch {
    throw ApiError.unauthorized("Invalid or expired refresh token");
  }

  // Find user and validate stored token matches
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, decoded.id))
    .limit(1);

  if (!user || user.refreshToken !== refreshTokenValue) {
    throw ApiError.unauthorized("Invalid refresh token");
  }

  // Generate new token pair (rotation)
  const tokenPayload = { id: user.id, email: user.email, role: user.role };
  const tokens = generateTokenPair(tokenPayload);

  // Store new refresh token
  await db
    .update(users)
    .set({ refreshToken: tokens.refreshToken })
    .where(eq(users.id, user.id));

  return {
    user: toSafeUser(user),
    ...tokens,
  };
}

/**
 * Forgot password — generate reset token.
 * Logs token to console (no email service in template).
 */
export async function forgotPassword(email: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Always return success to prevent email enumeration
  if (!user) {
    return;
  }

  const resetToken = randomBytes(32).toString("hex");
  const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db
    .update(users)
    .set({ resetToken, resetTokenExpiry })
    .where(eq(users.id, user.id));

  // Log token (swap with real email service during hackathon)
  console.log(`🔑 Password reset token for ${email}: ${resetToken}`);
  console.log(`   Expires at: ${resetTokenExpiry.toISOString()}`);
}

/**
 * Reset password using a valid reset token.
 */
export async function resetPassword(token: string, newPassword: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.resetToken, token))
    .limit(1);

  if (!user) {
    throw ApiError.badRequest("Invalid reset token");
  }

  if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
    throw ApiError.badRequest("Reset token has expired");
  }

  const hashedPassword = await hashPassword(newPassword);

  await db
    .update(users)
    .set({
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null,
    })
    .where(eq(users.id, user.id));
}

/**
 * Verify email using verification token.
 */
export async function verifyEmail(token: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.verificationToken, token))
    .limit(1);

  if (!user) {
    throw ApiError.badRequest("Invalid verification token");
  }

  if (user.emailVerified) {
    throw ApiError.badRequest("Email already verified");
  }

  await db
    .update(users)
    .set({
      emailVerified: true,
      verificationToken: null,
    })
    .where(eq(users.id, user.id));
}

/**
 * Get current user by ID.
 */
export async function getMe(userId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw ApiError.notFound("User not found");
  }

  return toSafeUser(user);
}
