import { eq, inArray, desc } from "drizzle-orm";
import { db, upsellRules, quotes, quoteLines, products } from "@db";
import { ApiError } from "../../lib/api-error.js";

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export interface CreateUpsellRuleInput {
  source_product_id: number;
  suggested_product_id: number;
  rank?: number;
  is_promoted?: boolean;
  min_margin_pct?: number;
}

export interface RecommendationSuggestion {
  product_id: number;
  product_name: string;
  base_price: number;
  cost_price: number;
  margin_pct: number;
  is_promoted: boolean;
  rank: number;
  reason: string;
}

// ═══════════════════════════════════════════════════════════
// RECOMMENDATIONS ENGINE
// ═══════════════════════════════════════════════════════════

/**
 * Generates ranked upsell/cross-sell suggestions for a quote.
 * Filters out items already in the quote and items below min_margin_pct.
 */
export async function getSuggestionsForQuote(quoteId: number): Promise<RecommendationSuggestion[]> {
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, quoteId)).limit(1);
  if (!quote) {
    throw ApiError.notFound(`Quote with ID ${quoteId} not found`);
  }

  // Fetch all current line items in the quote
  const lines = await db.select().from(quoteLines).where(eq(quoteLines.quoteId, quoteId));
  if (lines.length === 0) {
    return [];
  }

  const currentProductIds = new Set<number>(lines.map((l) => l.productId));
  const sourceProductIdsArray = Array.from(currentProductIds);

  // Fetch all matching upsell rules
  const rules = await db
    .select()
    .from(upsellRules)
    .where(inArray(upsellRules.sourceProductId, sourceProductIdsArray));

  if (rules.length === 0) {
    return [];
  }

  // Gather unique product IDs we need to look up
  const neededProductIds = new Set<number>();
  for (const r of rules) {
    neededProductIds.add(r.sourceProductId);
    neededProductIds.add(r.suggestedProductId);
  }

  const productRows = await db
    .select()
    .from(products)
    .where(inArray(products.id, Array.from(neededProductIds)));

  const productMap = new Map<number, (typeof productRows)[0]>();
  for (const p of productRows) {
    productMap.set(p.id, p);
  }

  // Deduplication map: suggestedProductId -> RecommendationSuggestion
  const candidatesMap = new Map<number, RecommendationSuggestion>();

  for (const rule of rules) {
    // Exclude if already in quote
    if (currentProductIds.has(rule.suggestedProductId)) {
      continue;
    }

    const suggestedProduct = productMap.get(rule.suggestedProductId);
    if (!suggestedProduct || !suggestedProduct.isActive) {
      continue;
    }

    const sourceProduct = productMap.get(rule.sourceProductId);
    const sourceName = sourceProduct ? sourceProduct.name : "Cart item";

    const basePrice = Number(suggestedProduct.basePrice);
    const costPrice = Number(suggestedProduct.costPrice);
    const marginPct = basePrice > 0 ? ((basePrice - costPrice) / basePrice) * 100 : 0;
    const roundedMargin = Math.round(marginPct * 100) / 100;
    const minMargin = Number(rule.minMarginPct) || 0;

    // Filter out if profit margin is below threshold
    if (roundedMargin < minMargin) {
      continue;
    }

    const candidate: RecommendationSuggestion = {
      product_id: suggestedProduct.id,
      product_name: suggestedProduct.name,
      base_price: basePrice,
      cost_price: costPrice,
      margin_pct: roundedMargin,
      is_promoted: Boolean(rule.isPromoted),
      rank: Number(rule.rank) || 1,
      reason: `Frequently bought together with ${sourceName}`,
    };

    const existing = candidatesMap.get(suggestedProduct.id);
    if (!existing) {
      candidatesMap.set(suggestedProduct.id, candidate);
    } else {
      // Pick higher priority if multiple rules suggest the same product
      const isExistingBetter =
        (existing.is_promoted && !candidate.is_promoted) ||
        (existing.is_promoted === candidate.is_promoted && existing.rank > candidate.rank);

      if (!isExistingBetter) {
        candidatesMap.set(suggestedProduct.id, candidate);
      }
    }
  }

  const result = Array.from(candidatesMap.values());

  // Sort: 1) is_promoted DESC, 2) rank DESC, 3) margin_pct DESC
  result.sort((a, b) => {
    if (a.is_promoted !== b.is_promoted) {
      return a.is_promoted ? -1 : 1;
    }
    if (a.rank !== b.rank) {
      return b.rank - a.rank;
    }
    return b.margin_pct - a.margin_pct;
  });

  return result;
}

