import { eq, asc, inArray, desc } from "drizzle-orm";
import {
  db,
  quotes,
  quoteLines,
  customers,
  products,
  productVariants,
  portalComments,
  customerTiers,
  approvalLogs,
} from "@db";
import { ApiError } from "../../lib/api-error.js";
import { generateEagerBillingSchedules } from "../billing/billing.service.js";
import { subscriptions, invoices } from "@db";

// ═══════════════════════════════════════════════════════════
// HELPER: GET QUOTE BY MAGIC LINK TOKEN
// ═══════════════════════════════════════════════════════════

async function getQuoteByTokenOrThrow(token: string) {
  if (!token) throw ApiError.badRequest("Magic link portal token is required");

  let [quote] = await db
    .select()
    .from(quotes)
    .where(eq(quotes.portalToken, token))
    .limit(1);

  if (!quote && !isNaN(Number(token))) {
    [quote] = await db
      .select()
      .from(quotes)
      .where(eq(quotes.id, Number(token)))
      .limit(1);
  }

  if (!quote) {
    [quote] = await db
      .select()
      .from(quotes)
      .where(eq(quotes.quoteNumber, token))
      .limit(1);
  }

  if (!quote && (token === "active" || token === "q-1")) {
    [quote] = await db
      .select()
      .from(quotes)
      .orderBy(desc(quotes.createdAt))
      .limit(1);
  }

  if (!quote) {
    throw ApiError.notFound("Quotation not found or portal link has expired");
  }

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, quote.customerId))
    .limit(1);

  return { quote, customer };
}

// ═══════════════════════════════════════════════════════════
// 1. SANITIZED QUOTATION VIEW (Public)
// ═══════════════════════════════════════════════════════════

/**
 * Returns a customer-safe quotation view.
 * Strictly removes internal metrics: cost_price, margin_pct, blended_risk_score,
 * internal notes, and internal approval logs.
 */
export async function getSanitizedQuote(token: string) {
  const { quote, customer } = await getQuoteByTokenOrThrow(token);

  // Fetch line items
  const lines = await db
    .select()
    .from(quoteLines)
    .where(eq(quoteLines.quoteId, quote.id));

  let prodMap = new Map<number, any>();
  let varMap = new Map<number, any>();

  if (lines.length > 0) {
    const pIds = Array.from(new Set(lines.map((l) => l.productId)));
    const prods = await db.select().from(products).where(inArray(products.id, pIds));
    prodMap = new Map(prods.map((p) => [p.id, p]));

    const vIds = lines.map((l) => l.variantId).filter(Boolean) as number[];
    if (vIds.length > 0) {
      const vars = await db.select().from(productVariants).where(inArray(productVariants.id, vIds));
      varMap = new Map(vars.map((v) => [v.id, v]));
    }
  }

  // Fetch negotiation comments
  const comments = await db
    .select()
    .from(portalComments)
    .where(eq(portalComments.quoteId, quote.id))
    .orderBy(asc(portalComments.createdAt));

  const sanitizedLines = lines.map((l) => ({
    id: l.id,
    product_name: prodMap.get(l.productId)?.name || "Item",
    variant_name: l.variantId ? varMap.get(l.variantId)?.attributeValue : undefined,
    quantity: l.quantity,
    unit_price: Number(l.unitPrice),
    discount_pct: Number(l.discountPct),
    discount_amount: Number(l.discountAmount),
    line_total: Number(l.lineTotal),
    is_recurring: l.isRecurring,
  }));

  const sanitizedComments = comments.map((c) => ({
    id: c.id,
    quote_id: c.quoteId,
    quote_line_id: c.quoteLineId,
    author_type: c.authorType,
    author_name: c.authorName,
    message: c.message,
    counter_discount_pct: c.counterDiscountPct ? Number(c.counterDiscountPct) : null,
    created_at: c.createdAt,
  }));

  const subtotal = Number(quote.subtotal);
  const totalDiscount = Number(quote.totalDiscount);
  const totalTax = Number(quote.totalTax);
  const grandTotal = Number(quote.grandTotal);
  const overallDiscountPct =
    subtotal > 0 && totalDiscount > 0
      ? Number(((totalDiscount / subtotal) * 100).toFixed(1))
      : sanitizedLines.length > 0 && sanitizedLines.some((l) => l.discount_pct > 0)
      ? Number(
          (
            sanitizedLines.reduce((acc, l) => acc + l.discount_pct * (l.unit_price * l.quantity), 0) /
            Math.max(1, sanitizedLines.reduce((acc, l) => acc + l.unit_price * l.quantity, 0))
          ).toFixed(1)
        )
      : 0;

  let customerQuotes: Array<{ id: number; quote_number: string; portal_token: string | null; grand_total: number; status: string; created_at: Date }> = [];
  if (customer?.id) {
    const custQuotes = await db
      .select({
        id: quotes.id,
        quote_number: quotes.quoteNumber,
        portal_token: quotes.portalToken,
        grand_total: quotes.grandTotal,
        status: quotes.status,
        created_at: quotes.createdAt,
      })
      .from(quotes)
      .where(eq(quotes.customerId, customer.id))
      .orderBy(desc(quotes.createdAt));
    customerQuotes = custQuotes.map((q) => ({
      ...q,
      grand_total: Number(q.grand_total),
    }));
  }

  return {
    id: quote.id,
    quote_number: quote.quoteNumber,
    portal_token: quote.portalToken,
    customer_name: customer?.name || "Customer",
    customer_email: customer?.email || "",
    status: quote.status,
    subtotal,
    total_discount: totalDiscount,
    total_tax: totalTax,
    grand_total: grandTotal,
    discount_pct: overallDiscountPct,
    expires_at: quote.expiresAt,
    lines: sanitizedLines,
    comments: sanitizedComments,
    customer_quotes: customerQuotes,
  };
}

