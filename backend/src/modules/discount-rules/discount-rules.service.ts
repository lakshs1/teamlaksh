import { eq, and } from "drizzle-orm";
import { db, discountRules, customerTiers, productCategories } from "@db";
import { ApiError } from "../../lib/api-error.js";

// ═══════════════════════════════════════════════════════════
// DISCOUNT RULES SERVICE
// ═══════════════════════════════════════════════════════════

export async function getDiscountRules(query: {
  tier_id?: number;
  category_id?: number;
}) {
  const conditions = [];

  if (query.tier_id) {
    conditions.push(eq(discountRules.tierId, query.tier_id));
  }

  if (query.category_id) {
    conditions.push(eq(discountRules.categoryId, query.category_id));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rules = await db
    .select({
      id: discountRules.id,
      tierId: discountRules.tierId,
      categoryId: discountRules.categoryId,
      maxDiscountPct: discountRules.maxDiscountPct,
      managerThresholdPct: discountRules.managerThresholdPct,
      financeThresholdPct: discountRules.financeThresholdPct,
      createdAt: discountRules.createdAt,
      tier: {
        id: customerTiers.id,
        name: customerTiers.name,
        maxDiscountPct: customerTiers.maxDiscountPct,
      },
      category: {
        id: productCategories.id,
        name: productCategories.name,
        maxDiscountPct: productCategories.maxDiscountPct,
      },
    })
    .from(discountRules)
    .leftJoin(customerTiers, eq(discountRules.tierId, customerTiers.id))
    .leftJoin(productCategories, eq(discountRules.categoryId, productCategories.id))
    .where(whereClause);

  return rules;
}

export async function createDiscountRule(data: {
  tier_id: number;
  category_id: number;
  max_discount_pct: number;
  manager_threshold_pct?: number;
  finance_threshold_pct?: number;
}) {
  // Validate tier exists
  const [tier] = await db
    .select()
    .from(customerTiers)
    .where(eq(customerTiers.id, data.tier_id))
    .limit(1);

  if (!tier) {
    throw ApiError.badRequest(`Customer tier ID ${data.tier_id} does not exist`);
  }

  // Validate category exists
  const [category] = await db
    .select()
    .from(productCategories)
    .where(eq(productCategories.id, data.category_id))
    .limit(1);

  if (!category) {
    throw ApiError.badRequest(`Category ID ${data.category_id} does not exist`);
  }

  // Check if rule already exists for this pair
  const [existing] = await db
    .select()
    .from(discountRules)
    .where(
      and(
        eq(discountRules.tierId, data.tier_id),
        eq(discountRules.categoryId, data.category_id)
      )
    )
    .limit(1);

  if (existing) {
    throw ApiError.conflict(
      `A discount rule already exists for Tier ${data.tier_id} and Category ${data.category_id}`
    );
  }

  const [rule] = await db
    .insert(discountRules)
    .values({
      tierId: data.tier_id,
      categoryId: data.category_id,
      maxDiscountPct: data.max_discount_pct.toString(),
      managerThresholdPct: (data.manager_threshold_pct ?? 0).toString(),
      financeThresholdPct: (data.finance_threshold_pct ?? 5).toString(),
    })
    .returning();

  return rule;
}

export async function updateDiscountRule(
  id: number,
  data: {
    max_discount_pct?: number;
    manager_threshold_pct?: number;
    finance_threshold_pct?: number;
  }
) {
  const [existing] = await db
    .select()
    .from(discountRules)
    .where(eq(discountRules.id, id))
    .limit(1);

  if (!existing) {
    throw ApiError.notFound(`Discount rule with ID ${id} not found`);
  }

  const [updated] = await db
    .update(discountRules)
    .set({
      ...(data.max_discount_pct !== undefined
        ? { maxDiscountPct: data.max_discount_pct.toString() }
        : {}),
      ...(data.manager_threshold_pct !== undefined
        ? { managerThresholdPct: data.manager_threshold_pct.toString() }
        : {}),
      ...(data.finance_threshold_pct !== undefined
        ? { financeThresholdPct: data.finance_threshold_pct.toString() }
        : {}),
    })
    .where(eq(discountRules.id, id))
    .returning();

  return updated;
}

/**
 * Pure calculation helper for discount governance rules.
 */
export function calculateDiscountApprovalRoute(params: {
  tierMax: number;
  categoryMax: number;
  ruleMax?: number | null;
  requestedDiscountPct: number;
  managerThreshold?: number;
  financeThreshold?: number;
}) {
  const ruleMax = params.ruleMax !== undefined && params.ruleMax !== null ? params.ruleMax : Infinity;
  const effectiveMaxDiscount = Math.min(params.tierMax, params.categoryMax, ruleMax);

  const managerThreshold = params.managerThreshold ?? 0;
  const financeThreshold = params.financeThreshold ?? 5;

  const exceedsCeiling = params.requestedDiscountPct > effectiveMaxDiscount;
  const requiresFinance = params.requestedDiscountPct > financeThreshold;
  const requiresManager = params.requestedDiscountPct > managerThreshold;

  let approvalRoute: "auto" | "pending_manager" | "pending_finance" = "auto";
  if (requiresFinance) {
    approvalRoute = "pending_finance";
  } else if (requiresManager) {
    approvalRoute = "pending_manager";
  }

  return {
    tierMax: params.tierMax,
    categoryMax: params.categoryMax,
    ruleMax: params.ruleMax !== undefined && params.ruleMax !== null ? params.ruleMax : null,
    effectiveMaxDiscount,
    requestedDiscountPct: params.requestedDiscountPct,
    exceedsCeiling,
    requiresManager,
    requiresFinance,
    approvalRoute,
  };
}

/**
 * Calculates effective maximum discount allowed and determines required approval level.
 * Formula: min(tier.max, category.max, rule.max)
 */
export async function evaluateDiscountPolicy(params: {
  tier_id: number;
  category_id: number;
  requested_discount_pct: number;
}) {
  const [tier] = await db
    .select()
    .from(customerTiers)
    .where(eq(customerTiers.id, params.tier_id))
    .limit(1);

  if (!tier) {
    throw ApiError.badRequest(`Customer tier ID ${params.tier_id} does not exist`);
  }

  const [category] = await db
    .select()
    .from(productCategories)
    .where(eq(productCategories.id, params.category_id))
    .limit(1);

  if (!category) {
    throw ApiError.badRequest(`Category ID ${params.category_id} does not exist`);
  }

  const [rule] = await db
    .select()
    .from(discountRules)
    .where(
      and(
        eq(discountRules.tierId, params.tier_id),
        eq(discountRules.categoryId, params.category_id)
      )
    )
    .limit(1);

  const tierMax = parseFloat(tier.maxDiscountPct);
  const categoryMax = parseFloat(category.maxDiscountPct);
  const ruleMax = rule ? parseFloat(rule.maxDiscountPct) : null;
  const managerThreshold = rule ? parseFloat(rule.managerThresholdPct) : 0;
  const financeThreshold = rule ? parseFloat(rule.financeThresholdPct) : 5;

  return calculateDiscountApprovalRoute({
    tierMax,
    categoryMax,
    ruleMax,
    requestedDiscountPct: params.requested_discount_pct,
    managerThreshold,
    financeThreshold,
  });
}

