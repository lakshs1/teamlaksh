import { eq, and, sql, desc, asc, inArray, gte, notInArray } from "drizzle-orm";
import {
  db,
  quotes,
  quoteLines,
  customers,
  users,
  products,
  productCategories,
  warehouseStock,
  backorders,
  dealAlerts,
  approvalLogs,
} from "@db";
import { ApiError } from "../../lib/api-error.js";
import type { AlertsQuery, SalesReportQuery } from "./analytics.schemas.js";

// ═══════════════════════════════════════════════════════════
// 1. DEAL HEALTH & RISK OVERVIEW
// ═══════════════════════════════════════════════════════════

export async function getDealHealth(stalledDays: number = 7) {
  const now = new Date();
  const stalledThresholdDate = new Date(now.getTime() - stalledDays * 24 * 60 * 60 * 1000);

  // 1. Fetch active quotes (exclude rejected, cancelled, and voided)
  const activeQuotes = await db
    .select()
    .from(quotes)
    .where(notInArray(quotes.status, ["rejected", "cancelled", "voided"]))
    .orderBy(desc(quotes.updatedAt));

  if (activeQuotes.length === 0) {
    return {
      stalled_quotes: [],
      discount_anomalies: [],
      delivery_risks: [],
    };
  }

  // Pre-load reference maps for customers and sales reps
  const custIds = Array.from(new Set(activeQuotes.map((q) => q.customerId)));
  const repIds = Array.from(new Set(activeQuotes.map((q) => q.repId)));
  const quoteIds = activeQuotes.map((q) => q.id);

  const [custList, repList, allLines] = await Promise.all([
    db.select().from(customers).where(inArray(customers.id, custIds)),
    db.select().from(users).where(inArray(users.id, repIds)),
    db.select().from(quoteLines).where(inArray(quoteLines.quoteId, quoteIds)),
  ]);

  const custMap = new Map(custList.map((c) => [c.id, c.name]));
  const repMap = new Map(repList.map((u) => [u.id, u.name]));

  // ─────────────────────────────────────────────────────────
  // A. Stalled Quotations
  // ─────────────────────────────────────────────────────────
  const stalledQuotesList: Array<{
    id: number;
    quote_number: string;
    customer_name: string;
    days_inactive: number;
    grand_total: number;
    rep_name: string;
  }> = [];

  for (const q of activeQuotes) {
    const lastActive = q.updatedAt || q.createdAt;
    if (lastActive <= stalledThresholdDate) {
      const daysInactive = Math.floor(
        (now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24)
      );
      stalledQuotesList.push({
        id: q.id,
        quote_number: q.quoteNumber,
        customer_name: custMap.get(q.customerId) || "Unknown Customer",
        days_inactive: daysInactive,
        grand_total: Number(q.grandTotal),
        rep_name: repMap.get(q.repId) || "Unknown Rep",
      });
    }
  }

  // ─────────────────────────────────────────────────────────
  // B. Discount Anomalies
  // ─────────────────────────────────────────────────────────
  const linesByQuote = new Map<number, typeof allLines>();
  for (const line of allLines) {
    const list = linesByQuote.get(line.quoteId) || [];
    list.push(line);
    linesByQuote.set(line.quoteId, list);
  }

  const discountAnomaliesList: Array<{
    id: number;
    quote_number: string;
    rep_name: string;
    excess_pct: number;
    blended_risk_score: number;
  }> = [];

  for (const q of activeQuotes) {
    const lines = linesByQuote.get(q.id) || [];
    const maxExcess = lines.reduce(
      (max, l) => Math.max(max, Number(l.excessPct || 0)),
      0
    );
    const riskScore = Number(q.blendedRiskScore || 0);

    if (maxExcess > 0 || riskScore > 15) {
      discountAnomaliesList.push({
        id: q.id,
        quote_number: q.quoteNumber,
        rep_name: repMap.get(q.repId) || "Unknown Rep",
        excess_pct: Math.round(maxExcess * 100) / 100,
        blended_risk_score: Math.round(riskScore * 100) / 100,
      });
    }
  }

  // ─────────────────────────────────────────────────────────
  // C. Delivery Risks (Stock Shortages & Backorders)
  // ─────────────────────────────────────────────────────────
  const deliveryRisksList: Array<{
    quote_id: number;
    product_name: string;
    shortage_quantity: number;
  }> = [];

  // Check physical (non-recurring) items for delivery risk
  const physicalLines = allLines.filter((l) => !l.isRecurring);
  if (physicalLines.length > 0) {
    const pIds = Array.from(new Set(physicalLines.map((l) => l.productId)));
    const [prods, stockRows, backorderRows] = await Promise.all([
      db.select().from(products).where(inArray(products.id, pIds)),
      db.select().from(warehouseStock).where(inArray(warehouseStock.productId, pIds)),
      db.select().from(backorders).where(inArray(backorders.quoteId, quoteIds)),
    ]);

    const prodNameMap = new Map(prods.map((p) => [p.id, p.name]));

    // Compute total available physical inventory per product across all warehouses
    const totalStockPerProduct = new Map<number, number>();
    for (const stock of stockRows) {
      const current = totalStockPerProduct.get(stock.productId) || 0;
      const onHand = Number(stock.quantityOnHand ?? stock.quantity ?? 0);
      const reserved = Number(stock.quantityReserved ?? 0);
      totalStockPerProduct.set(stock.productId, current + Math.max(0, onHand - reserved));
    }

    // Check backorders first
    const recordedBackorders = new Set<string>();
    for (const bo of backorderRows) {
      if (bo.quantityBackordered > 0) {
        deliveryRisksList.push({
          quote_id: bo.quoteId,
          product_name: prodNameMap.get(bo.productId) || "Product",
          shortage_quantity: bo.quantityBackordered,
        });
        recordedBackorders.add(`${bo.quoteId}-${bo.productId}`);
      }
    }

    // Check line demand against warehouse stock
    for (const l of physicalLines) {
      const key = `${l.quoteId}-${l.productId}`;
      if (recordedBackorders.has(key)) continue;

      const avail = totalStockPerProduct.get(l.productId) || 0;
      if (l.quantity > avail) {
        const shortage = l.quantity - avail;
        deliveryRisksList.push({
          quote_id: l.quoteId,
          product_name: prodNameMap.get(l.productId) || "Product",
          shortage_quantity: shortage,
        });
      }
    }
  }

  // ─────────────────────────────────────────────────────────
  // D. Automatic Alert Synchronization (deal_alerts table)
  // ─────────────────────────────────────────────────────────
  // Fetch existing unresolved alerts to avoid duplicate spam
  const existingAlerts = await db
    .select()
    .from(dealAlerts)
    .where(and(inArray(dealAlerts.quoteId, quoteIds), eq(dealAlerts.isResolved, false)));

  const existingAlertKeys = new Set(
    existingAlerts.map((a) => `${a.quoteId}:${a.type}`)
  );

  const newAlertsToInsert: Array<{
    quoteId: number;
    type: string;
    message: string;
    severity: string;
  }> = [];

  // Sync stalled quotes
  for (const sq of stalledQuotesList) {
    const key = `${sq.id}:stalled`;
    if (!existingAlertKeys.has(key)) {
      newAlertsToInsert.push({
        quoteId: sq.id,
        type: "stalled",
        severity: sq.days_inactive > 14 ? "critical" : "warning",
        message: `Quote ${sq.quote_number} has had no customer activity for ${sq.days_inactive} days.`,
      });
      existingAlertKeys.add(key);
    }
  }

  // Sync discount anomalies
  for (const da of discountAnomaliesList) {
    const key = `${da.id}:discount_anomaly`;
    if (!existingAlertKeys.has(key)) {
      newAlertsToInsert.push({
        quoteId: da.id,
        type: "discount_anomaly",
        severity: da.excess_pct > 10 || da.blended_risk_score > 25 ? "critical" : "warning",
        message: `Quote ${da.quote_number} has an excess discount of ${da.excess_pct}% and blended risk score of ${da.blended_risk_score}.`,
      });
      existingAlertKeys.add(key);
    }
  }

  // Sync delivery risks
  for (const dr of deliveryRisksList) {
    const key = `${dr.quote_id}:delivery_risk`;
    if (!existingAlertKeys.has(key)) {
      newAlertsToInsert.push({
        quoteId: dr.quote_id,
        type: "delivery_risk",
        severity: "warning",
        message: `Delivery shortage of ${dr.shortage_quantity} units detected for product '${dr.product_name}'.`,
      });
      existingAlertKeys.add(key);
    }
  }

  if (newAlertsToInsert.length > 0) {
    await db.insert(dealAlerts).values(newAlertsToInsert);
  }

  const atRiskQuoteIds = new Set([
    ...stalledQuotesList.map((sq) => sq.id),
    ...discountAnomaliesList.map((da) => da.id),
    ...deliveryRisksList.map((dr) => dr.quote_id),
  ]);

  const totalDeals = activeQuotes.length;
  const atRiskDeals = atRiskQuoteIds.size;
  const healthyDeals = Math.max(0, totalDeals - atRiskDeals);
  const criticalCount =
    existingAlerts.filter((a) => a.severity === "critical").length +
    newAlertsToInsert.filter((a) => a.severity === "critical").length;

  return {
    total: totalDeals,
    healthy: healthyDeals,
    atRisk: atRiskDeals,
    critical: criticalCount,
    stalled_quotes: stalledQuotesList,
    discount_anomalies: discountAnomaliesList,
    delivery_risks: deliveryRisksList,
  };
}

