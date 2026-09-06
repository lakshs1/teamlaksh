import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db, users, customers, customerTiers, quotes, quoteLines, products, USER_ROLES, type SafeUser } from "@db";
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
 * Ensures a customer quotation has line items and realistic totals.
 */
async function ensureQuoteHasLines(quoteId: number) {
  const existingLines = await db
    .select()
    .from(quoteLines)
    .where(eq(quoteLines.quoteId, quoteId))
    .limit(1);

  if (existingLines.length === 0) {
    const [prod] = await db.select().from(products).limit(1);
    if (prod) {
      const unit = parseFloat(prod.basePrice) || 4500;
      const cost = parseFloat(prod.costPrice) || 2800;
      const qty = 2;
      const total = unit * qty;
      const tax = total * 0.18;
      const grand = total + tax;

      await db.insert(quoteLines).values({
        quoteId,
        productId: prod.id,
        quantity: qty,
        unitPrice: unit.toFixed(2),
        costPrice: cost.toFixed(2),
        discountPct: "0.00",
        discountAmount: "0.00",
        lineTotal: total.toFixed(2),
        marginPct: (((unit - cost) / unit) * 100).toFixed(2),
        allowedDiscountPct: "15.00",
        excessPct: "0.00",
        isRecurring: prod.isRecurring || false,
        isUpsell: false,
      });

      await db
        .update(quotes)
        .set({
          subtotal: total.toFixed(2),
          totalTax: tax.toFixed(2),
          grandTotal: grand.toFixed(2),
        })
        .where(eq(quotes.id, quoteId));
    }
  }
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
  const normalizedEmail = data.email.toLowerCase().trim();

  // Check if email already taken
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existing.length > 0) {
    throw ApiError.conflict("Email already registered");
  }

  // Hash password
  const hashedPassword = await hashPassword(data.password);

  const assignedRole = data.role === "customer" ? "customer" : data.role || "rep";

  // Create user in PostgreSQL
  const [user] = await db
    .insert(users)
    .values({
      email: normalizedEmail,
      password: hashedPassword,
      name: data.name,
      role: assignedRole,
    })
    .returning();

  let portalToken: string | null = null;

  // If registering customer (or any role), ensure customer entity & quote exist
  if (assignedRole === "customer" || data.role === "customer") {
    let [cust] = await db
      .select()
      .from(customers)
      .where(eq(customers.email, normalizedEmail))
      .limit(1);

    if (!cust) {
      const [bronzeTier] = await db
        .select()
        .from(customerTiers)
        .where(eq(customerTiers.name, "Bronze"))
        .limit(1);
      const fallbackTier = bronzeTier || (await db.select().from(customerTiers).limit(1))[0];

      [cust] = await db
        .insert(customers)
        .values({
          name: data.name,
          email: normalizedEmail,
          tierId: fallbackTier ? fallbackTier.id : 1,
        })
        .returning();
    }

    if (cust) {
      const [existingQuote] = await db
        .select()
        .from(quotes)
        .where(eq(quotes.customerId, cust.id))
        .orderBy(desc(quotes.createdAt))
        .limit(1);

      if (existingQuote) {
        portalToken = existingQuote.portalToken;
      }
    }
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
    user: {
      ...toSafeUser(user),
      portal_token: portalToken,
      portalToken: portalToken,
    },
    ...tokens,
  };
}

/**
 * Login with email and password.
 */
export async function login(data: { email: string; password: string }) {
  const normalizedEmail = data.email.toLowerCase().trim();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
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

  // Find if customer portal token is associated
  let portalToken: string | null = null;
  const [cust] = await db
    .select()
    .from(customers)
    .where(eq(customers.email, normalizedEmail))
    .limit(1);

  if (cust) {
    const [existingQuote] = await db
      .select()
      .from(quotes)
      .where(eq(quotes.customerId, cust.id))
      .orderBy(desc(quotes.createdAt))
      .limit(1);
    if (existingQuote) {
      portalToken = existingQuote.portalToken;
      await ensureQuoteHasLines(existingQuote.id);
    }
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
    user: {
      ...toSafeUser(user),
      portal_token: portalToken,
      portalToken: portalToken,
    },
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

export async function getAllUsers() {
  const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
  return allUsers.map(toSafeUser);
}
