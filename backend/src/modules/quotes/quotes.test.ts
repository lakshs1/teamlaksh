import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as http from "node:http";
import { app } from "../../app.js";
import { createQuoteSchema, addLineSchema, updateLineSchema, quoteQuerySchema } from "./quotes.schemas.js";
import { computeBlendedRisk } from "./quotes.service.js";
import { generateAccessToken } from "../../lib/jwt.js";

const baseUrl = "http://localhost";

// ═══════════════════════════════════════════════════════════
// SCHEMA VALIDATION
// ═══════════════════════════════════════════════════════════

describe("Quotes Module", () => {
  describe("Schema Validations", () => {
    it("createQuoteSchema should require customer_id", () => {
      assert.throws(() => createQuoteSchema.parse({}), /customer_id/);
    });

    it("createQuoteSchema should accept valid payload", () => {
      const result = createQuoteSchema.parse({
        customer_id: 1,
        notes: "Priority deal",
      });
      assert.equal(result.customer_id, 1);
      assert.equal(result.notes, "Priority deal");
    });

    it("addLineSchema should require product_id", () => {
      assert.throws(() => addLineSchema.parse({ quantity: 1 }), /product_id/);
    });

    it("addLineSchema should default quantity=1 and discount_pct=0", () => {
      const result = addLineSchema.parse({ product_id: 5 });
      assert.equal(result.product_id, 5);
      assert.equal(result.quantity, 1);
      assert.equal(result.discount_pct, 0);
    });

    it("addLineSchema should reject discount_pct > 100", () => {
      assert.throws(() => addLineSchema.parse({ product_id: 1, discount_pct: 150 }), /too_big|max/i);
    });

    it("updateLineSchema accepts partial fields", () => {
      const result = updateLineSchema.parse({ quantity: 5 });
      assert.equal(result.quantity, 5);
      assert.equal(result.discount_pct, undefined);
    });

    it("quoteQuerySchema defaults page=1 limit=20", () => {
      const result = quoteQuerySchema.parse({});
      assert.equal(result.page, 1);
      assert.equal(result.limit, 20);
    });

    it("quoteQuerySchema coerces string numbers", () => {
      const result = quoteQuerySchema.parse({ page: "2", limit: "10", customer_id: "5" });
      assert.equal(result.page, 2);
      assert.equal(result.limit, 10);
      assert.equal(result.customer_id, 5);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // BLENDED RISK ENGINE — PURE UNIT TESTS
  // ═══════════════════════════════════════════════════════════

  describe("Blended Risk Engine — computeBlendedRisk()", () => {
    it("should return score=0 and route=auto with empty lines", () => {
      const result = computeBlendedRisk([], 0);
      assert.equal(result.score, 0);
      assert.equal(result.approvalRoute, "auto");
      assert.equal(result.status, "approved");
    });

    it("should auto-approve when no lines exceed allowed discount", () => {
      const lines = [
        { id: 1, productId: 1, discountPct: "5", allowedDiscountPct: "10", lineTotal: "100", approvalRoute: "auto" },
        { id: 2, productId: 2, discountPct: "3", allowedDiscountPct: "10", lineTotal: "200", approvalRoute: "auto" },
      ];
      const result = computeBlendedRisk(lines, 300);
      assert.equal(result.approvalRoute, "auto");
      assert.equal(result.status, "approved");
      assert.equal(result.score, 0);
    });

    it("should route to pending_manager when manager-level approval is needed", () => {
      const lines = [
        { id: 1, productId: 1, discountPct: "8", allowedDiscountPct: "10", lineTotal: "500", approvalRoute: "pending_manager" },
      ];
      const result = computeBlendedRisk(lines, 500);
      assert.equal(result.approvalRoute, "manager");
      assert.equal(result.status, "pending_manager");
    });

    it("should route to manager_finance when finance-level approval is needed", () => {
      const lines = [
        { id: 1, productId: 1, discountPct: "20", allowedDiscountPct: "10", lineTotal: "1000", approvalRoute: "pending_finance" },
      ];
      const result = computeBlendedRisk(lines, 1000);
      assert.equal(result.approvalRoute, "manager_finance");
      assert.equal(result.status, "pending_manager"); // routes to manager first
    });

    it("should escalate to highest approval route across mixed lines", () => {
      const lines = [
        { id: 1, productId: 1, discountPct: "5", allowedDiscountPct: "10", lineTotal: "200", approvalRoute: "auto" },
        { id: 2, productId: 2, discountPct: "18", allowedDiscountPct: "10", lineTotal: "800", approvalRoute: "pending_finance" },
      ];
      const result = computeBlendedRisk(lines, 1000);
      // Finance escalation must dominate
      assert.equal(result.approvalRoute, "manager_finance");
    });

    it("blended score should be revenue-weighted", () => {
      // Line 1: 5% excess, $100 (10% weight)
      // Line 2: 0% excess, $900 (90% weight)
      // Blended = 5 * 0.1 + 0 * 0.9 = 0.5
      const lines = [
        { id: 1, productId: 1, discountPct: "15", allowedDiscountPct: "10", lineTotal: "100", approvalRoute: "pending_manager" },
        { id: 2, productId: 2, discountPct: "5", allowedDiscountPct: "10", lineTotal: "900", approvalRoute: "auto" },
      ];
      const result = computeBlendedRisk(lines, 1000);
      assert.equal(result.score, 0.5); // 5 * (100/1000) = 0.5
    });

    it("lineBreakdown should contain per-line detail", () => {
      const lines = [
        { id: 42, productId: 7, discountPct: "12", allowedDiscountPct: "8", lineTotal: "500", approvalRoute: "pending_manager" },
      ];
      const result = computeBlendedRisk(lines, 500);
      assert.equal(result.lineBreakdown.length, 1);
      assert.equal(result.lineBreakdown[0].lineId, 42);
      assert.equal(result.lineBreakdown[0].excessPct, 4); // 12 - 8
    });
  });

  // ═══════════════════════════════════════════════════════════
  // API ENDPOINT TESTS
  // ═══════════════════════════════════════════════════════════

  describe("API Endpoints & Access Control", () => {
    it("should require authentication on all quote endpoints", async () => {
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const { port } = server.address() as any;
      const url = `http://localhost:${port}`;

      try {
        // GET /quotes — unauthenticated
        const listRes = await fetch(`${url}/api/v1/quotes`);
        assert.equal(listRes.status, 401);

        // POST /quotes — unauthenticated
        const createRes = await fetch(`${url}/api/v1/quotes`, { method: "POST" });
        assert.equal(createRes.status, 401);

        // GET /quotes/:id — unauthenticated
        const getRes = await fetch(`${url}/api/v1/quotes/1`);
        assert.equal(getRes.status, 401);

        // POST /quotes/:id/submit — unauthenticated
        const submitRes = await fetch(`${url}/api/v1/quotes/1/submit`, { method: "POST" });
        assert.equal(submitRes.status, 401);
      } finally {
        server.close();
      }
    });

    it("finance role cannot create quotes (403)", async () => {
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const { port } = server.address() as any;
      const url = `http://localhost:${port}`;

      try {
        const financeToken = generateAccessToken({ id: 5, email: "finance@dealflow.dev", role: "finance" });
        const res = await fetch(`${url}/api/v1/quotes`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${financeToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ customer_id: 1 }),
        });
        assert.equal(res.status, 403);
      } finally {
        server.close();
      }
    });

    it("operations role cannot create quotes (403)", async () => {
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const { port } = server.address() as any;
      const url = `http://localhost:${port}`;

      try {
        const opsToken = generateAccessToken({ id: 8, email: "ops@dealflow.dev", role: "operations" });
        const res = await fetch(`${url}/api/v1/quotes`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${opsToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ customer_id: 1 }),
        });
        assert.equal(res.status, 403);
      } finally {
        server.close();
      }
    });

    it("invalid quote body returns 422 Unprocessable Entity", async () => {
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const { port } = server.address() as any;
      const url = `http://localhost:${port}`;

      try {
        const repToken = generateAccessToken({ id: 10, email: "rep@dealflow.dev", role: "rep" });
        const res = await fetch(`${url}/api/v1/quotes`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${repToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ customer_id: "not-a-number" }),
        });
        assert.ok([400, 422].includes(res.status));
      } finally {
        server.close();
      }
    });

    it("invalid add line body returns 422 Unprocessable Entity", async () => {
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const { port } = server.address() as any;
      const url = `http://localhost:${port}`;

      try {
        const repToken = generateAccessToken({ id: 10, email: "rep@dealflow.dev", role: "rep" });
        const res = await fetch(`${url}/api/v1/quotes/1/lines`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${repToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ product_id: "invalid", quantity: -5 }),
        });
        assert.ok([400, 422].includes(res.status));
      } finally {
        server.close();
      }
    });
  });
});
