import { describe, it } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { app } from "../../app.js";
import { generateAccessToken } from "../../lib/jwt.js";
import {
  createTierSchema,
  createCustomerSchema,
  updateCustomerSchema,
} from "./customers.schemas.js";

describe("Customers & Tiers Module", () => {
  describe("Schema Validations", () => {
    it("should validate createTierSchema correctly", () => {
      const valid = createTierSchema.parse({
        name: "Diamond",
        max_discount_pct: 25.5,
      });
      assert.equal(valid.name, "Diamond");
      assert.equal(valid.max_discount_pct, 25.5);

      assert.throws(() => {
        createTierSchema.parse({ name: "A", max_discount_pct: -5 });
      });

      assert.throws(() => {
        createTierSchema.parse({ name: "Diamond", max_discount_pct: 120 });
      });
    });

    it("should validate createCustomerSchema correctly", () => {
      const valid = createCustomerSchema.parse({
        name: "Acme Corp",
        email: "contact@acme.com",
        tier_id: 1,
      });
      assert.equal(valid.name, "Acme Corp");
      assert.equal(valid.email, "contact@acme.com");

      assert.throws(() => {
        createCustomerSchema.parse({ name: "", email: "invalid-email" });
      });
    });

    it("should validate updateCustomerSchema correctly", () => {
      const valid = updateCustomerSchema.parse({
        name: "Acme International",
      });
      assert.equal(valid.name, "Acme International");
    });
  });

  describe("API Endpoints & Access Control", () => {
    it("should enforce authentication and admin authorization on tiers", async () => {
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      const baseUrl = `http://127.0.0.1:${port}`;

      try {
        // 1. Unauthenticated request to /tiers should be 401
        const unauthRes = await fetch(`${baseUrl}/api/v1/customers/tiers`);
        assert.equal(unauthRes.status, 401);

        const unauthCustRes = await fetch(`${baseUrl}/api/v1/customers`);
        assert.equal(unauthCustRes.status, 401);

        // 2. Non-admin cannot create a tier (403)
        const repToken = generateAccessToken({ id: 10, email: "rep@dealflow.dev", role: "rep" });
        const forbiddenRes = await fetch(`${baseUrl}/api/v1/customers/tiers`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${repToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: "Platinum VIP", max_discount_pct: 30 }),
        });
        assert.equal(forbiddenRes.status, 403);

        // 3. Admin token sends invalid tier data -> 422 Unprocessable Entity
        const adminToken = generateAccessToken({ id: 1, email: "admin@dealflow.dev", role: "admin" });
        const invalidTierRes = await fetch(`${baseUrl}/api/v1/customers/tiers`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${adminToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: "", max_discount_pct: 150 }),
        });
        assert.equal(invalidTierRes.status, 422);
      } finally {
        server.close();
      }
    });
  });
});
