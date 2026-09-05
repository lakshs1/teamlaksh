import { eq, ilike, and, sql } from "drizzle-orm";
import { db, customerTiers, customers } from "@db";
import { ApiError } from "../../lib/api-error.js";

// ═══════════════════════════════════════════════════════════
// CUSTOMER TIERS SERVICE
// ═══════════════════════════════════════════════════════════

export async function getTiers() {
  return db
    .select()
    .from(customerTiers)
    .orderBy(customerTiers.name);
}

export async function createTier(data: { name: string; max_discount_pct: number }) {
  const existing = await db
    .select()
    .from(customerTiers)
    .where(eq(customerTiers.name, data.name))
    .limit(1);

  if (existing.length > 0) {
    throw ApiError.conflict(`Customer tier '${data.name}' already exists`);
  }

  const [tier] = await db
    .insert(customerTiers)
    .values({
      name: data.name,
      maxDiscountPct: data.max_discount_pct.toString(),
    })
    .returning();

  return tier;
}

// ═══════════════════════════════════════════════════════════
// CUSTOMERS SERVICE
// ═══════════════════════════════════════════════════════════

export async function listCustomers(query: {
  search?: string;
  tier_id?: number;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 20));
  const offset = (page - 1) * limit;

  const conditions = [];

  if (query.search) {
    conditions.push(
      sql`(${customers.name} ILIKE ${`%${query.search}%`} OR ${customers.email} ILIKE ${`%${query.search}%`})`
    );
  }

  if (query.tier_id) {
    conditions.push(eq(customers.tierId, query.tier_id));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Query customers with joined tier
  const rows = await db
    .select({
      id: customers.id,
      name: customers.name,
      email: customers.email,
      tierId: customers.tierId,
      createdAt: customers.createdAt,
      tier: {
        id: customerTiers.id,
        name: customerTiers.name,
        maxDiscountPct: customerTiers.maxDiscountPct,
        createdAt: customerTiers.createdAt,
      },
    })
    .from(customers)
    .leftJoin(customerTiers, eq(customers.tierId, customerTiers.id))
    .where(whereClause)
    .limit(limit)
    .offset(offset);

  // Total count for pagination
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(customers)
    .where(whereClause);

  return {
    items: rows,
    pagination: {
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit) || 1,
    },
  };
}

export async function getCustomerById(id: number) {
  const [row] = await db
    .select({
      id: customers.id,
      name: customers.name,
      email: customers.email,
      tierId: customers.tierId,
      createdAt: customers.createdAt,
      tier: {
        id: customerTiers.id,
        name: customerTiers.name,
        maxDiscountPct: customerTiers.maxDiscountPct,
        createdAt: customerTiers.createdAt,
      },
    })
    .from(customers)
    .leftJoin(customerTiers, eq(customers.tierId, customerTiers.id))
    .where(eq(customers.id, id))
    .limit(1);

  if (!row) {
    throw ApiError.notFound(`Customer with ID ${id} not found`);
  }

  return row;
}

export async function createCustomer(data: {
  name: string;
  email: string;
  tier_id?: number | null;
}) {
  const existing = await db
    .select()
    .from(customers)
    .where(eq(customers.email, data.email))
    .limit(1);

  if (existing.length > 0) {
    throw ApiError.conflict(`Customer with email '${data.email}' already exists`);
  }

  if (data.tier_id) {
    const [tier] = await db
      .select()
      .from(customerTiers)
      .where(eq(customerTiers.id, data.tier_id))
      .limit(1);

    if (!tier) {
      throw ApiError.badRequest(`Customer tier ID ${data.tier_id} does not exist`);
    }
  }

  const [customer] = await db
    .insert(customers)
    .values({
      name: data.name,
      email: data.email,
      tierId: data.tier_id || null,
    })
    .returning();

  return getCustomerById(customer.id);
}

export async function updateCustomer(
  id: number,
  data: {
    name?: string;
    email?: string;
    tier_id?: number | null;
  }
) {
  const existing = await db
    .select()
    .from(customers)
    .where(eq(customers.id, id))
    .limit(1);

  if (existing.length === 0) {
    throw ApiError.notFound(`Customer with ID ${id} not found`);
  }

  if (data.email && data.email !== existing[0].email) {
    const duplicate = await db
      .select()
      .from(customers)
      .where(eq(customers.email, data.email))
      .limit(1);

    if (duplicate.length > 0) {
      throw ApiError.conflict(`Email '${data.email}' is already taken`);
    }
  }

  if (data.tier_id) {
    const [tier] = await db
      .select()
      .from(customerTiers)
      .where(eq(customerTiers.id, data.tier_id))
      .limit(1);

    if (!tier) {
      throw ApiError.badRequest(`Customer tier ID ${data.tier_id} does not exist`);
    }
  }

  await db
    .update(customers)
    .set({
      ...(data.name ? { name: data.name } : {}),
      ...(data.email ? { email: data.email } : {}),
      ...(data.tier_id !== undefined ? { tierId: data.tier_id } : {}),
    })
    .where(eq(customers.id, id));

  return getCustomerById(id);
}

export async function deleteCustomer(id: number) {
  const [deleted] = await db
    .delete(customers)
    .where(eq(customers.id, id))
    .returning();
  return deleted;
}

