import { describe, it } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { app } from "../../app.js";
import { generateAccessToken } from "../../lib/jwt.js";
import {
  createDiscountRuleSchema,
  updateDiscountRuleSchema,
  checkDiscountQuerySchema,
} from "./discount-rules.schemas.js";

describe("Discount Rules & Governance Module", () => {
  describe("Schema Validations", () => {
    it("should validate createDiscountRuleSchema correctly", () => {
      const valid = createDiscountRuleSchema.parse({
        tier_id: 1,
        category_id: 2,
        max_discount_pct: 18.5,
        manager_threshold_pct: 5.0,
        finance_threshold_pct: 12.0,
      });
      assert.equal(valid.tier_id, 1);
      assert.equal(valid.category_id, 2);
      assert.equal(valid.max_discount_pct, 18.5);
      assert.equal(valid.manager_threshold_pct, 5.0);
      assert.equal(valid.finance_threshold_pct, 12.0);

      assert.throws(() => {
        createDiscountRuleSchema.parse({
          tier_id: 0,
          category_id: 1,
          max_discount_pct: 10,
        });
      });
    });

    it("should validate updateDiscountRuleSchema correctly", () => {
      const valid = updateDiscountRuleSchema.parse({
        max_discount_pct: 20.0,
      });
      assert.equal(valid.max_discount_pct, 20.0);
    });

    it("should validate checkDiscountQuerySchema correctly", () => {
      const valid = checkDiscountQuerySchema.parse({
        tier_id: "1",
        category_id: "2",
        requested_discount_pct: "14.5",
      });
      assert.equal(valid.tier_id, 1);
      assert.equal(valid.category_id, 2);
      assert.equal(valid.requested_discount_pct, 14.5);
    });
  });

  describe("API Endpoints & Access Control", () => {
    it("should enforce authorization on discount rules", async () => {
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      const baseUrl = `http://127.0.0.1:${port}`;

      try {
        // 1. Unauthenticated request to /discount-rules returns 401
        const unauthRes = await fetch(`${baseUrl}/api/v1/discount-rules`);
        assert.equal(unauthRes.status, 401);

        // 2. Rep token can view discount rules
        const repToken = generateAccessToken({ id: 10, email: "rep@dealflow.dev", role: "rep" });
        const listRes = await fetch(`${baseUrl}/api/v1/discount-rules`, {
          headers: { Authorization: `Bearer ${repToken}` },
        });
        assert.equal(listRes.status, 200);
        const listData = await listRes.json() as { success: boolean; data: any[] };
        assert.equal(listData.success, true);
        assert.ok(Array.isArray(listData.data));

        // 3. Rep token cannot create discount rule (403)
        const forbiddenRes = await fetch(`${baseUrl}/api/v1/discount-rules`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${repToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tier_id: 1,
            category_id: 1,
            max_discount_pct: 20,
          }),
        });
        assert.equal(forbiddenRes.status, 403);
      } finally {
        server.close();
      }
    });
  });
});
