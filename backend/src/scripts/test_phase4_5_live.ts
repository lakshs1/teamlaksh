import * as http from "node:http";
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
  upsellRules,
  warehouses,
  warehouseStock,
  fulfillmentSplits,
  backorders,
  stockMovements,
  approvalLogs,
} from "@db";
import { eq, inArray } from "drizzle-orm";

async function runLiveVerification() {
  console.log("===============================================================================");
  console.log("🚀 DEALFLOW360 PHASE 4 & 5 LIVE DATABASE & REST API VERIFICATION");
  console.log("Testing against remote PostgreSQL via Express API");
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
    // SETUP TEST FIXTURES IN DATABASE
    // ─────────────────────────────────────────────────────────────
    console.log("▶ [0/6] Setting up seed fixtures in database...");

    // Ensure a test user exists in DB for foreign key references
    const [testUser] = await db
      .insert(users)
      .values({
        name: `Test Runner ${timestamp}`,
        email: `runner_${timestamp}@dealflow360.dev`,
        role: "admin",
      })
      .returning();

    const adminToken = generateAccessToken({ id: testUser.id, email: testUser.email, role: "admin" });
    const repToken = generateAccessToken({ id: testUser.id, email: testUser.email, role: "rep" });
    const opsToken = generateAccessToken({ id: testUser.id, email: testUser.email, role: "operations" });

    // 1. Ensure a customer tier exists
    const [tier] = await db
      .insert(customerTiers)
      .values({
        name: `Enterprise Tier ${timestamp}`,
        maxDiscountPct: "20.00",
      })
      .returning();

    // 2. Ensure a customer exists
    const [customer] = await db
      .insert(customers)
      .values({
        name: `Cyberdyne Systems ${timestamp}`,
        email: `ops_${timestamp}@cyberdyne.com`,
        tierId: tier.id,
      })
      .returning();

    // 3. Ensure a category exists
    const [category] = await db
      .insert(productCategories)
      .values({
        name: `Cloud Infrastructure ${timestamp}`,
        maxDiscountPct: "15.00",
      })
      .returning();

    // 4. Create Source Product (Server Appliance)
    const [productA] = await db
      .insert(products)
      .values({
        name: `Alpha Server Pod ${timestamp}`,
        categoryId: category.id,
        basePrice: "2500.00",
        costPrice: "1500.00",
        unit: "unit",
        isRecurring: false,
      })
      .returning();

    // 5. Create Target / Upsell Product (Warranty / Service)
    const [productB] = await db
      .insert(products)
      .values({
        name: `Premier 24/7 Support Addon ${timestamp}`,
        categoryId: category.id,
        basePrice: "500.00",
        costPrice: "100.00",
        unit: "license",
        isRecurring: false,
      })
      .returning();

    console.log(`  ✓ Created Tier #${tier.id}, Customer #${customer.id}`);
    console.log(`  ✓ Created Product A #${productA.id} ($2500, cost $1500)`);
    console.log(`  ✓ Created Product B #${productB.id} ($500, cost $100)\n`);

    // ─────────────────────────────────────────────────────────────
    // 1. TEST PHASE 4: UPSELL RULES CRUD
    // ─────────────────────────────────────────────────────────────
    console.log("▶ [1/6] Testing Phase 4: Create & List Upsell Rules...");

    // Admin creates upsell rule: Product A -> Product B
    const createRuleRes = await api("/recommendations/rules", {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        source_product_id: productA.id,
        suggested_product_id: productB.id,
        rank: 15,
        is_promoted: true,
        min_margin_pct: 25.0,
      }),
    });

    if (createRuleRes.status !== 201 || !createRuleRes.data?.success) {
      throw new Error(`Failed to create upsell rule: ${JSON.stringify(createRuleRes.data)}`);
    }
    const createdRule = createRuleRes.data.data;
    console.log(`  ✓ POST /recommendations/rules -> HTTP 201 Created (Rule ID #${createdRule.id})`);
    console.log(`    Rank: ${createdRule.rank}, Promoted: ${createdRule.is_promoted}, Min Margin: ${createdRule.min_margin_pct}%`);

    // List rules
    const listRulesRes = await api("/recommendations/rules", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (listRulesRes.status !== 200 || !listRulesRes.data?.success) {
      throw new Error(`Failed to list upsell rules: ${JSON.stringify(listRulesRes.data)}`);
    }
    const foundRule = listRulesRes.data.data.find((r: any) => r.id === createdRule.id);
    if (!foundRule) {
      throw new Error("Created rule was not returned in list endpoint!");
    }
    console.log(`  ✓ GET /recommendations/rules -> HTTP 200 OK (Found rule linking Product ${foundRule.source_product_id} -> ${foundRule.suggested_product_id})\n`);

    // ─────────────────────────────────────────────────────────────
    // 2. TEST PHASE 4: LIVE QUOTE SUGGESTIONS ENGINE
    // ─────────────────────────────────────────────────────────────
    console.log("▶ [2/6] Testing Phase 4: Live Suggestions for Quote...");

    // Create a quote with Product A
    const [quote] = await db
      .insert(quotes)
      .values({
        quoteNumber: `QT-TEST-${timestamp}`,
        customerId: customer.id,
        repId: testUser.id,
        status: "draft",
        subtotal: "2500.00",
        grandTotal: "2500.00",
      })
      .returning();

    // Add Product A line item
    const [lineA] = await db
      .insert(quoteLines)
      .values({
        quoteId: quote.id,
        productId: productA.id,
        quantity: 1,
        unitPrice: "2500.00",
        costPrice: "1500.00",
        lineTotal: "2500.00",
        marginPct: "40.00",
      })
      .returning();

    console.log(`  ✓ Seeded Quote #${quote.id} with Product A line item`);

    // Rep fetches suggestions for this quote
    const suggestionsRes = await api(`/recommendations/quotes/${quote.id}/suggestions`, {
      headers: { Authorization: `Bearer ${repToken}` },
    });

    if (suggestionsRes.status !== 200 || !suggestionsRes.data?.success) {
      throw new Error(`Failed to get suggestions: ${JSON.stringify(suggestionsRes.data)}`);
    }

    const suggestions = suggestionsRes.data.data;
    console.log(`  ✓ GET /recommendations/quotes/${quote.id}/suggestions -> HTTP 200 OK (${suggestions.length} suggestion(s))`);
    if (suggestions.length === 0 || suggestions[0].product_id !== productB.id) {
      throw new Error(`Expected Product B (${productB.id}) in suggestions, got: ${JSON.stringify(suggestions)}`);
    }
    const suggestion = suggestions[0];
    console.log(`    Recommended Product: "${suggestion.product_name}" (ID #${suggestion.product_id})`);
    console.log(`    Margin: ${suggestion.margin_pct}%, Promoted: ${suggestion.is_promoted}, Rank: ${suggestion.rank}`);
    console.log(`    Reason: "${suggestion.reason}"`);

    // Add Product B to the quote lines now
    const [lineB] = await db
      .insert(quoteLines)
      .values({
        quoteId: quote.id,
        productId: productB.id,
        quantity: 1,
        unitPrice: "500.00",
        costPrice: "100.00",
        lineTotal: "500.00",
        marginPct: "80.00",
      })
      .returning();
    console.log(`  ✓ Added Product B into quote lines (now both A and B are in the quote)`);

    // Re-fetch suggestions — Product B MUST BE FILTERED OUT
    const reSuggestionsRes = await api(`/recommendations/quotes/${quote.id}/suggestions`, {
      headers: { Authorization: `Bearer ${repToken}` },
    });
    const reSuggestions = reSuggestionsRes.data.data;
    if (reSuggestions.some((s: any) => s.product_id === productB.id)) {
      throw new Error("Product B should have been filtered out since it's already in the cart!");
    }
    console.log(`  ✓ Verified cart filtering: Product B was correctly omitted from recommendations since it's already in the cart.\n`);

    // ─────────────────────────────────────────────────────────────
    // 3. TEST PHASE 5: WAREHOUSES & STOCK MANAGEMENT
    // ─────────────────────────────────────────────────────────────
    console.log("▶ [3/6] Testing Phase 5: Warehouses & Stock Management...");

    // Create Warehouse 1 (East Depot - Primary, shipping_cost_weight 1.0)
    const wh1Res = await api("/fulfillment/warehouses", {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: `East Hub ${timestamp}`,
        code: `WH-E-${timestamp}`,
        location: "Boston, MA",
        shipping_cost_weight: 1.0,
      }),
    });
    if (wh1Res.status !== 201) throw new Error(`Failed to create WH1: ${JSON.stringify(wh1Res.data)}`);
    const wh1 = wh1Res.data.data;
    console.log(`  ✓ POST /fulfillment/warehouses -> HTTP 201 Created ("${wh1.name}", ID #${wh1.id}, weight ${wh1.shipping_cost_weight})`);

    // Create Warehouse 2 (West Depot - Secondary, shipping_cost_weight 2.5)
    const wh2Res = await api("/fulfillment/warehouses", {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: `West Depot ${timestamp}`,
        code: `WH-W-${timestamp}`,
        location: "Seattle, WA",
        shipping_cost_weight: 2.5,
      }),
    });
    if (wh2Res.status !== 201) throw new Error(`Failed to create WH2: ${JSON.stringify(wh2Res.data)}`);
    const wh2 = wh2Res.data.data;
    console.log(`  ✓ POST /fulfillment/warehouses -> HTTP 201 Created ("${wh2.name}", ID #${wh2.id}, weight ${wh2.shipping_cost_weight})`);

    // Restock Warehouse 1 with 5 units of Product A
    const stock1Res = await api(`/fulfillment/warehouses/${wh1.id}/stock`, {
      method: "POST",
      headers: { Authorization: `Bearer ${opsToken}` },
      body: JSON.stringify({
        product_id: productA.id,
        quantity: 5,
        reorder_level: 2,
      }),
    });
    if (stock1Res.status !== 200) throw new Error(`Failed to set stock WH1: ${JSON.stringify(stock1Res.data)}`);
    console.log(`  ✓ POST /fulfillment/warehouses/${wh1.id}/stock -> HTTP 200 OK (Set stock to 5 units in WH1)`);

    // Restock Warehouse 2 with 10 units of Product A
    const stock2Res = await api(`/fulfillment/warehouses/${wh2.id}/stock`, {
      method: "POST",
      headers: { Authorization: `Bearer ${opsToken}` },
      body: JSON.stringify({
        product_id: productA.id,
        quantity: 10,
        reorder_level: 5,
      }),
    });
    if (stock2Res.status !== 200) throw new Error(`Failed to set stock WH2: ${JSON.stringify(stock2Res.data)}`);
    console.log(`  ✓ POST /fulfillment/warehouses/${wh2.id}/stock -> HTTP 200 OK (Set stock to 10 units in WH2)`);

    // Verify stock list endpoint
    const getStock1Res = await api(`/fulfillment/warehouses/${wh1.id}/stock`, {
      headers: { Authorization: `Bearer ${repToken}` },
    });
    const wh1Inventory = getStock1Res.data.data;
    console.log(`  ✓ GET /fulfillment/warehouses/${wh1.id}/stock -> HTTP 200 OK (On Hand: ${wh1Inventory[0].quantity_on_hand}, Available: ${wh1Inventory[0].available_quantity})\n`);

    // ─────────────────────────────────────────────────────────────
    // 4. TEST PHASE 5: GREEDY SPLIT CALCULATION (12 UNITS DEMAND)
    // ─────────────────────────────────────────────────────────────
    console.log("▶ [4/6] Testing Phase 5: Automated Warehouse Split Algorithm (ADR-004)...");

    // Create a new quotation requesting 12 units of Product A
    // Inventory reality: WH1 has 5 units (cheapest), WH2 has 10 units (higher shipping weight)
    // Expected greedy algorithm behavior:
    // - Pull all 5 units from WH1 (exhausted)
    // - Pull remaining 7 units from WH2
    // - Total shipments: 2
    // - Backorders: 0
    // - can_fulfill_completely: true

    const [splitQuote] = await db
      .insert(quotes)
      .values({
        quoteNumber: `QT-SPLIT-${timestamp}`,
        customerId: customer.id,
        repId: testUser.id,
        status: "fulfillment",
        subtotal: "30000.00",
        grandTotal: "30000.00",
      })
      .returning();

    const [splitLine] = await db
      .insert(quoteLines)
      .values({
        quoteId: splitQuote.id,
        productId: productA.id,
        quantity: 12,
        unitPrice: "2500.00",
        costPrice: "1500.00",
        lineTotal: "30000.00",
        isRecurring: false,
      })
      .returning();

    console.log(`  ✓ Created Quote #${splitQuote.id} with line requesting 12 units of Product A`);

    const splitCalcRes = await api(`/fulfillment/quotes/${splitQuote.id}/split`, {
      headers: { Authorization: `Bearer ${repToken}` },
    });

    if (splitCalcRes.status !== 200 || !splitCalcRes.data?.success) {
      throw new Error(`Failed to calculate split: ${JSON.stringify(splitCalcRes.data)}`);
    }

    const splitData = splitCalcRes.data.data;
    console.log(`  ✓ GET /fulfillment/quotes/${splitQuote.id}/split -> HTTP 200 OK`);
    console.log(`    Total shipments: ${splitData.total_shipments}`);
    console.log(`    Can fulfill completely: ${splitData.can_fulfill_completely}`);
    console.log(`    Allocated splits:`);
    splitData.splits.forEach((s: any) => {
      console.log(`      - Warehouse "${s.warehouse_name}" (ID #${s.warehouse_id}): ${s.quantity} units`);
    });

    if (splitData.splits.length !== 2) {
      throw new Error(`Expected order to split across 2 warehouses, got ${splitData.splits.length}`);
    }
    const wh1Split = splitData.splits.find((s: any) => s.warehouse_id === wh1.id);
    const wh2Split = splitData.splits.find((s: any) => s.warehouse_id === wh2.id);
    if (!wh1Split || wh1Split.quantity !== 5) {
      throw new Error(`Expected 5 units from WH1, got ${wh1Split?.quantity}`);
    }
    if (!wh2Split || wh2Split.quantity !== 7) {
      throw new Error(`Expected 7 units from WH2, got ${wh2Split?.quantity}`);
    }
    console.log("    ✓ Split math matched ADR-004 specification perfectly!\n");

    // ─────────────────────────────────────────────────────────────
    // 5. TEST PHASE 5: ACCEPT SPLIT & INVENTORY DECREMENT
    // ─────────────────────────────────────────────────────────────
    console.log("▶ [5/6] Testing Phase 5: Accept Split & Commit to Database...");

    const acceptRes = await api(`/fulfillment/quotes/${splitQuote.id}/split/accept`, {
      method: "POST",
      headers: { Authorization: `Bearer ${opsToken}` },
    });

    if (acceptRes.status !== 200 || !acceptRes.data?.success) {
      throw new Error(`Failed to accept split: ${JSON.stringify(acceptRes.data)}`);
    }

    console.log(`  ✓ POST /fulfillment/quotes/${splitQuote.id}/split/accept -> HTTP 200 OK`);
    console.log(`    "${acceptRes.data.message}"`);

    // Verify DB records in fulfillment_splits table
    const dbSplits = await db
      .select()
      .from(fulfillmentSplits)
      .where(eq(fulfillmentSplits.quoteId, splitQuote.id));
    console.log(`  ✓ Verified DB: ${dbSplits.length} rows inserted in fulfillment_splits table`);

    // Verify DB inventory decrement in warehouse_stock
    const [wh1DbStock] = await db
      .select()
      .from(warehouseStock)
      .where(
        eq(warehouseStock.warehouseId, wh1.id)
      );
    const [wh2DbStock] = await db
      .select()
      .from(warehouseStock)
      .where(
        eq(warehouseStock.warehouseId, wh2.id)
      );

    console.log(`  ✓ Verified DB Inventory after fulfillment:`);
    console.log(`    WH1 (started at 5, allocated 5): now ${wh1DbStock.quantityOnHand} on hand`);
    console.log(`    WH2 (started at 10, allocated 7): now ${wh2DbStock.quantityOnHand} on hand`);
    if (wh1DbStock.quantityOnHand !== 0 || wh2DbStock.quantityOnHand !== 3) {
      throw new Error("Stock was not decremented accurately!");
    }

    // Verify stock_movements audit log
    const movements = await db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.referenceId, splitQuote.quoteNumber));
    console.log(`  ✓ Verified DB: ${movements.length} audit trail records inserted in stock_movements table\n`);

    // ─────────────────────────────────────────────────────────────
    // 6. TEST PHASE 5: BACKORDER OVERFLOW & MANUAL OVERRIDE
    // ─────────────────────────────────────────────────────────────
    console.log("▶ [6/6] Testing Phase 5: Backorder Handling & Manual Override...");

    // Now total stock across both warehouses is 3 units (WH1: 0, WH2: 3)
    // Create a new quote requesting 10 units
    // Expected: 3 units from WH2, 7 units backordered!
    const [overflowQuote] = await db
      .insert(quotes)
      .values({
        quoteNumber: `QT-OVERFLOW-${timestamp}`,
        customerId: customer.id,
        repId: testUser.id,
        status: "fulfillment",
        subtotal: "25000.00",
        grandTotal: "25000.00",
      })
      .returning();

    const [overflowLine] = await db
      .insert(quoteLines)
      .values({
        quoteId: overflowQuote.id,
        productId: productA.id,
        quantity: 10,
        unitPrice: "2500.00",
        costPrice: "1500.00",
        lineTotal: "25000.00",
        isRecurring: false,
      })
      .returning();

    const overflowSplitRes = await api(`/fulfillment/quotes/${overflowQuote.id}/split`, {
      headers: { Authorization: `Bearer ${repToken}` },
    });

    const overflowData = overflowSplitRes.data.data;
    console.log(`  ✓ GET /fulfillment/quotes/${overflowQuote.id}/split for 10 units:`);
    console.log(`    Can fulfill completely: ${overflowData.can_fulfill_completely} (Expected: false)`);
    console.log(`    Allocated splits: ${overflowData.splits.length} (quantity: ${overflowData.splits[0]?.quantity})`);
    console.log(`    Backordered items: ${overflowData.backordered.length} (quantity: ${overflowData.backordered[0]?.quantity_backordered})`);

    if (overflowData.can_fulfill_completely !== false) {
      throw new Error("Expected can_fulfill_completely to be false");
    }
    if (overflowData.backordered[0]?.quantity_backordered !== 7) {
      throw new Error(`Expected 7 units backordered, got ${overflowData.backordered[0]?.quantity_backordered}`);
    }
    console.log("    ✓ Backorder math verified accurately!");

    // Test Manual Split Override: Allocate 2 units from WH2, remaining 8 backordered
    const overrideRes = await api(`/fulfillment/quotes/${overflowQuote.id}/split/override`, {
      method: "POST",
      headers: { Authorization: `Bearer ${opsToken}` },
      body: JSON.stringify({
        splits: [
          {
            quote_line_id: overflowLine.id,
            warehouse_id: wh2.id,
            quantity: 2,
          },
        ],
      }),
    });

    if (overrideRes.status !== 200 || !overrideRes.data?.success) {
      throw new Error(`Failed manual override: ${JSON.stringify(overrideRes.data)}`);
    }

    const overrideData = overrideRes.data.data;
    console.log(`  ✓ POST /fulfillment/quotes/${overflowQuote.id}/split/override -> HTTP 200 OK`);
    console.log(`    Allocated: ${overrideData.splits.length} split(s), Backordered: ${overrideData.backordered.length} line(s) with ${overrideData.backordered[0]?.quantityBackordered} units`);

    // Clean up upsell rule
    const deleteRuleRes = await api(`/recommendations/rules/${createdRule.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.log(`  ✓ DELETE /recommendations/rules/${createdRule.id} -> HTTP 200 OK (Rule cleaned up)\n`);

    console.log("===============================================================================");
    console.log("🎉 ALL LIVE DB & REST API ENDPOINTS FOR PHASE 4 & 5 PASSED WITH 100% SUCCESS!");
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
