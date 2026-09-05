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
import { calculateDiscountApprovalRoute } from "./discount-rules.service.js";

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

  describe("Discount Governance Matrix & Approval Route Engine", () => {
    it("should determine effective max discount as min(tier, category, rule)", () => {
      const evaluation = calculateDiscountApprovalRoute({
        tierMax: 20.0,
        categoryMax: 15.0,
        ruleMax: 12.0,
        requestedDiscountPct: 8.0,
        managerThreshold: 5.0,
        financeThreshold: 10.0,
      });

      assert.equal(evaluation.effectiveMaxDiscount, 12.0);
      assert.equal(evaluation.exceedsCeiling, false);
      assert.equal(evaluation.requiresManager, true);
      assert.equal(evaluation.requiresFinance, false);
      assert.equal(evaluation.approvalRoute, "pending_manager");
    });

    it("should route to pending_finance when requested discount exceeds finance threshold", () => {
      const evaluation = calculateDiscountApprovalRoute({
        tierMax: 25.0,
        categoryMax: 20.0,
        ruleMax: null,
        requestedDiscountPct: 18.0,
        managerThreshold: 5.0,
        financeThreshold: 15.0,
      });

      assert.equal(evaluation.effectiveMaxDiscount, 20.0);
      assert.equal(evaluation.exceedsCeiling, false);
      assert.equal(evaluation.requiresManager, true);
      assert.equal(evaluation.requiresFinance, true);
      assert.equal(evaluation.approvalRoute, "pending_finance");
    });

    it("should auto-approve when within manager threshold", () => {
      const evaluation = calculateDiscountApprovalRoute({
        tierMax: 20.0,
        categoryMax: 15.0,
        ruleMax: 10.0,
        requestedDiscountPct: 3.0,
        managerThreshold: 5.0,
        financeThreshold: 10.0,
      });

      assert.equal(evaluation.effectiveMaxDiscount, 10.0);
      assert.equal(evaluation.exceedsCeiling, false);
      assert.equal(evaluation.requiresManager, false);
      assert.equal(evaluation.requiresFinance, false);
      assert.equal(evaluation.approvalRoute, "auto");
    });

    it("should flag exceedsCeiling when discount exceeds effective ceiling", () => {
      const evaluation = calculateDiscountApprovalRoute({
        tierMax: 10.0,
        categoryMax: 8.0,
        ruleMax: 6.0,
        requestedDiscountPct: 9.0,
        managerThreshold: 3.0,
        financeThreshold: 5.0,
      });

      assert.equal(evaluation.effectiveMaxDiscount, 6.0);
      assert.equal(evaluation.exceedsCeiling, true);
      assert.equal(evaluation.approvalRoute, "pending_finance");
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

        // 2. Non-admin (rep) token cannot create discount rule (403)
        const repToken = generateAccessToken({ id: 10, email: "rep@dealflow.dev", role: "rep" });
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

        // 3. Admin token can attempt rule creation (validates payload schema before DB)
        const adminToken = generateAccessToken({ id: 1, email: "admin@dealflow.dev", role: "admin" });
        const invalidPayloadRes = await fetch(`${baseUrl}/api/v1/discount-rules`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${adminToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tier_id: -1, // invalid
            category_id: 0, // invalid
            max_discount_pct: 200, // exceeds 100
          }),
        });
        assert.equal(invalidPayloadRes.status, 422);
      } finally {
        server.close();
      }
    });
  });
});