// ═══════════════════════════════════════════════════════════
// RULES MANAGEMENT
// ═══════════════════════════════════════════════════════════

export async function listRules() {
  const rules = await db.select().from(upsellRules).orderBy(desc(upsellRules.rank));
  if (rules.length === 0) return [];

  const productIds = new Set<number>();
  rules.forEach((r) => {
    productIds.add(r.sourceProductId);
    productIds.add(r.suggestedProductId);
  });

  const productRows = await db
    .select()
    .from(products)
    .where(inArray(products.id, Array.from(productIds)));

  const productMap = new Map<number, (typeof productRows)[0]>();
  for (const p of productRows) {
    productMap.set(p.id, p);
  }

  return rules.map((r) => {
    const source = productMap.get(r.sourceProductId);
    const suggested = productMap.get(r.suggestedProductId);

    return {
      id: r.id,
      source_product_id: r.sourceProductId,
      suggested_product_id: r.suggestedProductId,
      rank: r.rank,
      is_promoted: r.isPromoted,
      min_margin_pct: Number(r.minMarginPct),
      created_at: r.createdAt,
      source_product: source
        ? {
            id: source.id,
            name: source.name,
            base_price: Number(source.basePrice),
          }
        : undefined,
      suggested_product: suggested
        ? {
            id: suggested.id,
            name: suggested.name,
            base_price: Number(suggested.basePrice),
            cost_price: Number(suggested.costPrice),
          }
        : undefined,
    };
  });
}

export async function createRule(data: CreateUpsellRuleInput) {
  const [source] = await db
    .select()
    .from(products)
    .where(eq(products.id, data.source_product_id))
    .limit(1);
  if (!source) {
    throw ApiError.notFound(`Source product with ID ${data.source_product_id} not found`);
  }

  const [suggested] = await db
    .select()
    .from(products)
    .where(eq(products.id, data.suggested_product_id))
    .limit(1);
  if (!suggested) {
    throw ApiError.notFound(`Suggested product with ID ${data.suggested_product_id} not found`);
  }

  const [created] = await db
    .insert(upsellRules)
    .values({
      sourceProductId: data.source_product_id,
      suggestedProductId: data.suggested_product_id,
      rank: data.rank ?? 1,
      isPromoted: data.is_promoted ?? false,
      minMarginPct: (data.min_margin_pct ?? 0).toFixed(2),
    })
    .returning();

  return {
    id: created.id,
    source_product_id: created.sourceProductId,
    suggested_product_id: created.suggestedProductId,
    rank: created.rank,
    is_promoted: created.isPromoted,
    min_margin_pct: Number(created.minMarginPct),
    created_at: created.createdAt,
    source_product: {
      id: source.id,
      name: source.name,
      base_price: Number(source.basePrice),
    },
    suggested_product: {
      id: suggested.id,
      name: suggested.name,
      base_price: Number(suggested.basePrice),
      cost_price: Number(suggested.costPrice),
    },
  };
}

export async function deleteRule(id: number) {
  const [existing] = await db.select().from(upsellRules).where(eq(upsellRules.id, id)).limit(1);
  if (!existing) {
    throw ApiError.notFound(`Upsell rule with ID ${id} not found`);
  }

  await db.delete(upsellRules).where(eq(upsellRules.id, id));
  return { success: true, message: `Upsell rule ${id} deleted successfully` };
}
