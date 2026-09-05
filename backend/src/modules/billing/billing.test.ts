import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as http from "node:http";
import { app } from "../../app.js";
import {
  updateSubscriptionSchema,
  invoiceQuerySchema,
  subscriptionQuerySchema,
} from "./billing.schemas.js";
import { addInterval } from "./billing.service.js";
import { generateAccessToken } from "../../lib/jwt.js";

describe("Billing Module", () => {
  describe("Schema Validations", () => {
    it("updateSubscriptionSchema accepts valid seat update", () => {
      const parsed = updateSubscriptionSchema.parse({ quantity: 20 });
      assert.equal(parsed.quantity, 20);
    });

    it("updateSubscriptionSchema rejects zero or negative quantity", () => {
      assert.throws(() => updateSubscriptionSchema.parse({ quantity: 0 }), /positive/i);
      assert.throws(() => updateSubscriptionSchema.parse({ quantity: -5 }), /positive/i);
    });

    it("invoiceQuerySchema applies pagination defaults", () => {
      const parsed = invoiceQuerySchema.parse({});
      assert.equal(parsed.page, 1);
      assert.equal(parsed.limit, 20);
    });

    it("subscriptionQuerySchema accepts status filter", () => {
      const parsed = subscriptionQuerySchema.parse({ status: "active" });
      assert.equal(parsed.status, "active");
    });
  });

  describe("ADR-005 Date Interval Calculations", () => {
    it("addInterval handles monthly correctly", () => {
      const base = new Date("2026-01-15T00:00:00.000Z");
      const nextMonth = addInterval(base, "monthly", 1);
      assert.equal(nextMonth.getUTCMonth(), 1); // February
      assert.equal(nextMonth.getUTCDate(), 15);
    });

    it("addInterval handles quarterly correctly", () => {
      const base = new Date("2026-01-15T00:00:00.000Z");
      const nextQuarter = addInterval(base, "quarterly", 1);
      assert.equal(nextQuarter.getUTCMonth(), 3); // April
    });

    it("addInterval handles yearly correctly", () => {
      const base = new Date("2026-01-15T00:00:00.000Z");
      const nextYear = addInterval(base, "yearly", 1);
      assert.equal(nextYear.getUTCFullYear(), 2027);
    });
  });

  describe("API Endpoints & RBAC Guards", () => {
    it("should reject unauthenticated requests with 401", async () => {
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const { port } = server.address() as any;
      const url = `http://localhost:${port}`;

      try {
        const subRes = await fetch(`${url}/api/v1/billing/subscriptions`);
        assert.equal(subRes.status, 401);

        const subDetailRes = await fetch(`${url}/api/v1/billing/subscriptions/1`);
        assert.equal(subDetailRes.status, 401);

        const updateSubRes = await fetch(`${url}/api/v1/billing/subscriptions/1`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity: 15 }),
        });
        assert.equal(updateSubRes.status, 401);

        const cancelSubRes = await fetch(`${url}/api/v1/billing/subscriptions/1/cancel`, {
          method: "POST",
        });
        assert.equal(cancelSubRes.status, 401);

        const invRes = await fetch(`${url}/api/v1/billing/invoices`);
        assert.equal(invRes.status, 401);

        const payRes = await fetch(`${url}/api/v1/billing/invoices/1/pay`, {
          method: "POST",
        });
        assert.equal(payRes.status, 401);
      } finally {
        server.close();
      }
    });

    it("should forbid sales reps from mutating subscriptions or paying invoices with 403", async () => {
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const { port } = server.address() as any;
      const url = `http://localhost:${port}`;

      const repToken = generateAccessToken({ id: 50, email: "rep@dealflow360.dev", role: "rep" });

      try {
        const updateRes = await fetch(`${url}/api/v1/billing/subscriptions/1`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${repToken}`,
          },
          body: JSON.stringify({ quantity: 20 }),
        });
        assert.equal(updateRes.status, 403);

        const cancelRes = await fetch(`${url}/api/v1/billing/subscriptions/1/cancel`, {
          method: "POST",
          headers: { Authorization: `Bearer ${repToken}` },
        });
        assert.equal(cancelRes.status, 403);

        const payRes = await fetch(`${url}/api/v1/billing/invoices/1/pay`, {
          method: "POST",
          headers: { Authorization: `Bearer ${repToken}` },
        });
        assert.equal(payRes.status, 403);
      } finally {
        server.close();
      }
    });
  });
});
