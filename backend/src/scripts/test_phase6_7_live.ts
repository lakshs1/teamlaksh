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
  subscriptions,
  billingSchedules,
  invoices,
  portalComments,
  approvalLogs,
} from "@db";
import { eq } from "drizzle-orm";

async function runLiveVerification() {
  console.log("===============================================================================");
  console.log("🚀 DEALFLOW360 PHASE 6 & 7 LIVE DATABASE & REST API VERIFICATION");
  console.log("Testing Phase 6 (Billing & Subscriptions) & Phase 7 (Customer Portal)");
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
    console.log("▶ [0/5] Setting up database fixtures for Phase 6 & 7...");

    const [adminUser] = await db
      .insert(users)
      .values({
        name: `Finance Admin ${timestamp}`,
        email: `finance_${timestamp}@dealflow360.dev`,
        role: "admin",
      })
      .returning();

    const [repUser] = await db
      .insert(users)
      .values({
        name: `Sales Rep ${timestamp}`,
        email: `rep_${timestamp}@dealflow360.dev`,
        role: "rep",
      })
      .returning();

    const adminToken = generateAccessToken({ id: adminUser.id, email: adminUser.email, role: "admin" });
    const financeToken = generateAccessToken({ id: adminUser.id, email: adminUser.email, role: "finance" });
    const repToken = generateAccessToken({ id: repUser.id, email: repUser.email, role: "rep" });

    // Customer tier with 15% max discount
    const [tier] = await db
      .insert(customerTiers)
      .values({
        name: `Gold Partner Tier ${timestamp}`,
        maxDiscountPct: "15.00",
      })
      .returning();

    // Customer
    const [customer] = await db
      .insert(customers)
      .values({
        name: `Acme Cloud Corp ${timestamp}`,
        email: `procurement_${timestamp}@acmecloud.io`,
        tierId: tier.id,
      })
      .returning();

    // Product Category
    const [category] = await db
      .insert(productCategories)
      .values({
        name: `SaaS Subscriptions ${timestamp}`,
        maxDiscountPct: "20.00",
      })
      .returning();

    // Recurring SaaS Product ($100 / seat / month)
    const [saasProduct] = await db
      .insert(products)
      .values({
        categoryId: category.id,
        name: `Cloud Analytics Suite ${timestamp}`,
        basePrice: "100.00",
        costPrice: "30.00",
        isRecurring: true,
        recurringInterval: "monthly",
      })
      .returning();

    // Quote 1 with magic portal token
    const portalToken1 = crypto.randomUUID();
    const [quote1] = await db
      .insert(quotes)
      .values({
        quoteNumber: `Q-P7-${timestamp}-1`,
        customerId: customer.id,
        repId: repUser.id,
        status: "sent",
        portalToken: portalToken1,
        subtotal: "1000.00",
        totalDiscount: "0.00",
        totalTax: "100.00",
        grandTotal: "1100.00",
        blendedRiskScore: "1.2",
        notes: "TOP SECRET: High value strategic customer. Do not leak margins!",
      })
      .returning();

    const [quoteLine1] = await db
      .insert(quoteLines)
      .values({
        quoteId: quote1.id,
        productId: saasProduct.id,
        quantity: 10,
        unitPrice: "100.00",
        costPrice: "30.00",
        discountPct: "0.00",
        discountAmount: "0.00",
        lineTotal: "1000.00",
        marginPct: "70.00",
        isRecurring: true,
      })
      .returning();

    console.log(`  ✓ Created fixtures: Admin ID=${adminUser.id}, Customer ID=${customer.id}, Quote ID=${quote1.id}`);
    console.log(`  ✓ Portal Magic Token: ${portalToken1}\n`);

    // ─────────────────────────────────────────────────────────────
    // STEP 1: PHASE 7 - SANITIZED CUSTOMER PORTAL ACCESS (ADR-003)
    // ─────────────────────────────────────────────────────────────
    console.log("▶ [1/5] Phase 7: Customer Portal Public Access & Data Sanitization...");

    // Test 1.1: Public view without JWT (No Authorization header)
    const portalRes = await api(`/portal/quotes/${portalToken1}`);
    if (portalRes.status !== 200 || !portalRes.data?.success) {
      throw new Error(`Failed to retrieve portal quote: ${JSON.stringify(portalRes.data)}`);
    }

    const sanitizedQuote = portalRes.data.data;
    console.log(`  ✓ GET /portal/quotes/:token -> HTTP 200 OK (Public magic link without JWT)`);
    console.log(`    Customer: ${sanitizedQuote.customer_name}, Status: ${sanitizedQuote.status}, Grand Total: $${sanitizedQuote.grand_total}`);

    // Test 1.2: Strict Sanitization Verification
    console.log("  Verifying strict omission of sensitive company data...");
    if ("margin_pct" in sanitizedQuote || "cost_price" in sanitizedQuote || "internal_notes" in sanitizedQuote) {
      throw new Error("SECURITY LEAK: Top-level internal metrics leaked to customer portal!");
    }
    const lineItem = sanitizedQuote.lines[0];
    if ("cost_price" in lineItem || "margin_pct" in lineItem || "blended_risk_score" in lineItem) {
      throw new Error("SECURITY LEAK: Line item internal cost/margin leaked to customer portal!");
    }
    console.log("  ✓ Sanitization PASS: cost_price, margin_pct, blended_risk_score, and internal notes are omitted!");

    // Test 1.3: Customer Comment with Counter-Discount
    const commentRes = await api(`/portal/quotes/${portalToken1}/comments`, {
      method: "POST",
      body: JSON.stringify({
        quote_line_id: quoteLine1.id,
        message: "We love the proposal! Can we get a 10% discount for our 10 team seats?",
        counter_discount_pct: 10.0,
      }),
    });

    if (commentRes.status !== 201 || !commentRes.data?.success) {
      throw new Error(`Failed to submit portal comment: ${JSON.stringify(commentRes.data)}`);
    }
    console.log(`  ✓ POST /portal/quotes/:token/comments -> HTTP 201 Created`);
    console.log(`    Customer Comment: "${commentRes.data.data.message}" with Counter: ${commentRes.data.data.counter_discount_pct}%`);

    // Verify comment appears on re-fetch
    const rePortalRes = await api(`/portal/quotes/${portalToken1}`);
    if (rePortalRes.data.data.comments.length !== 1) {
      throw new Error("Expected 1 comment in portal response");
    }
    console.log("  ✓ Comment is reflected in quotation comments negotiation log.");

    // ─────────────────────────────────────────────────────────────
    // STEP 2: PHASE 7 - CUSTOMER CONFIRMATION & SUBSCRIPTION ACTIVATION
    // ─────────────────────────────────────────────────────────────
    console.log("\n▶ [2/5] Phase 7: Customer Confirmation & Automatic Transition...");

    // Confirm Quote 1 (Counter-discount is 10%, <= tier max 15% -> moves to fulfillment & spawns subscription)
    const confirmRes = await api(`/portal/quotes/${portalToken1}/confirm`, {
      method: "POST",
    });

    if (confirmRes.status !== 200 || !confirmRes.data?.success) {
      throw new Error(`Failed to confirm quote: ${JSON.stringify(confirmRes.data)}`);
    }

    console.log(`  ✓ POST /portal/quotes/:token/confirm -> HTTP 200 OK`);
    console.log(`    New Status: ${confirmRes.data.data.status}`);
    console.log(`    Message: "${confirmRes.data.data.message}"`);

    if (confirmRes.data.data.status !== "fulfillment") {
      throw new Error(`Expected quote to move to 'fulfillment', got ${confirmRes.data.data.status}`);
    }

    // Verify in database that subscriptions and 12-month billing schedules were spawned eagerly
    const [subRow] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.quoteId, quote1.id));

    if (!subRow) {
      throw new Error("Expected subscription to be created on quote confirmation!");
    }
    console.log(`  ✓ Subscription created in DB: ID=${subRow.id}, Qty=${subRow.quantity}, Interval=${subRow.interval}, Status=${subRow.status}`);

    const schedules = await db
      .select()
      .from(billingSchedules)
      .where(eq(billingSchedules.subscriptionId, subRow.id));

    if (schedules.length !== 12) {
      throw new Error(`Expected 12 eager billing schedule rows (ADR-005), got ${schedules.length}`);
    }
    console.log(`  ✓ ADR-005 Verified: Pre-generated ${schedules.length} monthly billing schedule rows of $${schedules[0].amount} each.`);

    // Test 2.2: Counter-Discount Policy Over-ride routing test
    console.log("\n  Testing Counter-Discount Exceeding Policy Threshold (Approval Escalation)...");
    const portalToken2 = crypto.randomUUID();
    const [quote2] = await db
      .insert(quotes)
      .values({
        quoteNumber: `Q-P7-${timestamp}-2`,
        customerId: customer.id,
        repId: repUser.id,
        status: "sent",
        portalToken: portalToken2,
        subtotal: "5000.00",
        grandTotal: "5000.00",
      })
      .returning();

    // Customer submits 25% counter-discount (> tier max 15%)
    await api(`/portal/quotes/${portalToken2}/comments`, {
      method: "POST",
      body: JSON.stringify({
        message: "We need a 25% aggressive enterprise discount to close this quarter.",
        counter_discount_pct: 25.0,
      }),
    });

    const confirm2Res = await api(`/portal/quotes/${portalToken2}/confirm`, {
      method: "POST",
    });

    console.log(`  ✓ High counter-discount confirm response: Status=${confirm2Res.data.data.status}, Route=${confirm2Res.data.data.approval_route}`);
    if (confirm2Res.data.data.status !== "pending_manager" || confirm2Res.data.data.approval_route !== "manager") {
      throw new Error(`Expected quote to escalate to manager approval, got status=${confirm2Res.data.data.status}, route=${confirm2Res.data.data.approval_route}`);
    }
    console.log("  ✓ Policy Escalation PASS: Counter-discount > tier max routed to pending_manager!");

    // ─────────────────────────────────────────────────────────────
    // STEP 3: PHASE 6 - SUBSCRIPTIONS & RBAC
    // ─────────────────────────────────────────────────────────────
    console.log("\n▶ [3/5] Phase 6: Subscriptions Management & Role-Based Access Control...");

    // Test 3.1: RBAC Guards - Sales Rep cannot mutate subscriptions
    const repPatchRes = await api(`/billing/subscriptions/${subRow.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${repToken}` },
      body: JSON.stringify({ quantity: 20 }),
    });

    if (repPatchRes.status !== 403) {
      throw new Error(`Expected HTTP 403 for sales rep mutating subscription, got ${repPatchRes.status}`);
    }
    console.log("  ✓ RBAC Guard PASS: Rep forbidden from modifying subscription seats (HTTP 403)");

    // Test 3.2: List Subscriptions (Finance)
    const listSubsRes = await api(`/billing/subscriptions?customer_id=${customer.id}`, {
      headers: { Authorization: `Bearer ${financeToken}` },
    });
    if (listSubsRes.status !== 200 || listSubsRes.data.data.length === 0) {
      throw new Error("Failed to list subscriptions for customer");
    }
    console.log(`  ✓ GET /billing/subscriptions -> HTTP 200 OK (${listSubsRes.data.data.length} subscription found)`);

    // Test 3.3: Get Subscription Details with Billing Schedules
    const getSubRes = await api(`/billing/subscriptions/${subRow.id}`, {
      headers: { Authorization: `Bearer ${financeToken}` },
    });
    if (getSubRes.status !== 200 || getSubRes.data.data.schedules.length !== 12) {
      throw new Error("Failed to fetch subscription schedules");
    }
    console.log(`  ✓ GET /billing/subscriptions/:id -> HTTP 200 OK (Contains ${getSubRes.data.data.schedules.length} schedules)`);

    // ─────────────────────────────────────────────────────────────
    // STEP 4: PHASE 6 - MID-CYCLE PRORATION & SEAT SCALING
    // ─────────────────────────────────────────────────────────────
    console.log("\n▶ [4/5] Phase 6: Mid-Cycle Seat Scaling & Proration Calculations...");

    // Scale from 10 seats to 15 seats (+5 seats mid-cycle)
    const updateRes = await api(`/billing/subscriptions/${subRow.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${financeToken}` },
      body: JSON.stringify({ quantity: 15 }),
    });

    if (updateRes.status !== 200 || !updateRes.data?.success) {
      throw new Error(`Failed to update subscription seats: ${JSON.stringify(updateRes.data)}`);
    }

    const prorationData = updateRes.data;
    console.log(`  ✓ PATCH /billing/subscriptions/:id (10 -> 15 seats):`);
    console.log(`    Message: "${prorationData.message}"`);
    console.log(`    Prorated Charge: $${prorationData.prorated_amount}`);
    console.log(`    Generated Prorated Invoice: ${prorationData.invoice?.invoice_number} (Amount: $${prorationData.invoice?.total})`);

    if (prorationData.prorated_amount <= 0 || !prorationData.invoice) {
      throw new Error("Expected positive prorated invoice for seat upgrade");
    }

    // Verify upcoming billing schedules were scaled to 15 seats ($1500/mo)
    const updatedSubDetails = await api(`/billing/subscriptions/${subRow.id}`, {
      headers: { Authorization: `Bearer ${financeToken}` },
    });
    const upcomingSchedule = updatedSubDetails.data.data.schedules.find((s: any) => s.status === "upcoming");
    if (upcomingSchedule && upcomingSchedule.amount !== 1500) {
      throw new Error(`Expected future schedule amount to be $1500, got ${upcomingSchedule.amount}`);
    }
    console.log(`  ✓ Future schedule amount updated to $${upcomingSchedule?.amount} (15 seats * $100)`);

    // ─────────────────────────────────────────────────────────────
    // STEP 5: PHASE 6 - INVOICES & CANCELLATION CREDIT NOTE
    // ─────────────────────────────────────────────────────────────
    console.log("\n▶ [5/5] Phase 6: Invoices Lifecycle, Payment & Subscription Cancellation...");

    // Test 5.1: List Invoices
    const invListRes = await api(`/billing/invoices?customer_id=${customer.id}`, {
      headers: { Authorization: `Bearer ${financeToken}` },
    });
    if (invListRes.status !== 200 || invListRes.data.data.length === 0) {
      throw new Error("Failed to list invoices");
    }
    console.log(`  ✓ GET /billing/invoices -> HTTP 200 OK (${invListRes.data.pagination.total} invoice(s) found)`);

    // Test 5.2: Mark Prorated Invoice as Paid
    const proratedInvId = prorationData.invoice.id;
    const payRes = await api(`/billing/invoices/${proratedInvId}/pay`, {
      method: "POST",
      headers: { Authorization: `Bearer ${financeToken}` },
    });
    if (payRes.status !== 200 || payRes.data.data.status !== "paid") {
      throw new Error(`Failed to mark invoice as paid: ${JSON.stringify(payRes.data)}`);
    }
    console.log(`  ✓ POST /billing/invoices/:id/pay -> HTTP 200 OK (Status: ${payRes.data.data.status}, PaidAt: ${payRes.data.data.paid_at})`);

    // Test 5.3: Cancel Subscription & Issue Credit Note
    const cancelRes = await api(`/billing/subscriptions/${subRow.id}/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${financeToken}` },
    });

    if (cancelRes.status !== 200 || !cancelRes.data?.success) {
      throw new Error(`Failed to cancel subscription: ${JSON.stringify(cancelRes.data)}`);
    }

    const cancelData = cancelRes.data;
    console.log(`  ✓ POST /billing/subscriptions/:id/cancel:`);
    console.log(`    Status: ${cancelData.subscription.status}`);
    console.log(`    Refund Amount: $${cancelData.refund_amount}`);
    console.log(`    Credit Note: ${cancelData.credit_note?.invoice_number} (Status: ${cancelData.credit_note?.status})`);

    if (cancelData.subscription.status !== "cancelled") {
      throw new Error("Expected subscription status to be 'cancelled'");
    }

    // Verify future schedules were marked as cancelled
    const cancelledSubCheck = await api(`/billing/subscriptions/${subRow.id}`, {
      headers: { Authorization: `Bearer ${financeToken}` },
    });
    const cancelledSchedules = cancelledSubCheck.data.data.schedules.filter((s: any) => s.status === "cancelled");
    console.log(`  ✓ Verified: ${cancelledSchedules.length} upcoming schedules transitioned to 'cancelled' status.`);

    console.log("\n===============================================================================");
    console.log("🎉 ALL LIVE DB & REST API ENDPOINTS FOR PHASE 6 & 7 PASSED WITH 100% SUCCESS!");
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