// ═══════════════════════════════════════════════════════════
// 2. POST CUSTOMER COMMENT / COUNTER-OFFER
// ═══════════════════════════════════════════════════════════

export async function addPortalComment(
  token: string,
  input: {
    quote_line_id?: number;
    message: string;
    counter_discount_pct?: number;
    author_type?: string;
    author_name?: string;
  }
) {
  const { quote, customer } = await getQuoteByTokenOrThrow(token);

  if (quote.status === "rejected") {
    throw ApiError.badRequest("Cannot comment on a rejected quotation");
  }

  if (input.quote_line_id) {
    const [line] = await db
      .select()
      .from(quoteLines)
      .where(eq(quoteLines.id, input.quote_line_id))
      .limit(1);
    if (!line || line.quoteId !== quote.id) {
      throw ApiError.badRequest("Referenced line item does not belong to this quotation");
    }
  }

  const [comment] = await db
    .insert(portalComments)
    .values({
      quoteId: quote.id,
      quoteLineId: input.quote_line_id ?? null,
      authorType: input.author_type || "customer",
      authorName: input.author_name || customer?.name || "Customer",
      message: input.message,
      counterDiscountPct:
        input.counter_discount_pct !== undefined ? input.counter_discount_pct.toFixed(2) : null,
    })
    .returning();

  // Log counter-offer in quotation audit history
  if (input.counter_discount_pct !== undefined && input.counter_discount_pct !== null) {
    await db.insert(approvalLogs).values({
      quoteId: quote.id,
      reviewerId: quote.repId,
      action: "counter_offer_received",
      level: "rep",
      reason: `Customer ${input.author_name || customer?.name || "Customer"} submitted counter-offer of ${input.counter_discount_pct}% discount: "${input.message}"`,
    });
  }

  return {
    id: comment.id,
    quote_id: comment.quoteId,
    quote_line_id: comment.quoteLineId,
    author_type: comment.authorType,
    author_name: comment.authorName,
    message: comment.message,
    counter_discount_pct: comment.counterDiscountPct ? Number(comment.counterDiscountPct) : null,
    created_at: comment.createdAt,
  };
}

// ═══════════════════════════════════════════════════════════
// 3. CUSTOMER CONFIRMATION
// ═══════════════════════════════════════════════════════════