// ═══════════════════════════════════════════════════════════
// 2. LIST DEAL ALERTS
// ═══════════════════════════════════════════════════════════

export async function listAlerts(filter: AlertsQuery) {
  const page = filter.page || 1;
  const limit = filter.limit || 20;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (filter.type) conditions.push(eq(dealAlerts.type, filter.type));
  if (filter.severity) conditions.push(eq(dealAlerts.severity, filter.severity));
  if (filter.is_resolved !== undefined) {
    conditions.push(eq(dealAlerts.isResolved, filter.is_resolved));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(dealAlerts)
    .where(whereClause);

  const total = Number(countResult?.count || 0);

  const rows = await db
    .select()
    .from(dealAlerts)
    .where(whereClause)
    .orderBy(desc(dealAlerts.createdAt))
    .limit(limit)
    .offset(offset);

  if (rows.length === 0) {
    return {
      items: [],
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  // Join quote and customer info
  const qIds = Array.from(new Set(rows.map((r) => r.quoteId)));
  const quoteRows = await db.select().from(quotes).where(inArray(quotes.id, qIds));
  const quoteMap = new Map(quoteRows.map((q) => [q.id, q]));

  const cIds = Array.from(new Set(quoteRows.map((q) => q.customerId).filter(Boolean)));
  const custRows = cIds.length > 0 ? await db.select().from(customers).where(inArray(customers.id, cIds)) : [];
  const custMap = new Map(custRows.map((c) => [c.id, c.name]));

  const repIds = Array.from(new Set(quoteRows.map((q) => q.repId).filter(Boolean)));
  const repRows = repIds.length > 0 ? await db.select().from(users).where(inArray(users.id, repIds)) : [];
  const repMap = new Map(repRows.map((u) => [u.id, u.name]));

  const items = rows.map((a) => {
    const q = quoteMap.get(a.quoteId);
    return {
      id: a.id,
      quote_id: a.quoteId,
      quote_number: q?.quoteNumber,
      customer_name: q ? custMap.get(q.customerId) : undefined,
      rep_name: q ? repMap.get(q.repId) : undefined,
      amount: q ? Number(q.grandTotal) : undefined,
      type: a.type,
      severity: a.severity,
      message: a.message,
      is_resolved: a.isResolved,
      created_at: a.createdAt,
    };
  });

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

// ═══════════════════════════════════════════════════════════
// 3. RESOLVE ALERT
// ═══════════════════════════════════════════════════════════

export async function resolveAlert(id: number) {
  const [alert] = await db.select().from(dealAlerts).where(eq(dealAlerts.id, id)).limit(1);
  if (!alert) throw ApiError.notFound(`Deal alert with ID ${id} not found`);

  const [updated] = await db
    .update(dealAlerts)
    .set({ isResolved: true })
    .where(eq(dealAlerts.id, id))
    .returning();

  return updated;
}

// ═══════════════════════════════════════════════════════════
// 4. ESCALATE ALERT
// ═══════════════════════════════════════════════════════════

export async function escalateAlert(
  id: number,
  managerId: number,
  message?: string
) {
  const [alert] = await db.select().from(dealAlerts).where(eq(dealAlerts.id, id)).limit(1);
  if (!alert) throw ApiError.notFound(`Deal alert with ID ${id} not found`);

  // Update alert severity to critical
  const [updatedAlert] = await db
    .update(dealAlerts)
    .set({ severity: "critical" })
    .where(eq(dealAlerts.id, id))
    .returning();

  // Log escalation in approval audit trail for the quote
  const escalationReason =
    message || `Alert for quote ${alert.quoteId} escalated by sales manager: "${alert.message}"`;

  await db.insert(approvalLogs).values({
    quoteId: alert.quoteId,
    reviewerId: managerId,
    action: "alert_escalated",
    level: "manager",
    reason: escalationReason,
  });

  return updatedAlert;
}

// ═══════════════════════════════════════════════════════════
// 5. SALES & MARGIN REPORT
// ═══════════════════════════════════════════════════════════

export async function getSalesReport(filter: SalesReportQuery) {
  const now = new Date();
  let startDate: Date | null = null;

  if (filter.period === "today") {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (filter.period === "weekly") {
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (filter.period === "monthly") {
    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else if (filter.period === "quarterly") {
    startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  } else if (filter.period === "yearly") {
    startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  }

  // Base query conditions
  const conditions = [];
  if (startDate) {
    conditions.push(gte(quotes.createdAt, startDate));
  }
  if (filter.rep_id) {
    conditions.push(eq(quotes.repId, filter.rep_id));
  }
  if (filter.status && filter.status !== "all") {
    if (filter.status === "pending" || filter.status === "pending_approval") {
      conditions.push(inArray(quotes.status, ["pending_manager", "pending_finance"]));
    } else {
      conditions.push(eq(quotes.status, filter.status));
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const matchedQuotes = await db.select().from(quotes).where(whereClause);

  if (matchedQuotes.length === 0) {
    return {
      total_quotes: 0,
      total_revenue: 0,
      avg_discount_pct: 0,
      avg_margin_pct: 0,
      by_rep: [],
      by_category: [],
    };
  }

  const qIds = matchedQuotes.map((q) => q.id);
  const matchedLines = await db
    .select()
    .from(quoteLines)
    .where(inArray(quoteLines.quoteId, qIds));

  // If filtered by category_id or product_id, filter quotes/lines accordingly
  let filteredLines = matchedLines;
  let relevantProds: any[] = [];

  if (matchedLines.length > 0) {
    const pIds = Array.from(new Set(matchedLines.map((l) => l.productId)));
    relevantProds = await db.select().from(products).where(inArray(products.id, pIds));
  }

  const prodCatMap = new Map(relevantProds.map((p) => [p.id, p.categoryId]));

  if (filter.category_id) {
    filteredLines = filteredLines.filter(
      (l) => prodCatMap.get(l.productId) === filter.category_id
    );
  }

  if (filter.product_id) {
    filteredLines = filteredLines.filter(
      (l) => l.productId === filter.product_id
    );
  }

  // Fetch Reps & Categories for name formatting
  const repIds = Array.from(new Set(matchedQuotes.map((q) => q.repId)));
  const reps = await db.select().from(users).where(inArray(users.id, repIds));
  const repMap = new Map(reps.map((u) => [u.id, u.name]));

  const allCategories = await db.select().from(productCategories);
  const catNameMap = new Map(allCategories.map((c) => [c.id, c.name]));

  // Metrics calculation
  const totalQuotes = matchedQuotes.length;
  const totalRevenue = Math.round(
    matchedQuotes.reduce((sum, q) => sum + Number(q.grandTotal || 0), 0) * 100
  ) / 100;

  // Average discount & margin
  const totalDiscountPct = filteredLines.reduce(
    (sum, l) => sum + Number(l.discountPct || 0),
    0
  );
  const totalMarginPct = filteredLines.reduce(
    (sum, l) => sum + Number(l.marginPct || 0),
    0
  );
  const avgDiscountPct =
    filteredLines.length > 0
      ? Math.round((totalDiscountPct / filteredLines.length) * 10) / 10
      : 0;
  const avgMarginPct =
    filteredLines.length > 0
      ? Math.round((totalMarginPct / filteredLines.length) * 10) / 10
      : 0;

  // Breakdown by Rep
  const repAgg = new Map<number, { quotes: number; revenue: number }>();
  for (const q of matchedQuotes) {
    const curr = repAgg.get(q.repId) || { quotes: 0, revenue: 0 };
    curr.quotes += 1;
    curr.revenue += Number(q.grandTotal || 0);
    repAgg.set(q.repId, curr);
  }

  const byRep = Array.from(repAgg.entries()).map(([rId, data]) => ({
    rep_id: rId,
    rep_name: repMap.get(rId) || "Sales Rep",
    quotes: data.quotes,
    revenue: Math.round(data.revenue * 100) / 100,
  }));

  // Breakdown by Category
  const catAgg = new Map<number, number>();
  for (const line of matchedLines) {
    const catId = prodCatMap.get(line.productId);
    if (catId) {
      const curr = catAgg.get(catId) || 0;
      catAgg.set(catId, curr + Number(line.lineTotal || 0));
    }
  }

  const byCategory = Array.from(catAgg.entries()).map(([cId, revenue]) => ({
    category_id: cId,
    category_name: catNameMap.get(cId) || "Category",
    revenue: Math.round(revenue * 100) / 100,
  }));

  return {
    total_quotes: totalQuotes,
    total_revenue: totalRevenue,
    avg_discount_pct: avgDiscountPct,
    avg_margin_pct: avgMarginPct,
    by_rep: byRep,
    by_category: byCategory,
  };
}
