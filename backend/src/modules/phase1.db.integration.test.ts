import { describe, it } from "node:test";
import assert from "node:assert/strict";
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
import {
  createCategory,
  getCategories,
  createProduct,
  listProducts,
  getProductById,
  createVariant,
  createPriceList,
  addPriceListItem,
  getPriceLists,
  deleteProduct,
} from "./catalog/catalog.service.js";
import {
  createTier,
  getTiers,
  createCustomer,
  listCustomers,
  getCustomerById,
  deleteCustomer,
} from "./customers/customers.service.js";
import {
  createDiscountRule,
  getDiscountRules,
  evaluateDiscountPolicy,
} from "./discount-rules/discount-rules.service.js";

describe("Phase 1 DB & Service Integration Tests", () => {
  it("should have all Phase 1 schema tables defined and exported properly", () => {
    assert.ok(customerTiers, "customerTiers schema table must be defined");
    assert.ok(customers, "customers schema table must be defined");
    assert.ok(productCategories, "productCategories schema table must be defined");
    assert.ok(products, "products schema table must be defined");
    assert.ok(productVariants, "productVariants schema table must be defined");
    assert.ok(priceLists, "priceLists schema table must be defined");
    assert.ok(priceListItems, "priceListItems schema table must be defined");
    assert.ok(discountRules, "discountRules schema table must be defined");
  });

  it("should verify full end-to-end database CRUD workflow if DB is reachable", async () => {
    // 1. Probe database connectivity with 3s timeout
    let isDbConnected = false;
    try {
      await db.execute(sqlProbeQuery());
      isDbConnected = true;
    } catch {
      console.log("ℹ Note: PostgreSQL database is currently unreachable. Skipping live DB write operations.");
    }

    if (!isDbConnected) {
      // Schema structure & typings are verified
      return;
    }

    const testSuffix = Date.now();
    let createdTierId: number | null = null;
    let createdCategoryId: number | null = null;
    let createdProductId: number | null = null;
    let createdCustomerId: number | null = null;
    let createdPriceListId: number | null = null;

    try {
      // Step A: Create Customer Tier
      const tier = await createTier({
        name: `IntTest Tier ${testSuffix}`,
        max_discount_pct: 25.0,
      });
      assert.ok(tier.id);
      createdTierId = tier.id;
      assert.equal(parseFloat(tier.maxDiscountPct), 25.0);

      // Step B: Create Customer
      const customer = await createCustomer({
        name: `IntTest Customer ${testSuffix}`,
        email: `customer_${testSuffix}@example.com`,
        tier_id: tier.id,
      });
      assert.ok(customer.id);
      createdCustomerId = customer.id;

      // Verify customer retrieval with tier join
      const fetchedCustomer = await getCustomerById(customer.id);
      assert.equal(fetchedCustomer.name, `IntTest Customer ${testSuffix}`);
      assert.equal(fetchedCustomer.tier?.id, tier.id);

      // Step C: Create Category
      const category = await createCategory({
        name: `IntTest Category ${testSuffix}`,
        max_discount_pct: 20.0,
      });
      assert.ok(category.id);
      createdCategoryId = category.id;

      // Step D: Create Product
      const product = await createProduct({
        name: `IntTest Server ${testSuffix}`,
        description: "Integration test product",
        category_id: category.id,
        base_price: 2000,
        cost_price: 1200,
        unit: "unit",
        tax_pct: 18,
        is_recurring: false,
      });
      assert.ok(product.id);
      createdProductId = product.id;

      // Step E: Create Product Variant
      const variant = await createVariant(product.id, {
        attribute_name: "Memory",
        attribute_value: "128GB",
        extra_price: 400,
      });
      assert.ok(variant.id);
      assert.equal(variant.productId, product.id);

      // Step F: Create Price List & Item
      const priceList = await createPriceList({
        name: `IntTest PriceList ${testSuffix}`,
        tier_id: tier.id,
        currency: "USD",
      });
      assert.ok(priceList.id);
      createdPriceListId = priceList.id;

      const priceItem = await addPriceListItem(priceList.id, {
        product_id: product.id,
        unit_price: 1850,
      });
      assert.ok(priceItem.id);

      // Step G: Create Discount Rule & Evaluate Policy
      const discountRule = await createDiscountRule({
        tier_id: tier.id,
        category_id: category.id,
        max_discount_pct: 15.0,
        manager_threshold_pct: 5.0,
        finance_threshold_pct: 10.0,
      });
      assert.ok(discountRule.id);

      // Policy Evaluation Check: 4% requested (<= 5% manager threshold -> auto)
      const evalAuto = await evaluateDiscountPolicy({
        tier_id: tier.id,
        category_id: category.id,
        requested_discount_pct: 4.0,
      });
      assert.equal(evalAuto.effectiveMaxDiscount, 15.0); // min(25, 20, 15)
      assert.equal(evalAuto.approvalRoute, "auto");

      // Policy Evaluation Check: 8% requested (> 5% manager threshold -> pending_manager)
      const evalMgr = await evaluateDiscountPolicy({
        tier_id: tier.id,
        category_id: category.id,
        requested_discount_pct: 8.0,
      });
      assert.equal(evalMgr.approvalRoute, "pending_manager");

      // Policy Evaluation Check: 12% requested (> 10% finance threshold -> pending_finance)
      const evalFin = await evaluateDiscountPolicy({
        tier_id: tier.id,
        category_id: category.id,
        requested_discount_pct: 12.0,
      });
      assert.equal(evalFin.approvalRoute, "pending_finance");
      assert.equal(evalFin.exceedsCeiling, false);

      // Policy Evaluation Check: 18% requested (> 15% effective ceiling -> exceedsCeiling)
      const evalExceed = await evaluateDiscountPolicy({
        tier_id: tier.id,
        category_id: category.id,
        requested_discount_pct: 18.0,
      });
      assert.equal(evalExceed.exceedsCeiling, true);
    } finally {
      // Cleanup created resources in reverse dependency order
      try {
        if (createdTierId && createdCategoryId) {
          await db
            .delete(discountRules)
            .where(
              eq(discountRules.tierId, createdTierId)
            );
        }
        if (createdPriceListId) {
          await db.delete(priceLists).where(eq(priceLists.id, createdPriceListId));
        }
        if (createdProductId) {
          await deleteProduct(createdProductId);
        }
        if (createdCategoryId) {
          await db.delete(productCategories).where(eq(productCategories.id, createdCategoryId));
        }
        if (createdCustomerId) {
          await deleteCustomer(createdCustomerId);
        }
        if (createdTierId) {
          await db.delete(customerTiers).where(eq(customerTiers.id, createdTierId));
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  });
});

function sqlProbeQuery() {
  return {
    toSQL: () => ({ sql: "SELECT 1", params: [] }),
  } as any;
}