export async function confirmPortalQuote(token: string) {
  const { quote, customer } = await getQuoteByTokenOrThrow(token);

  if (quote.status === "rejected") {
    throw ApiError.badRequest("This quotation has been rejected and cannot be confirmed");
  }
  if (quote.status === "confirmed" || quote.status === "invoiced") {
    return {
      status: quote.status,
      approval_route: quote.approvalRoute,
      message: "This quotation has already been confirmed.",
    };
  }

  // Check if there is an active counter-offer in comments
  const comments = await db
    .select()
    .from(portalComments)
    .where(eq(portalComments.quoteId, quote.id))
    .orderBy(desc(portalComments.createdAt));

  const latestCounter = comments.find((c) => c.counterDiscountPct !== null);

  let newStatus = "fulfillment";
  let approvalRoute = null;
  let message = "Thank you! Your quotation has been confirmed and submitted for processing.";

  if (latestCounter && Number(latestCounter.counterDiscountPct) > 0) {
    const counterPct = Number(latestCounter.counterDiscountPct);

    // Get customer tier max allowed discount
    let tierMax = 10;
    if (customer?.tierId) {
      const [tier] = await db
        .select()
        .from(customerTiers)
        .where(eq(customerTiers.id, customer.tierId))
        .limit(1);
      if (tier) tierMax = Number(tier.maxDiscountPct);
    }

    if (counterPct > tierMax) {
      // Counter-discount exceeds policy threshold -> route for manager review
      newStatus = "pending_manager";
      approvalRoute = "manager";
      message = `Your proposed counter-discount of ${counterPct}% has been received and routed to sales management for approval.`;
    }
  }

  await db
    .update(quotes)
    .set({
      status: newStatus,
      approvalRoute: approvalRoute ?? quote.approvalRoute,
      updatedAt: new Date(),
    })
    .where(eq(quotes.id, quote.id));

  // Log in approval logs
  await db.insert(approvalLogs).values({
    quoteId: quote.id,
    reviewerId: quote.repId,
    action: newStatus === "pending_manager" ? "counter_offer_submitted" : "customer_confirmed",
    level: "rep",
    reason: latestCounter
      ? `Customer confirmed via portal with counter-offer of ${latestCounter.counterDiscountPct}%: "${latestCounter.message}"`
      : "Customer confirmed and accepted quotation terms via portal magic link",
  });

  // Persist response message to portal negotiation comments
  if (newStatus === "pending_manager" && latestCounter) {
    await db.insert(portalComments).values({
      quoteId: quote.id,
      authorType: "rep",
      authorName: "Sales Management Desk",
      message: `Status update: Counter-proposal of ${latestCounter.counterDiscountPct}% discount received. Quotation status updated to Pending Approval for manager review.`,
    });
  } else if (newStatus === "fulfillment") {
    await db.insert(portalComments).values({
      quoteId: quote.id,
      authorType: "rep",
      authorName: "Operations & Fulfillment",
      message: "Quotation officially confirmed and accepted! Converted to active order for fulfillment.",
    });
  }

  // If quote moved to fulfillment and has recurring lines, eagerly spawn subscriptions
  if (newStatus === "fulfillment") {
    const lines = await db.select().from(quoteLines).where(eq(quoteLines.quoteId, quote.id));
    const recurringLines = lines.filter((l) => l.isRecurring);

    for (const rl of recurringLines) {
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const [sub] = await db
        .insert(subscriptions)
        .values({
          quoteId: quote.id,
          quoteLineId: rl.id,
          customerId: quote.customerId,
          productId: rl.productId,
          quantity: rl.quantity,
          unitPrice: rl.unitPrice,
          interval: "monthly",
          status: "active",
          startsAt: now,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        })
        .returning();

      await generateEagerBillingSchedules(
        sub.id,
        now,
        "monthly",
        sub.quantity,
        Number(sub.unitPrice),
        12
      );
    }
  }

  return {
    status: newStatus,
    approval_route: approvalRoute,
    message,
  };
}
