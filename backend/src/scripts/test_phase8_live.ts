import * as http from "node:http";
import crypto from "node:crypto";
import { app } from "../app.js";
import { generateAccessToken } from "../lib/jwt.js";
import {
  db,
  queryClient,
  users,
  customerTiers,
  customers,
  productCategories,
  products,
  quotes,
  quoteLines,
  warehouses,
  warehouseStock,
  dealAlerts,
  approvalLogs,
} from "@db";
import { eq, desc } from "drizzle-orm";

async function runLiveVerification() {
  console.log("===============================================================================");
  console.log("🚀 DEALFLOW360 PHASE 8 LIVE DATABASE & REST API VERIFICATION");
  console.log("Testing Phase 8 (Analytics, Deal Health, Alerts & Sales Reports)");
  console.log("Database: Remote PostgreSQL via Bore tunnel");
  console.log("===============================================================================\n");

  // Spin up ephemeral HTTP server for live testing
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api/v1`;
  console.log(`📡 Local Test Server running on ${baseUrl}\n`);

  async function api(path: string, options: RequestInit = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string>),
      },
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, data };
  }

  const timestamp = Date.now();

  try {
    // ─────────────────────────────────────────────────────────────
    // STEP 0: FIXTURE SETUP
    // ─────────────────────────────────────────────────────────────
    console.log("▶ [0/5] Setting up database fixtures for Phase 8 Analytics...");

    const [managerUser] = await db
      .insert(users)
      .values({
        name: `Sales Manager ${timestamp}`,
        email: `manager_${timestamp}@dealflow360.dev`,
        role: "manager",
      })
      .returning();

    const [repUser] = await db
      .insert(users)
      .values({
        name: `Senior Rep ${timestamp}`,
        email: `rep_${timestamp}@dealflow360.dev`,
        role: "rep",
      })
      .returning();

    const managerToken = generateAccessToken({
      id: managerUser.id,
      email: managerUser.email,
      role: "manager",
    });
    const repToken = generateAccessToken({
      id: repUser.id,
      email: repUser.email,
      role: "rep",
    });

    // Customer tier
    const [tier] = await db
      .insert(customerTiers)
      .values({
        name: `Strategic Tier ${timestamp}`,
        maxDiscountPct: "15.00",
      })
      .returning();

    // Customer
    const [customer] = await db
      .insert(customers)
      .values({
        name: `Wayne Enterprises ${timestamp}`,
        email: `procurement_${timestamp}@wayne.com`,
        tierId: tier.id,
      })
      .returning();

    // Product Category
    const [category] = await db
      .insert(productCategories)
      .values({
        name: `Enterprise Hardware ${timestamp}`,
        maxDiscountPct: "15.00",
      })
      .returning();

    // Hardware Product
    const [hardwareProd] = await db
      .insert(products)
      .values({
        categoryId: category.id,
        name: `Blade Server X5 ${timestamp}`,
        basePrice: "5000.00",
        costPrice: "3000.00",
        isRecurring: false,
      })
      .returning();

    // Warehouse with 5 units on hand
    const [warehouse] = await db
      .insert(warehouses)
      .values({
        name: `Gotham Depot ${timestamp}`,
        code: `WH-GOTH-${timestamp}`,
        shippingCostWeight: "1.00",
      })
      .returning();

    await db.insert(warehouseStock).values({
      warehouseId: warehouse.id,
      productId: hardwareProd.id,
      quantity: 5,
      quantityOnHand: 5,
      quantityReserved: 0,
    });

    console.log(`  ✓ Manager ID=${managerUser.id}, Rep ID=${repUser.id}, Customer ID=${customer.id}`);
    console.log(`  ✓ Product ID=${hardwareProd.id}, Warehouse ID=${warehouse.id} (5 units stocked)\n`);

    // ─────────────────────────────────────────────────────────────
    // STEP 1: CREATE SCENARIO QUOTES (STALLED, DISCOUNT ANOMALY, DELIVERY RISK)
    // ─────────────────────────────────────────────────────────────
    console.log("▶ [1/5] Creating Deal Health Test Quotations...");

    // 1. Stalled Quote (Inactive for 14 days)
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const [stalledQuote] = await db
      .insert(quotes)
      .values({
        quoteNumber: `QT-STALL-${timestamp}`,
        customerId: customer.id,
        repId: repUser.id,
        status: "sent",
        subtotal: "10000.00",
        grandTotal: "10000.00",
        createdAt: fourteenDaysAgo,
        updatedAt: fourteenDaysAgo,
      })
      .returning();

    // 2. Discount Anomaly Quote (Excess discount 12%, Blended Risk 24.0)
    const [anomalyQuote] = await db
      .insert(quotes)
      .values({
        quoteNumber: `QT-ANOM-${timestamp}`,
        customerId: customer.id,
        repId: repUser.id,
        status: "pending_manager",
        subtotal: "10000.00",
        totalDiscount: "2700.00",
        grandTotal: "7300.00",
        blendedRiskScore: "24.00",
      })
      .returning();

    await db.insert(quoteLines).values({
      quoteId: anomalyQuote.id,
      productId: hardwareProd.id,
      quantity: 2,
      unitPrice: "5000.00",
      costPrice: "3000.00",
      discountPct: "27.00",
      discountAmount: "2700.00",
      lineTotal: "7300.00",
      marginPct: "17.81",
      allowedDiscountPct: "15.00",
      excessPct: "12.00",
      isRecurring: false,
    });

    // 3. Delivery Risk Quote (Demands 15 units when only 5 exist in warehouse)
    const [riskQuote] = await db
      .insert(quotes)
      .values({
        quoteNumber: `QT-RISK-${timestamp}`,
        customerId: customer.id,
        repId: repUser.id,
        status: "submitted",
        subtotal: "75000.00",
        grandTotal: "75000.00",
      })
      .returning();

    await db.insert(quoteLines).values({
      quoteId: riskQuote.id,
      productId: hardwareProd.id,
      quantity: 15,
      unitPrice: "5000.00",
      costPrice: "3000.00",
      lineTotal: "75000.00",
      isRecurring: false,
    });

    console.log(`  ✓ Stalled Quote: ${stalledQuote.quoteNumber} (14 days inactive)`);
    console.log(`  ✓ Anomaly Quote: ${anomalyQuote.quoteNumber} (Excess Discount: 12%, Risk: 24.0)`);
    console.log(`  ✓ Delivery Risk Quote: ${riskQuote.quoteNumber} (Demands 15 units, Stock: 5)\n`);

    // ─────────────────────────────────────────────────────────────
    // STEP 2: DEAL HEALTH API VERIFICATION
    // ─────────────────────────────────────────────────────────────
    console.log("▶ [2/5] Verifying GET /api/v1/analytics/deal-health...");

    // Sales rep should be forbidden (RBAC guard)
    const repHealthRes = await api("/analytics/deal-health", {
      headers: { Authorization: `Bearer ${repToken}` },
    });
    if (repHealthRes.status !== 403) {
      throw new Error(`Expected HTTP 403 for sales rep on /deal-health, got ${repHealthRes.status}`);
    }
    console.log("  ✓ RBAC Guard PASS: Sales Rep forbidden from /deal-health (HTTP 403)");

    // Manager retrieves deal health
    const healthRes = await api("/analytics/deal-health?stalled_days=7", {
      headers: { Authorization: `Bearer ${managerToken}` },
    });

    if (healthRes.status !== 200 || !healthRes.data?.success) {
      throw new Error(`Failed to fetch deal health: ${JSON.stringify(healthRes.data)}`);
    }

    const healthData = healthRes.data.data;
    console.log(`  ✓ GET /analytics/deal-health -> HTTP 200 OK`);

    // 1. Check stalled quotes
    const stalledMatch = healthData.stalled_quotes.find((q: any) => q.id === stalledQuote.id);
    if (!stalledMatch) {
      throw new Error(`Expected stalled quote ${stalledQuote.id} in stalled_quotes list`);
    }
    console.log(`    [Stalled Quotes] Found ${stalledMatch.quote_number}: ${stalledMatch.days_inactive} days inactive (Customer: ${stalledMatch.customer_name})`);

    // 2. Check discount anomalies
    const anomalyMatch = healthData.discount_anomalies.find((q: any) => q.id === anomalyQuote.id);
    if (!anomalyMatch) {
      throw new Error(`Expected anomaly quote ${anomalyQuote.id} in discount_anomalies list`);
    }
    console.log(`    [Discount Anomalies] Found ${anomalyMatch.quote_number}: Excess=${anomalyMatch.excess_pct}%, Risk=${anomalyMatch.blended_risk_score}`);

    // 3. Check delivery risks
    const riskMatch = healthData.delivery_risks.find((r: any) => r.quote_id === riskQuote.id);
    if (!riskMatch) {
      throw new Error(`Expected delivery risk for quote ${riskQuote.id} in delivery_risks list`);
    }
    console.log(`    [Delivery Risks] Found Quote ${riskMatch.quote_id}: Product '${riskMatch.product_name}' has shortage of ${riskMatch.shortage_quantity} units`);

    // ─────────────────────────────────────────────────────────────
    // STEP 3: DEAL ALERTS MANAGEMENT (LIST, ESCALATE, RESOLVE)
    // ─────────────────────────────────────────────────────────────
    console.log("\n▶ [3/5] Verifying Deal Alerts Management (List, Escalate, Resolve)...");

    // Test 3.1: List Alerts
    const alertsRes = await api("/analytics/alerts?is_resolved=false", {
      headers: { Authorization: `Bearer ${managerToken}` },
    });

    if (alertsRes.status !== 200 || !alertsRes.data?.success) {
      throw new Error(`Failed to list alerts: ${JSON.stringify(alertsRes.data)}`);
    }

    const alertsList = alertsRes.data.data;
    console.log(`  ✓ GET /analytics/alerts -> HTTP 200 OK (${alertsList.length} unresolved alert(s) found)`);

    const stalledAlert = alertsList.find((a: any) => a.quote_id === stalledQuote.id && a.type === "stalled");
    const anomalyAlert = alertsList.find((a: any) => a.quote_id === anomalyQuote.id && a.type === "discount_anomaly");

    if (!stalledAlert || !anomalyAlert) {
      throw new Error("Expected auto-synced alerts for stalled quote and discount anomaly");
    }
    console.log(`  ✓ Auto-Synced Alerts Verified: Alert #${stalledAlert.id} (stalled) & Alert #${anomalyAlert.id} (anomaly)`);

    // Test 3.2: Escalate Stalled Alert
    const escalateRes = await api(`/analytics/alerts/${stalledAlert.id}/escalate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${managerToken}` },
      body: JSON.stringify({
        message: "Customer procurement team unresponsive. Senior rep please follow up by EOD.",
      }),
    });

    if (escalateRes.status !== 200 || !escalateRes.data?.success) {
      throw new Error(`Failed to escalate alert: ${JSON.stringify(escalateRes.data)}`);
    }

    console.log(`  ✓ POST /analytics/alerts/:id/escalate -> HTTP 200 OK:`);
    console.log(`    Severity updated to: ${escalateRes.data.data.severity}`);
    console.log(`    Message: "${escalateRes.data.message}"`);

    if (escalateRes.data.data.severity !== "critical") {
      throw new Error(`Expected alert severity to be 'critical', got ${escalateRes.data.data.severity}`);
    }

    // Verify audit log entry in approval_logs table
    const [auditLog] = await db
      .select()
      .from(approvalLogs)
      .where(eq(approvalLogs.quoteId, stalledQuote.id))
      .orderBy(desc(approvalLogs.createdAt))
      .limit(1);

    if (!auditLog || auditLog.action !== "alert_escalated") {
      throw new Error("Expected 'alert_escalated' entry in approval_logs table");
    }
    console.log(`  ✓ Audit Trail Verified in approval_logs: Action='${auditLog.action}', Level='${auditLog.level}'`);

    // Test 3.3: Resolve Anomaly Alert
    const resolveRes = await api(`/analytics/alerts/${anomalyAlert.id}/resolve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${managerToken}` },
    });

    if (resolveRes.status !== 200 || !resolveRes.data?.success) {
      throw new Error(`Failed to resolve alert: ${JSON.stringify(resolveRes.data)}`);
    }
    console.log(`  ✓ POST /analytics/alerts/:id/resolve -> HTTP 200 OK (Alert #${anomalyAlert.id} marked as resolved)`);

    // Verify status in DB
    const [resolvedDbAlert] = await db
      .select()
      .from(dealAlerts)
      .where(eq(dealAlerts.id, anomalyAlert.id));

    if (!resolvedDbAlert || !resolvedDbAlert.isResolved) {
      throw new Error("Expected is_resolved to be true in database");
    }
    console.log("  ✓ Database State Verified: is_resolved = true");

    // ─────────────────────────────────────────────────────────────
    // STEP 4: SALES & MARGIN REPORTS API
    // ─────────────────────────────────────────────────────────────
    console.log("\n▶ [4/5] Verifying Sales & Margin Reports (GET /api/v1/analytics/reports/sales)...");

    const reportRes = await api("/analytics/reports/sales?period=all", {
      headers: { Authorization: `Bearer ${managerToken}` },
    });

    if (reportRes.status !== 200 || !reportRes.data?.success) {
      throw new Error(`Failed to fetch sales report: ${JSON.stringify(reportRes.data)}`);
    }

    const report = reportRes.data.data;
    console.log(`  ✓ GET /analytics/reports/sales -> HTTP 200 OK:`);
    console.log(`    Total Quotes Evaluated: ${report.total_quotes}`);
    console.log(`    Total Pipeline Revenue: $${report.total_revenue}`);
    console.log(`    Avg Discount Pct: ${report.avg_discount_pct}%`);
    console.log(`    Avg Margin Pct: ${report.avg_margin_pct}%`);
    console.log(`    Reps Active: ${report.by_rep.length}`);
    console.log(`    Categories Active: ${report.by_category.length}`);

    if (report.total_quotes < 3 || report.total_revenue <= 0) {
      throw new Error("Expected non-zero sales report metrics");
    }

    const repReport = report.by_rep.find((r: any) => r.rep_id === repUser.id);
    if (!repReport) {
      throw new Error(`Expected rep ${repUser.id} in sales report by_rep breakdown`);
    }
    console.log(`  ✓ Rep Breakdown Verified: Rep '${repReport.rep_name}' has ${repReport.quotes} quote(s) generating $${repReport.revenue}`);

    // ─────────────────────────────────────────────────────────────
    // STEP 5: COMPREHENSIVE SECURITY & RBAC VERIFICATION
    // ─────────────────────────────────────────────────────────────
    console.log("\n▶ [5/5] Comprehensive RBAC Security Checks...");

    const repAlertsRes = await api("/analytics/alerts", {
      headers: { Authorization: `Bearer ${repToken}` },
    });
    const repReportRes = await api("/analytics/reports/sales", {
      headers: { Authorization: `Bearer ${repToken}` },
    });

    if (repAlertsRes.status !== 403 || repReportRes.status !== 403) {
      throw new Error("Security breach: Sales rep was able to access manager analytics!");
    }
    console.log("  ✓ RBAC Guard PASS: All analytics endpoints strictly enforce manager/admin authorization!");

    console.log("\n===============================================================================");
    console.log("🎉 ALL LIVE DB & REST API ENDPOINTS FOR PHASE 8 PASSED WITH 100% SUCCESS!");
    console.log("===============================================================================\n");
  } finally {
    server.close();
    await queryClient.end();
  }
}

runLiveVerification().catch((err) => {
  console.error("\n❌ LIVE TEST FAILED:", err);
  process.exit(1);
});
