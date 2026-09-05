import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as http from "node:http";
import { app } from "../../app.js";
import {
  createUpsellRuleSchema,
  recommendationSuggestionSchema,
} from "./recommendations.schemas.js";
import { generateAccessToken } from "../../lib/jwt.js";

describe("Recommendations Module", () => {
  describe("Schema Validations", () => {
    it("createUpsellRuleSchema accepts valid rule data", () => {
      const parsed = createUpsellRuleSchema.parse({
        source_product_id: 101,
        suggested_product_id: 105,
        rank: 10,
        is_promoted: true,
        min_margin_pct: 20.5,
      });
      assert.equal(parsed.source_product_id, 101);
      assert.equal(parsed.suggested_product_id, 105);
      assert.equal(parsed.rank, 10);
      assert.equal(parsed.is_promoted, true);
      assert.equal(parsed.min_margin_pct, 20.5);
    });

    it("createUpsellRuleSchema applies sensible defaults", () => {
      const parsed = createUpsellRuleSchema.parse({
        source_product_id: 101,
        suggested_product_id: 105,
      });
      assert.equal(parsed.rank, 1);
      assert.equal(parsed.is_promoted, false);
      assert.equal(parsed.min_margin_pct, 0);
    });

    it("createUpsellRuleSchema rejects identical source and suggested products", () => {
      assert.throws(
        () =>
          createUpsellRuleSchema.parse({
            source_product_id: 101,
            suggested_product_id: 101,
          }),
        /cannot be identical/i
      );
    });

    it("createUpsellRuleSchema rejects invalid min_margin_pct", () => {
      assert.throws(
        () =>
          createUpsellRuleSchema.parse({
            source_product_id: 101,
            suggested_product_id: 105,
            min_margin_pct: -5,
          }),
        /cannot be negative/i
      );

      assert.throws(
        () =>
          createUpsellRuleSchema.parse({
            source_product_id: 101,
            suggested_product_id: 105,
            min_margin_pct: 120,
          }),
        /maximum 100%/i
      );
    });

    it("recommendationSuggestionSchema parses correct suggestion object", () => {
      const valid = {
        product_id: 105,
        product_name: "1-Year Extended Warranty",
        base_price: 300,
        cost_price: 50,
        margin_pct: 83.33,
        is_promoted: true,
        rank: 10,
        reason: "Frequently bought together with Server Rack",
      };
      const parsed = recommendationSuggestionSchema.parse(valid);
      assert.equal(parsed.product_id, 105);
      assert.equal(parsed.is_promoted, true);
    });
  });

  describe("API Endpoints & Access Control", () => {
    it("should reject unauthenticated requests with 401", async () => {
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const { port } = server.address() as any;
      const url = `http://localhost:${port}`;

      try {
        const getSuggestions = await fetch(`${url}/api/v1/recommendations/quotes/1/suggestions`);
        assert.equal(getSuggestions.status, 401);

        const listRules = await fetch(`${url}/api/v1/recommendations/rules`);
        assert.equal(listRules.status, 401);

        const createRule = await fetch(`${url}/api/v1/recommendations/rules`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source_product_id: 1, suggested_product_id: 2 }),
        });
        assert.equal(createRule.status, 401);

        const deleteRule = await fetch(`${url}/api/v1/recommendations/rules/1`, {
          method: "DELETE",
        });
        assert.equal(deleteRule.status, 401);
      } finally {
        server.close();
      }
    });

    it("should forbid non-admin from creating or deleting rules with 403", async () => {
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const { port } = server.address() as any;
      const url = `http://localhost:${port}`;

      const repToken = generateAccessToken({ id: 99, email: "rep@test.com", role: "rep" });

      try {
        const createRes = await fetch(`${url}/api/v1/recommendations/rules`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${repToken}`,
          },
          body: JSON.stringify({ source_product_id: 1, suggested_product_id: 2 }),
        });
        assert.equal(createRes.status, 403);

        const deleteRes = await fetch(`${url}/api/v1/recommendations/rules/1`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${repToken}` },
        });
        assert.equal(deleteRes.status, 403);
      } finally {
        server.close();
      }
    });
  });
});
