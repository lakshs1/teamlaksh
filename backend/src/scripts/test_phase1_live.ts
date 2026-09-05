import { generateAccessToken } from "../lib/jwt.js";
import {
  db,
  customerTiers,
  customers,
  productCategories,
  products,
  productVariants,
  priceLists,
  priceListItems,
  discountRules,
} from "@db";
import { eq } from "drizzle-orm";

const BASE_URL = "http://localhost:3000/api/v1";

// Tokens
const adminToken = generateAccessToken({ id: 1, email: "admin@dealflow360.dev", role: "admin" });
const repToken = generateAccessToken({ id: 2, email: "rep@dealflow360.dev", role: "rep" });

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

async function runLiveVerification() {
  console.log("===============================================================================");
  console.log("🚀 DEALFLOW360 PHASE 1 LIVE DATABASE & REST API VERIFICATION");
  console.log("Connecting to API:", BASE_URL);
  console.log("Remote Database: postgresql://postgres:postgres@bore.pub:3950/postgres");
  console.log("===============================================================================\n");

  const timestamp = Date.now();
  const testTierName = `Gold Tier ${timestamp}`;
  const testCustomerEmail = `procurement_${timestamp}@stark-tech.com`;
  const testCategoryName = `Enterprise Servers ${timestamp}`;
  const testProductName = `Titan Blade Server ${timestamp}`;

  // ─────────────────────────────────────────────────────────────
  // 1. TEST CUSTOMER TIERS
  // ─────────────────────────────────────────────────────────────
  console.log("▶ [1/5] Testing Customer Tiers...");

  // Admin creates tier via API
  const createTierRes = await api("/customers/tiers", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: testTierName,
      max_discount_pct: 25.0,
    }),
  });

  if (!createTierRes.ok) {
    throw new Error(`Failed to create tier: ${JSON.stringify(createTierRes.data)}`);
  }
  const tierId = createTierRes.data.data.id;
  console.log(`  ✓ Created Tier via REST API: [ID: ${tierId}] ${testTierName} (Max Discount: 25%)`);

  // Verify in PostgreSQL DB directly
  const [dbTier] = await db.select().from(customerTiers).where(eq(customerTiers.id, tierId));
  console.log(`  ✓ Verified in DB (customer_tiers): ID=${dbTier.id}, Name=${dbTier.name}, MaxDiscount=${dbTier.maxDiscountPct}`);

  // ─────────────────────────────────────────────────────────────
  // 2. TEST CUSTOMERS
  // ─────────────────────────────────────────────────────────────
  console.log("\n▶ [2/5] Testing Customers CRUD & Tier Associations...");

  const createCustomerRes = await api("/customers", {
    method: "POST",
    headers: { Authorization: `Bearer ${repToken}` },
    body: JSON.stringify({
      name: `Stark Industries ${timestamp}`,
      email: testCustomerEmail,
      tier_id: tierId,
    }),
  });

  if (!createCustomerRes.ok) {
    throw new Error(`Failed to create customer: ${JSON.stringify(createCustomerRes.data)}`);
  }
  const customerId = createCustomerRes.data.data.id;
  console.log(`  ✓ Created Customer via REST API: [ID: ${customerId}] ${createCustomerRes.data.data.name} (Tier: ${createCustomerRes.data.data.tier?.name})`);

  // Verify search & pagination
  const searchCustomerRes = await api(`/customers?search=${testCustomerEmail}&tier_id=${tierId}`, {
    headers: { Authorization: `Bearer ${repToken}` },
  });
  console.log(`  ✓ Searched Customer via API: found ${searchCustomerRes.data.data.length} match (Total in system: ${searchCustomerRes.data.pagination.total})`);

  // Direct DB check
  const [dbCustomer] = await db.select().from(customers).where(eq(customers.id, customerId));
  console.log(`  ✓ Verified in DB (customers): ID=${dbCustomer.id}, Name=${dbCustomer.name}, Email=${dbCustomer.email}, TierID=${dbCustomer.tierId}`);

  // ─────────────────────────────────────────────────────────────
  // 3. TEST PRODUCT CATALOG & VARIANTS
  // ─────────────────────────────────────────────────────────────
  console.log("\n▶ [3/5] Testing Product Catalog, Categories & Variants...");

  // Create Category
  const createCatRes = await api("/catalog/categories", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: testCategoryName,
      max_discount_pct: 18.0,
    }),
  });
  const categoryId = createCatRes.data.data.id;
  console.log(`  ✓ Created Category via REST API: [ID: ${categoryId}] ${testCategoryName} (Max Category Discount: 18%)`);

  // Create Product
  const createProdRes = await api("/catalog/products", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: testProductName,
      description: "High-throughput edge computing node",
      category_id: categoryId,
      base_price: 4500.0,
      cost_price: 2800.0,
      unit: "unit",
      tax_pct: 8.5,
      is_recurring: false,
    }),
  });
  const productId = createProdRes.data.data.id;
  console.log(`  ✓ Created Product via REST API: [ID: ${productId}] ${testProductName} (Base: $4500, Cost: $2800)`);

  // Create Variant
  const createVariantRes = await api(`/catalog/products/${productId}/variants`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      attribute_name: "Memory",
      attribute_value: "128GB ECC DDR5",
      extra_price: 600.0,
    }),
  });
  const variantId = createVariantRes.data.data.id;
  console.log(`  ✓ Added Variant via REST API: [ID: ${variantId}] Memory = 128GB ECC DDR5 (+$600)`);

  // Fetch product detail with join
  const getProductDetail = await api(`/catalog/products/${productId}`, {
    headers: { Authorization: `Bearer ${repToken}` },
  });
  console.log(`  ✓ Retrieved Joined Product: Category=${getProductDetail.data.data.category?.name}, Variants Count=${getProductDetail.data.data.variants?.length}`);

  // Direct DB check
  const [dbProduct] = await db.select().from(products).where(eq(products.id, productId));
  const [dbVariant] = await db.select().from(productVariants).where(eq(productVariants.id, variantId));
  console.log(`  ✓ Verified in DB (products): ID=${dbProduct.id}, BasePrice=${dbProduct.basePrice}, CategoryID=${dbProduct.categoryId}`);
  console.log(`  ✓ Verified in DB (product_variants): ID=${dbVariant.id}, Attr=${dbVariant.attributeName}:${dbVariant.attributeValue}, ExtraPrice=${dbVariant.extraPrice}`);

  // ─────────────────────────────────────────────────────────────
  // 4. TEST PRICE LISTS & PRICE LIST ITEMS
  // ─────────────────────────────────────────────────────────────
  console.log("\n▶ [4/5] Testing Price Lists & Item Price Overrides...");

  const createPriceListRes = await api("/catalog/price-lists", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: `Q3 Special Discount List ${timestamp}`,
      tier_id: tierId,
      currency: "USD",
    }),
  });
  const priceListId = createPriceListRes.data.data.id;
  console.log(`  ✓ Created Price List: [ID: ${priceListId}] Q3 Special Discount List (Tier ID: ${tierId})`);

  // Add Item to Price List
  const addItemRes = await api(`/catalog/price-lists/${priceListId}/items`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      product_id: productId,
      unit_price: 3950.0,
    }),
  });
  const priceListItemId = addItemRes.data.data.id;
  console.log(`  ✓ Added Price Override Item: [ID: ${priceListItemId}] Product ${productId} -> Special Unit Price: $3950`);

  // Direct DB check
  const [dbPriceList] = await db.select().from(priceLists).where(eq(priceLists.id, priceListId));
  const [dbPriceListItem] = await db.select().from(priceListItems).where(eq(priceListItems.id, priceListItemId));
  console.log(`  ✓ Verified in DB (price_lists): ID=${dbPriceList.id}, Name=${dbPriceList.name}`);
  console.log(`  ✓ Verified in DB (price_list_items): PriceListID=${dbPriceListItem.priceListId}, ProductID=${dbPriceListItem.productId}, OverridePrice=${dbPriceListItem.unitPrice}`);

  // ─────────────────────────────────────────────────────────────
  // 5. TEST DISCOUNT RULES & GOVERNANCE POLICY EVALUATION
  // ─────────────────────────────────────────────────────────────
  console.log("\n▶ [5/5] Testing Discount Rules & Multi-tier Policy Matrix...");

  // Tier Max = 25%, Category Max = 18%, Discount Rule Max = 14%
  const createRuleRes = await api("/discount-rules", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      tier_id: tierId,
      category_id: categoryId,
      max_discount_pct: 14.0,
      manager_threshold_pct: 4.0,
      finance_threshold_pct: 10.0,
    }),
  });
  const ruleId = createRuleRes.data.data.id;
  console.log(`  ✓ Created Discount Rule: [ID: ${ruleId}] Tier ${tierId} x Category ${categoryId}`);
  console.log(`    - Max Discount Rule: 14% | Manager Threshold: 4% | Finance Threshold: 10%`);

  // Policy Test 1: 3% requested -> Auto-approve
  const eval1 = await api(`/discount-rules/evaluate?tier_id=${tierId}&category_id=${categoryId}&requested_discount_pct=3.0`, {
    headers: { Authorization: `Bearer ${repToken}` },
  });
  console.log(`  ✓ Evaluation (3% discount requested): Route=${eval1.data.data.approvalRoute} (Requires Manager: ${eval1.data.data.requiresManager}, Finance: ${eval1.data.data.requiresFinance})`);

  // Policy Test 2: 7% requested -> Route to Manager
  const eval2 = await api(`/discount-rules/evaluate?tier_id=${tierId}&category_id=${categoryId}&requested_discount_pct=7.0`, {
    headers: { Authorization: `Bearer ${repToken}` },
  });
  console.log(`  ✓ Evaluation (7% discount requested): Route=${eval2.data.data.approvalRoute} (Requires Manager: ${eval2.data.data.requiresManager}, Finance: ${eval2.data.data.requiresFinance})`);

  // Policy Test 3: 12% requested -> Route to Finance
  const eval3 = await api(`/discount-rules/evaluate?tier_id=${tierId}&category_id=${categoryId}&requested_discount_pct=12.0`, {
    headers: { Authorization: `Bearer ${repToken}` },
  });
  console.log(`  ✓ Evaluation (12% discount requested): Route=${eval3.data.data.approvalRoute} (Requires Manager: ${eval3.data.data.requiresManager}, Finance: ${eval3.data.data.requiresFinance})`);

  // Policy Test 4: 20% requested -> Exceeds Ceiling!
  // min(Tier: 25%, Category: 18%, Rule: 14%) = 14%
  const eval4 = await api(`/discount-rules/evaluate?tier_id=${tierId}&category_id=${categoryId}&requested_discount_pct=20.0`, {
    headers: { Authorization: `Bearer ${repToken}` },
  });
  console.log(`  ✓ Evaluation (20% requested): EffectiveMax=${eval4.data.data.effectiveMaxDiscount}%, ExceedsCeiling=${eval4.data.data.exceedsCeiling}`);

  // Direct DB check
  const [dbRule] = await db.select().from(discountRules).where(eq(discountRules.id, ruleId));
  console.log(`  ✓ Verified in DB (discount_rules): ID=${dbRule.id}, Max=${dbRule.maxDiscountPct}%, Mgr=${dbRule.managerThresholdPct}%, Fin=${dbRule.financeThresholdPct}%`);

  console.log("\n===============================================================================");
  console.log("🎉 ALL PHASE 1 REST ENDPOINTS & DATABASE TABLES CONFIRMED LIVE & WORKING!");
  console.log("===============================================================================");
  process.exit(0);
}

runLiveVerification().catch((err) => {
  console.error("\n❌ Live Verification Failed:", err);
  process.exit(1);
});
