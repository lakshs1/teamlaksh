import { eq } from "drizzle-orm";
import { db, users, USER_ROLES, type SafeUser } from "@db";
import { hashPassword, comparePassword } from "../../lib/password.js";
import { generateTokenPair, verifyRefreshToken } from "../../lib/jwt.js";
import { ApiError } from "../../lib/api-error.js";

// ═══════════════════════════════════════════════════════════
// AUTH SERVICE — DealFlow360 Auth Business Logic
// ═══════════════════════════════════════════════════════════

/**
 * Strip sensitive fields from a user record.
 */
function toSafeUser(user: typeof users.$inferSelect): SafeUser {
  const { password, refreshToken, ...safe } = user;
  return safe;
}

/**
 * Register a new user with role (defaults to 'rep').
 */
export async function register(data: {
  email: string;
  password: string;
  name: string;
  role?: string;
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

  // Create user in PostgreSQL
  const [user] = await db
    .insert(users)
    .values({
      email: data.email,
      password: hashedPassword,
      name: data.name,
      role: data.role || "rep",
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

  if (!user || !user.password) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  const isValidPassword = await comparePassword(data.password, user.password);
  if (!isValidPassword) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  if (!user.isActive) {
    throw ApiError.forbidden("User account is inactive");
  }

  // Generate tokens
  const tokenPayload = { id: user.id, email: user.email, role: user.role };
  const tokens = generateTokenPair(tokenPayload);

  // Store refresh token
  await db
    .update(users)
    .set({ refreshToken: tokens.refreshToken, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  return {
    user: toSafeUser(user),
    ...tokens,
  };
}

/**
 * Logout — invalidate refresh token.
 */
export async function logout(userId: number | string) {
  await db
    .update(users)
    .set({ refreshToken: null })
    .where(eq(users.id, Number(userId)));
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
    .where(eq(users.id, Number(decoded.id)))
    .limit(1);

  if (!user || user.refreshToken !== refreshTokenValue) {
    throw ApiError.unauthorized("Invalid refresh token");
  }

  if (!user.isActive) {
    throw ApiError.forbidden("User account is inactive");
  }

  // Generate new token pair (rotation)
  const tokenPayload = { id: user.id, email: user.email, role: user.role };
  const tokens = generateTokenPair(tokenPayload);

  // Store new refresh token
  await db
    .update(users)
    .set({ refreshToken: tokens.refreshToken, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  return {
    user: toSafeUser(user),
    ...tokens,
  };
}

/**
 * Get current user by ID.
 */
export async function getMe(userId: number | string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, Number(userId)))
    .limit(1);

  if (!user) {
    throw ApiError.notFound("User not found");
  }

  return toSafeUser(user);
}

/**
 * Switch role for the authenticated user (demo role switcher).
 */
export async function switchRole(userId: number | string, newRole: string) {
  if (!USER_ROLES.includes(newRole as any)) {
    throw ApiError.badRequest(`Invalid role. Must be one of: ${USER_ROLES.join(", ")}`);
  }

  const [user] = await db
    .update(users)
    .set({ role: newRole, updatedAt: new Date() })
    .where(eq(users.id, Number(userId)))
    .returning();

  if (!user) {
    throw ApiError.notFound("User not found");
  }

  const tokenPayload = { id: user.id, email: user.email, role: user.role };
  const tokens = generateTokenPair(tokenPayload);

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
 * Instant demo login for a given role (no password required in demo mode).
 */
export async function demoLogin(role: string) {
  if (!USER_ROLES.includes(role as any)) {
    throw ApiError.badRequest(`Invalid role. Must be one of: ${USER_ROLES.join(", ")}`);
  }

  const demoEmail = `demo.${role}@dealflow360.dev`;
  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, demoEmail))
    .limit(1);

  if (!user) {
    const hashedPassword = await hashPassword("demo12345");
    [user] = await db
      .insert(users)
      .values({
        email: demoEmail,
        password: hashedPassword,
        name: `Demo ${role.charAt(0).toUpperCase() + role.slice(1)}`,
        role,
      })
      .returning();
  } else if (user.role !== role) {
    [user] = await db
      .update(users)
      .set({ role })
      .where(eq(users.id, user.id))
      .returning();
  }

  const tokenPayload = { id: user.id, email: user.email, role: user.role };
  const tokens = generateTokenPair(tokenPayload);

  await db
    .update(users)
    .set({ refreshToken: tokens.refreshToken })
    .where(eq(users.id, user.id));

  return {
    user: toSafeUser(user),
    ...tokens,
  };
}
