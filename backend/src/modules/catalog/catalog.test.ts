import { describe, it } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { app } from "../../app.js";
import { generateAccessToken } from "../../lib/jwt.js";
import {
  createCategorySchema,
  createProductSchema,
  createVariantSchema,
  createPriceListSchema,
  addPriceListItemSchema,
} from "./catalog.schemas.js";

describe("Catalog Module", () => {
  describe("Schema Validations", () => {
    it("should validate createCategorySchema correctly", () => {
      const valid = createCategorySchema.parse({
        name: "Enterprise Hardware",
        max_discount_pct: 12.0,
      });
      assert.equal(valid.name, "Enterprise Hardware");
      assert.equal(valid.max_discount_pct, 12.0);

      assert.throws(() => {
        createCategorySchema.parse({ name: "", max_discount_pct: 15 });
      });
    });

    it("should validate createProductSchema correctly", () => {
      const valid = createProductSchema.parse({
        name: "Server Rack Alpha",
        category_id: 1,
        base_price: 1500,
        cost_price: 900,
        unit: "unit",
        tax_pct: 10,
        is_recurring: false,
      });
      assert.equal(valid.name, "Server Rack Alpha");
      assert.equal(valid.category_id, 1);
      assert.equal(valid.base_price, 1500);
      assert.equal(valid.cost_price, 900);

      assert.throws(() => {
        createProductSchema.parse({
          name: "Invalid",
          category_id: 1,
          base_price: -10,
          cost_price: 10,
        });
      });
    });

    it("should validate createVariantSchema correctly", () => {
      const valid = createVariantSchema.parse({
        attribute_name: "Edition",
        attribute_value: "Pro",
        extra_price: 250,
      });
      assert.equal(valid.attribute_name, "Edition");
      assert.equal(valid.attribute_value, "Pro");
      assert.equal(valid.extra_price, 250);
    });

    it("should validate price list schemas correctly", () => {
      const validList = createPriceListSchema.parse({
        name: "Q3 Promotional Pricing",
        tier_id: 1,
        currency: "USD",
      });
      assert.equal(validList.name, "Q3 Promotional Pricing");

      const validItem = addPriceListItemSchema.parse({
        product_id: 2,
        unit_price: 1200,
      });
      assert.equal(validItem.product_id, 2);
      assert.equal(validItem.unit_price, 1200);
    });
  });

  describe("API Endpoints & Access Control", () => {
    it("should guard catalog endpoints with authentication and admin roles", async () => {
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      const baseUrl = `http://127.0.0.1:${port}`;

      try {
        // 1. Unauthenticated request to /categories returns 401
        const unauthRes = await fetch(`${baseUrl}/api/v1/catalog/categories`);
        assert.equal(unauthRes.status, 401);

        // 2. Rep token can list categories & products
        const repToken = generateAccessToken({ id: 10, email: "rep@dealflow.dev", role: "rep" });
        const categoriesRes = await fetch(`${baseUrl}/api/v1/catalog/categories`, {
          headers: { Authorization: `Bearer ${repToken}` },
        });
        assert.equal(categoriesRes.status, 200);
        const categoriesData = await categoriesRes.json() as { success: boolean; data: any[] };
        assert.equal(categoriesData.success, true);
        assert.ok(Array.isArray(categoriesData.data));

        const productsRes = await fetch(`${baseUrl}/api/v1/catalog/products?page=1&limit=5`, {
          headers: { Authorization: `Bearer ${repToken}` },
        });
        assert.equal(productsRes.status, 200);
        const productsData = await productsRes.json() as { success: boolean; data: any[]; pagination: any };
        assert.equal(productsData.success, true);
        assert.ok(Array.isArray(productsData.data));

        // 3. Non-admin cannot create category (403)
        const forbiddenCategoryRes = await fetch(`${baseUrl}/api/v1/catalog/categories`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${repToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: "Pro Services", max_discount_pct: 10 }),
        });
        assert.equal(forbiddenCategoryRes.status, 403);

        // 4. Non-admin cannot create product (403)
        const forbiddenProductRes = await fetch(`${baseUrl}/api/v1/catalog/products`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${repToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "Cloud Hosting",
            category_id: 1,
            base_price: 100,
            cost_price: 40,
          }),
        });
        assert.equal(forbiddenProductRes.status, 403);
      } finally {
        server.close();
      }
    });
  });
});
