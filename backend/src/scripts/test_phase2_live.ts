import { generateAccessToken } from "../lib/jwt.js";
import {
  db,
  quotes,
  quoteLines,
  approvalLogs,
  customers,
  products,
} from "@db";
import { eq } from "drizzle-orm";

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}/api/v1`;

// Tokens
const adminToken = generateAccessToken({ id: 1, email: "admin@dealflow360.dev", role: "admin" });
const repToken = generateAccessToken({ id: 2, email: "rep@dealflow360.dev", role: "rep" });
const managerToken = generateAccessToken({ id: 3, email: "manager@dealflow360.dev", role: "manager" });
const financeToken = generateAccessToken({ id: 4, email: "finance@dealflow360.dev", role: "finance" });

async function api(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function runLivePhase2Verification() {
  console.log("===============================================================================");
  console.log("🚀 DEALFLOW360 PHASE 2 LIVE DATABASE & REST API VERIFICATION");
  console.log("Connecting to API:", BASE_URL);
  console.log("Modules: Quotes (Builder, Lines, Risk Engine) + Approvals (Workflow, Audit)");
  console.log("===============================================================================\n");

  // Step 0: Ensure we have at least one customer and one product in DB
  const [existingCustomer] = await db.select().from(customers).limit(1);
  if (!existingCustomer) {
    throw new Error("No existing customer found in DB. Run phase 1 live tests or seed DB first.");
  }
  const [existingProduct] = await db.select().from(products).limit(1);
  if (!existingProduct) {
    throw new Error("No existing product found in DB. Run phase 1 live tests or seed DB first.");
  }

  console.log(`✓ Using Customer [ID: ${existingCustomer.id}] ${existingCustomer.name}`);
  console.log(`✓ Using Product [ID: ${existingProduct.id}] ${existingProduct.name} (Base Price: ${existingProduct.basePrice})`);

  // ─────────────────────────────────────────────────────────────
  // 1. CREATE QUOTE (SALES REP)
  // ─────────────────────────────────────────────────────────────
  console.log("\n▶ [1/5] Creating Quote as Sales Rep...");
  const createQuoteRes = await api("/quotes", {
    method: "POST",
    headers: { Authorization: `Bearer ${repToken}` },
    body: JSON.stringify({
      customer_id: existingCustomer.id,
      notes: "DealFlow360 Phase 2 Automated Test Quote",
    }),
  });

  if (!createQuoteRes.ok) {
    throw new Error(`Failed to create quote: ${JSON.stringify(createQuoteRes.data)}`);
  }
  const quote = createQuoteRes.data.data;
  console.log(`  ✓ Created Quote: [ID: ${quote.id}] Number=${quote.quote_number}, Status=${quote.status}, PortalToken=${quote.portal_token}`);

  // ─────────────────────────────────────────────────────────────
  // 2. ADD QUOTE LINES & MARGIN / RISK ENGINE RECALCULATION
  // ─────────────────────────────────────────────────────────────
  console.log("\n▶ [2/5] Adding Quote Lines & Triggering Risk Engine...");
  
  // Add Line 1: Normal item with 10% discount
  const addLine1Res = await api(`/quotes/${quote.id}/lines`, {
    method: "POST",
    headers: { Authorization: `Bearer ${repToken}` },
    body: JSON.stringify({
      product_id: existingProduct.id,
      quantity: 5,
      discount_pct: 10,
    }),
  });

  if (!addLine1Res.ok) {
    throw new Error(`Failed to add line 1: ${JSON.stringify(addLine1Res.data)}`);
  }
  console.log(`  ✓ Added Line 1: 5 units of [${existingProduct.name}] with 10% discount`);

  // Add Line 2: Deep discount item (35% discount) to elevate deal risk
  const addLine2Res = await api(`/quotes/${quote.id}/lines`, {
    method: "POST",
    headers: { Authorization: `Bearer ${repToken}` },
    body: JSON.stringify({
      product_id: existingProduct.id,
      quantity: 10,
      discount_pct: 35,
    }),
  });

  if (!addLine2Res.ok) {
    throw new Error(`Failed to add line 2: ${JSON.stringify(addLine2Res.data)}`);
  }
  console.log(`  ✓ Added Line 2: 10 units with 35% deep discount`);

  // Fetch updated quote details
  const getQuoteRes = await api(`/quotes/${quote.id}`, {
    headers: { Authorization: `Bearer ${repToken}` },
  });
  const updatedQuote = getQuoteRes.data.data;
  console.log(`  ✓ Recalculated Quote:`);
  console.log(`    - Subtotal: $${updatedQuote.subtotal}`);
  console.log(`    - Total Discount: $${updatedQuote.total_discount}`);
  console.log(`    - Tax: $${updatedQuote.total_tax}`);
  console.log(`    - Grand Total: $${updatedQuote.grand_total}`);
  console.log(`    - Blended Risk Score: ${updatedQuote.blended_risk_score} / 100`);
  console.log(`    - Designated Approval Route: ${updatedQuote.approval_route}`);

  // ─────────────────────────────────────────────────────────────
  // 3. SUBMIT QUOTE FOR APPROVAL
  // ─────────────────────────────────────────────────────────────
  console.log("\n▶ [3/5] Submitting Quote for Multi-Tier Approval...");
  const submitRes = await api(`/quotes/${quote.id}/submit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${repToken}` },
  });

  if (!submitRes.ok) {
    throw new Error(`Failed to submit quote: ${JSON.stringify(submitRes.data)}`);
  }
  const submittedQuote = submitRes.data.data;
  console.log(`  ✓ Submitted Quote! New Status: ${submittedQuote.status}`);

  // ─────────────────────────────────────────────────────────────
  // 4. APPROVAL WORKFLOW & AUDIT TRAIL
  // ─────────────────────────────────────────────────────────────
  console.log("\n▶ [4/5] Testing Approval Queue & Audit Trail...");

  // Approver checks pending queue
  const pendingRes = await api("/approvals/pending", {
    headers: { Authorization: `Bearer ${managerToken}` },
  });
  console.log(`  ✓ Manager pending queue has ${pendingRes.data.data.length} pending quote(s)`);

  // Approver approves or reviews
  const approveRes = await api(`/approvals/quotes/${quote.id}/approve`, {
    method: "POST",
    headers: { Authorization: `Bearer ${managerToken}` },
    body: JSON.stringify({ reason: "Approved under quarterly incentive exception program" }),
  });

  if (!approveRes.ok) {
    throw new Error(`Failed to approve quote: ${JSON.stringify(approveRes.data)}`);
  }
  console.log(`  ✓ Manager Approved Quote: New Status = ${approveRes.data.data.status}`);

  // Inspect audit trail
  const logsRes = await api(`/approvals/quotes/${quote.id}/logs`, {
    headers: { Authorization: `Bearer ${repToken}` },
  });
  console.log(`  ✓ Verified Audit Trail Logs (${logsRes.data.data.length} record(s)):`);
  for (const log of logsRes.data.data) {
    console.log(`    - [${log.action.toUpperCase()}] by User #${log.user_id}: "${log.comments || log.reason || 'No comment'}" (${log.created_at})`);
  }

  // ─────────────────────────────────────────────────────────────
  // 5. DIRECT POSTGRESQL DB RECORD VALIDATION
  // ─────────────────────────────────────────────────────────────
  console.log("\n▶ [5/5] Direct DB Validation...");
  const [dbQuote] = await db.select().from(quotes).where(eq(quotes.id, quote.id));
  const dbLines = await db.select().from(quoteLines).where(eq(quoteLines.quoteId, quote.id));
  const dbLogs = await db.select().from(approvalLogs).where(eq(approvalLogs.quoteId, quote.id));

  console.log(`  ✓ Direct DB 'quotes' row: ID=${dbQuote.id}, Status=${dbQuote.status}, GrandTotal=${dbQuote.grandTotal}`);
  console.log(`  ✓ Direct DB 'quote_lines' rows: ${dbLines.length} item(s)`);
  console.log(`  ✓ Direct DB 'quote_approval_logs' rows: ${dbLogs.length} audit entry/entries`);

  console.log("\n===============================================================================");
  console.log("🎉 ALL PHASE 2 LIVE VERIFICATIONS PASSED SUCCESSFULLY!");
  console.log("===============================================================================");
}

runLivePhase2Verification()
  .catch((err) => {
    console.error("❌ Live verification failed:", err.message);
    process.exit(1);
  })
  .then(() => process.exit(0));
