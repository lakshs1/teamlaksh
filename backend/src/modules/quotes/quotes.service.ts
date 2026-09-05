import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  db,
  quotes,
  quoteLines,
  customers,
  customerTiers,
  products,
  productCategories,
  productVariants,
  discountRules,
  approvalLogs,
  users,
  QUOTE_STATUS,
} from "@db";
import { ApiError } from "../../lib/api-error.js";
import { calculateDiscountApprovalRoute } from "../discount-rules/discount-rules.service.js";

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

type QuoteStatus = (typeof QUOTE_STATUS)[number];

interface LineBreakdown {
  lineId: number;
  productId: number;
  discountPct: number;
  allowedDiscountPct: number;
  excessPct: number;
  lineTotal: number;
  approvalRoute: "auto" | "pending_manager" | "pending_finance";
}

interface RiskResult {
  score: number;
  lineBreakdown: LineBreakdown[];
  approvalRoute: "auto" | "manager" | "manager_finance";
  status: QuoteStatus;
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function generateQuoteNumber(count: number): string {
  const year = new Date().getFullYear();
  const seq = String(count + 1).padStart(4, "0");
  return `QT-${year}-${seq}`;
}

async function getQuoteOrThrow(id: number) {
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
  if (!quote) throw ApiError.notFound(`Quote with ID ${id} not found`);
  return quote;
}

/**
 * Recalculates quote-level subtotal, total_discount, total_tax, grand_total
 * from all its lines. Called after every line add/update/delete.
 */
async function recalculateQuoteTotals(quoteId: number) {
  const lines = await db.select().from(quoteLines).where(eq(quoteLines.quoteId, quoteId));

  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;

  for (const line of lines) {
    const qty = line.quantity;
    const unitPrice = parseFloat(line.unitPrice);
    const discountPct = parseFloat(line.discountPct);
    const taxPct = 0; // Tax is product-level; we don't join here — handled via lineTotal

    const lineGross = unitPrice * qty;
    const discountAmt = parseFloat(line.discountAmount);
    const lineNet = parseFloat(line.lineTotal);

    subtotal += lineGross;
    totalDiscount += discountAmt;
  }

  // Re-fetch products for tax
  const lineFull = await db
    .select({
      lineTotal: quoteLines.lineTotal,
      taxPct: products.taxPct,
      quantity: quoteLines.quantity,
    })
    .from(quoteLines)
    .leftJoin(products, eq(quoteLines.productId, products.id))
    .where(eq(quoteLines.quoteId, quoteId));

  for (const l of lineFull) {
    const tax = parseFloat(l.lineTotal) * (parseFloat(l.taxPct ?? "0") / 100);
    totalTax += tax;
  }

  const grandTotal = subtotal - totalDiscount + totalTax;

  await db
    .update(quotes)
    .set({
      subtotal: subtotal.toFixed(2),
      totalDiscount: totalDiscount.toFixed(2),
      totalTax: totalTax.toFixed(2),
      grandTotal: Math.max(0, grandTotal).toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(quotes.id, quoteId));
}

// ═══════════════════════════════════════════════════════════
// BLENDED RISK ENGINE (Pure function — no DB calls)
// ═══════════════════════════════════════════════════════════

/**
 * Computes a weighted blended risk score from all quote lines.
 *
 * Formula per line:
 *   excessPct = max(0, discount_pct - allowed_discount_pct)
 *   lineWeight = line_total / subtotal   (revenue weighting)
 *
 * The blended score = Σ(excessPct * lineWeight)
 *
 * Routing:
 *   If any line has finance-level excess → "manager_finance"
 *   Else if any line has manager-level excess → "manager"
 *   Else → "auto"
 */
export function computeBlendedRisk(
  lines: Array<{
    id: number;
    productId: number;
    discountPct: string | number;
    allowedDiscountPct: string | number;
    lineTotal: string | number;
    approvalRoute?: string | null;
  }>,
  subtotal: number
): RiskResult {
  if (lines.length === 0 || subtotal <= 0) {
    return {
      score: 0,
      lineBreakdown: [],
      approvalRoute: "auto",
      status: "approved",
    };
  }

  let blendedScore = 0;
  let topRoute: "auto" | "manager" | "manager_finance" = "auto";
  const lineBreakdown: LineBreakdown[] = [];

  for (const line of lines) {
    const discountPct = parseFloat(String(line.discountPct));
    const allowedDiscountPct = parseFloat(String(line.allowedDiscountPct));
    const lineTotal = parseFloat(String(line.lineTotal));
    const lineWeight = lineTotal / subtotal;

    const excessPct = Math.max(0, discountPct - allowedDiscountPct);
    const lineRiskContribution = excessPct * lineWeight;
    blendedScore += lineRiskContribution;

    // Determine per-line approval route from stored approvalRoute
    const lineRoute = (line.approvalRoute as "auto" | "pending_manager" | "pending_finance") ?? "auto";

    lineBreakdown.push({
      lineId: line.id,
      productId: line.productId,
      discountPct,
      allowedDiscountPct,
      excessPct,
      lineTotal,
      approvalRoute: lineRoute,
    });

    // Escalate top-level route
    if (lineRoute === "pending_finance") {
      topRoute = "manager_finance";
    } else if (lineRoute === "pending_manager" && topRoute === "auto") {
      topRoute = "manager";
    }
  }

  let finalStatus: QuoteStatus;
  if (topRoute === "auto") {
    finalStatus = "approved";
  } else if (topRoute === "manager") {
    finalStatus = "pending_manager";
  } else {
    finalStatus = "pending_manager"; // goes to manager first, then finance
  }

  return {
    score: Math.round(blendedScore * 100) / 100,
    lineBreakdown,
    approvalRoute: topRoute,
    status: finalStatus,
  };
}

// ═══════════════════════════════════════════════════════════
// QUOTE CRUD
// ═══════════════════════════════════════════════════════════

export async function listQuotes(query: {
  status?: string;
  customer_id?: number;
  rep_id?: number;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 20));
  const offset = (page - 1) * limit;

  const conditions = [];
  if (query.status) conditions.push(eq(quotes.status, query.status));
  if (query.customer_id) conditions.push(eq(quotes.customerId, query.customer_id));
  if (query.rep_id) conditions.push(eq(quotes.repId, query.rep_id));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: quotes.id,
      quoteNumber: quotes.quoteNumber,
      customerId: quotes.customerId,
      repId: quotes.repId,
      status: quotes.status,
      portalToken: quotes.portalToken,
      subtotal: quotes.subtotal,
      totalDiscount: quotes.totalDiscount,
      totalTax: quotes.totalTax,
      grandTotal: quotes.grandTotal,
      blendedRiskScore: quotes.blendedRiskScore,
      approvalRoute: quotes.approvalRoute,
      notes: quotes.notes,
      expiresAt: quotes.expiresAt,
      createdAt: quotes.createdAt,
      updatedAt: quotes.updatedAt,
      customer: {
        id: customers.id,
        name: customers.name,
        email: customers.email,
      },
    })
    .from(quotes)
    .leftJoin(customers, eq(quotes.customerId, customers.id))
    .where(whereClause)
    .orderBy(desc(quotes.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(quotes)
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

export async function getQuoteById(id: number) {
  const [row] = await db
    .select({
      id: quotes.id,
      quoteNumber: quotes.quoteNumber,
      customerId: quotes.customerId,
      repId: quotes.repId,
      status: quotes.status,
      portalToken: quotes.portalToken,
      subtotal: quotes.subtotal,
      totalDiscount: quotes.totalDiscount,
      totalTax: quotes.totalTax,
      grandTotal: quotes.grandTotal,
      blendedRiskScore: quotes.blendedRiskScore,
      approvalRoute: quotes.approvalRoute,
      notes: quotes.notes,
      expiresAt: quotes.expiresAt,
      createdAt: quotes.createdAt,
      updatedAt: quotes.updatedAt,
      customer: {
        id: customers.id,
        name: customers.name,
        email: customers.email,
      },
    })
    .from(quotes)
    .leftJoin(customers, eq(quotes.customerId, customers.id))
    .where(eq(quotes.id, id))
    .limit(1);

  if (!row) throw ApiError.notFound(`Quote with ID ${id} not found`);

  // Fetch lines with product details
  const lines = await db
    .select({
      id: quoteLines.id,
      quoteId: quoteLines.quoteId,
      productId: quoteLines.productId,
      variantId: quoteLines.variantId,
      quantity: quoteLines.quantity,
      unitPrice: quoteLines.unitPrice,
      costPrice: quoteLines.costPrice,
      discountPct: quoteLines.discountPct,
      discountAmount: quoteLines.discountAmount,
      lineTotal: quoteLines.lineTotal,
      marginPct: quoteLines.marginPct,
      allowedDiscountPct: quoteLines.allowedDiscountPct,
      excessPct: quoteLines.excessPct,
      isRecurring: quoteLines.isRecurring,
      isUpsell: quoteLines.isUpsell,
      createdAt: quoteLines.createdAt,
      product: {
        id: products.id,
        name: products.name,
        unit: products.unit,
        basePrice: products.basePrice,
      },
    })
    .from(quoteLines)
    .leftJoin(products, eq(quoteLines.productId, products.id))
    .where(eq(quoteLines.quoteId, id))
    .orderBy(quoteLines.id);

  return { ...row, lines };
}

export async function createQuote(
  repId: number,
  data: { customer_id: number; notes?: string; expires_at?: Date | null }
) {
  // Verify customer exists
  const [customer] = await db.select().from(customers).where(eq(customers.id, data.customer_id)).limit(1);
  if (!customer) throw ApiError.badRequest(`Customer ID ${data.customer_id} does not exist`);

  // Generate sequential quote number
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(quotes);
  const quoteNumber = generateQuoteNumber(count);
  const portalToken = randomUUID();

  const [quote] = await db
    .insert(quotes)
    .values({
      quoteNumber,
      customerId: data.customer_id,
      repId,
      status: "draft",
      portalToken,
      notes: data.notes || null,
      expiresAt: data.expires_at || null,
    })
    .returning();

  return getQuoteById(quote.id);
}

export async function updateQuote(
  id: number,
  repId: number,
  data: { notes?: string | null; expires_at?: Date | null }
) {
  const quote = await getQuoteOrThrow(id);

  if (quote.status !== "draft") {
    throw ApiError.badRequest(`Cannot update a quote with status '${quote.status}'. Only draft quotes can be edited.`);
  }

  await db
    .update(quotes)
    .set({
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.expires_at !== undefined ? { expiresAt: data.expires_at } : {}),
      updatedAt: new Date(),
    })
    .where(eq(quotes.id, id));

  return getQuoteById(id);
}

// ═══════════════════════════════════════════════════════════
// LINE MANAGEMENT
// ═══════════════════════════════════════════════════════════

export async function addLine(
  quoteId: number,
  repId: number,
  data: {
    product_id: number;
    variant_id?: number | null;
    quantity: number;
    discount_pct?: number;
  }
) {
  const quote = await getQuoteOrThrow(quoteId);
  if (quote.status !== "draft") {
    throw ApiError.badRequest(`Cannot add lines to a quote with status '${quote.status}'`);
  }

  // Fetch product with category
  const [productRow] = await db
    .select({
      id: products.id,
      basePrice: products.basePrice,
      costPrice: products.costPrice,
      taxPct: products.taxPct,
      isRecurring: products.isRecurring,
      categoryId: products.categoryId,
      categoryMaxDiscount: productCategories.maxDiscountPct,
    })
    .from(products)
    .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
    .where(eq(products.id, data.product_id))
    .limit(1);

  if (!productRow) throw ApiError.notFound(`Product ID ${data.product_id} not found`);

  // Fetch variant extra price if specified
  let extraPrice = 0;
  if (data.variant_id) {
    const [variant] = await db.select().from(productVariants).where(eq(productVariants.id, data.variant_id)).limit(1);
    if (!variant) throw ApiError.notFound(`Variant ID ${data.variant_id} not found`);
    extraPrice = parseFloat(variant.extraPrice);
  }

  const unitPrice = parseFloat(productRow.basePrice) + extraPrice;
  const costPrice = parseFloat(productRow.costPrice);
  const discountPct = data.discount_pct ?? 0;

  // Determine allowed discount: look up discount_rule for this tier × category
  let allowedDiscountPct = 0;
  let lineApprovalRoute: "auto" | "pending_manager" | "pending_finance" = "auto";

  const [customerRow] = await db
    .select({ tierId: customers.tierId })
    .from(customers)
    .where(eq(customers.id, quote.customerId))
    .limit(1);

  if (customerRow?.tierId) {
    const [tier] = await db.select().from(customerTiers).where(eq(customerTiers.id, customerRow.tierId)).limit(1);
    const [rule] = await db
      .select()
      .from(discountRules)
      .where(and(eq(discountRules.tierId, customerRow.tierId), eq(discountRules.categoryId, productRow.categoryId)))
      .limit(1);

    if (tier) {
      const tierMax = parseFloat(tier.maxDiscountPct);
      const categoryMax = parseFloat(productRow.categoryMaxDiscount ?? "100");
      const ruleMax = rule ? parseFloat(rule.maxDiscountPct) : null;
      const managerThreshold = rule ? parseFloat(rule.managerThresholdPct) : 0;
      const financeThreshold = rule ? parseFloat(rule.financeThresholdPct) : 5;

      allowedDiscountPct = Math.min(tierMax, categoryMax, ruleMax ?? Infinity);

      const evaluation = calculateDiscountApprovalRoute({
        tierMax,
        categoryMax,
        ruleMax,
        requestedDiscountPct: discountPct,
        managerThreshold,
        financeThreshold,
      });
      lineApprovalRoute = evaluation.approvalRoute;
    }
  }

  // Compute line financials
  const qty = data.quantity;
  const discountAmount = unitPrice * qty * (discountPct / 100);
  const lineTotal = unitPrice * qty - discountAmount;
  const marginPct = lineTotal > 0 ? ((lineTotal - costPrice * qty) / lineTotal) * 100 : 0;
  const excessPct = Math.max(0, discountPct - allowedDiscountPct);

  const [line] = await db
    .insert(quoteLines)
    .values({
      quoteId,
      productId: data.product_id,
      variantId: data.variant_id || null,
      quantity: qty,
      unitPrice: unitPrice.toFixed(2),
      costPrice: costPrice.toFixed(2),
      discountPct: discountPct.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      lineTotal: lineTotal.toFixed(2),
      marginPct: marginPct.toFixed(2),
      allowedDiscountPct: allowedDiscountPct.toFixed(2),
      excessPct: excessPct.toFixed(2),
      isRecurring: productRow.isRecurring,
    })
    .returning();

  await recalculateQuoteTotals(quoteId);
  return line;
}

export async function updateLine(
  quoteId: number,
  lineId: number,
  repId: number,
  data: { quantity?: number; discount_pct?: number }
) {
  const quote = await getQuoteOrThrow(quoteId);
  if (quote.status !== "draft") {
    throw ApiError.badRequest(`Cannot edit lines on a quote with status '${quote.status}'`);
  }

  const [existing] = await db
    .select()
    .from(quoteLines)
    .where(and(eq(quoteLines.id, lineId), eq(quoteLines.quoteId, quoteId)))
    .limit(1);

  if (!existing) throw ApiError.notFound(`Line ID ${lineId} not found on Quote ${quoteId}`);

  const qty = data.quantity ?? existing.quantity;
  const discountPct = data.discount_pct !== undefined ? data.discount_pct : parseFloat(existing.discountPct);
  const unitPrice = parseFloat(existing.unitPrice);
  const costPrice = parseFloat(existing.costPrice);
  const allowedDiscountPct = parseFloat(existing.allowedDiscountPct);

  const discountAmount = unitPrice * qty * (discountPct / 100);
  const lineTotal = unitPrice * qty - discountAmount;
  const marginPct = lineTotal > 0 ? ((lineTotal - costPrice * qty) / lineTotal) * 100 : 0;
  const excessPct = Math.max(0, discountPct - allowedDiscountPct);

  const [updated] = await db
    .update(quoteLines)
    .set({
      quantity: qty,
      discountPct: discountPct.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      lineTotal: lineTotal.toFixed(2),
      marginPct: marginPct.toFixed(2),
      excessPct: excessPct.toFixed(2),
    })
    .where(eq(quoteLines.id, lineId))
    .returning();

  await recalculateQuoteTotals(quoteId);
  return updated;
}

export async function deleteLine(quoteId: number, lineId: number, repId: number) {
  const quote = await getQuoteOrThrow(quoteId);
  if (quote.status !== "draft") {
    throw ApiError.badRequest(`Cannot delete lines from a quote with status '${quote.status}'`);
  }

  const [existing] = await db
    .select()
    .from(quoteLines)
    .where(and(eq(quoteLines.id, lineId), eq(quoteLines.quoteId, quoteId)))
    .limit(1);

  if (!existing) throw ApiError.notFound(`Line ID ${lineId} not found on Quote ${quoteId}`);

  await db.delete(quoteLines).where(eq(quoteLines.id, lineId));
  await recalculateQuoteTotals(quoteId);

  return { deleted: true, lineId };
}

// ═══════════════════════════════════════════════════════════
// STATE MACHINE — SUBMIT
// ═══════════════════════════════════════════════════════════

export async function submitQuote(quoteId: number, repId: number) {
  const quote = await getQuoteOrThrow(quoteId);

  if (quote.status !== "draft") {
    throw ApiError.badRequest(`Cannot submit a quote with status '${quote.status}'. Only draft quotes can be submitted.`);
  }

  // Fetch all lines with approvalRoute stored per line
  const lines = await db
    .select({
      id: quoteLines.id,
      productId: quoteLines.productId,
      discountPct: quoteLines.discountPct,
      allowedDiscountPct: quoteLines.allowedDiscountPct,
      lineTotal: quoteLines.lineTotal,
      excessPct: quoteLines.excessPct,
    })
    .from(quoteLines)
    .where(eq(quoteLines.quoteId, quoteId));

  if (lines.length === 0) {
    throw ApiError.badRequest("Cannot submit a quote with no lines. Add at least one product.");
  }

  const subtotal = parseFloat(quote.subtotal);

  // Re-run risk evaluation per line for routing
  const enrichedLines = lines.map((line) => ({
    ...line,
    approvalRoute: (() => {
      const disc = parseFloat(String(line.discountPct));
      const allowed = parseFloat(String(line.allowedDiscountPct));
      if (disc <= 0 || allowed >= disc) return "auto";
      // Simple re-evaluation based on excess magnitude
      const excess = disc - allowed;
      // Use allowed as threshold reference (finance = allowed/2)
      if (excess > allowed * 0.5) return "pending_finance";
      return "pending_manager";
    })() as "auto" | "pending_manager" | "pending_finance",
  }));

  const riskResult = computeBlendedRisk(enrichedLines, subtotal > 0 ? subtotal : 1);

  // Map internal route to DB field value
  const dbApprovalRoute =
    riskResult.approvalRoute === "auto"
      ? "auto"
      : riskResult.approvalRoute === "manager"
      ? "manager"
      : "manager_finance";

  await db
    .update(quotes)
    .set({
      status: riskResult.status,
      blendedRiskScore: riskResult.score.toFixed(2),
      approvalRoute: dbApprovalRoute,
      updatedAt: new Date(),
    })
    .where(eq(quotes.id, quoteId));

  // Log the submission
  await db.insert(approvalLogs).values({
    quoteId,
    reviewerId: repId,
    action: "submitted",
    level: "rep",
    reason: `Blended risk score: ${riskResult.score}. Route: ${dbApprovalRoute}`,
  });

  const routeLabel =
    riskResult.approvalRoute === "auto"
      ? "Auto-approved — no excess discounts"
      : riskResult.approvalRoute === "manager"
      ? "Routed to manager approval"
      : "Routed to manager + finance approval";

  return {
    id: quoteId,
    status: riskResult.status,
    blendedRiskScore: riskResult.score.toFixed(2),
    approvalRoute: dbApprovalRoute,
    message: routeLabel,
  };
}

// ═══════════════════════════════════════════════════════════
// STATE MACHINE — CONFIRM
// ═══════════════════════════════════════════════════════════

export async function confirmQuote(quoteId: number, repId: number) {
  const quote = await getQuoteOrThrow(quoteId);

  if (quote.status !== "approved") {
    throw ApiError.badRequest(
      `Cannot confirm a quote with status '${quote.status}'. Only approved quotes can be confirmed.`
    );
  }

  await db
    .update(quotes)
    .set({ status: "fulfillment", updatedAt: new Date() })
    .where(eq(quotes.id, quoteId));

  await db.insert(approvalLogs).values({
    quoteId,
    reviewerId: repId,
    action: "confirmed",
    level: "rep",
    reason: "Quote confirmed by rep — moved to fulfillment",
  });

  return getQuoteById(quoteId);
}
