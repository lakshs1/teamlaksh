import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as http from "node:http";
import { app } from "../../app.js";
import {
  portalCommentInputSchema,
  sanitizedQuoteLineSchema,
} from "./portal.schemas.js";

describe("Customer Portal Module", () => {
  describe("Schema Validations & Sanitization", () => {
    it("portalCommentInputSchema validates customer message and counter discount", () => {
      const parsed = portalCommentInputSchema.parse({
        quote_line_id: 10,
        message: "Can we get 15% discount for bulk commitment?",
        counter_discount_pct: 15.0,
      });
      assert.equal(parsed.quote_line_id, 10);
      assert.equal(parsed.message, "Can we get 15% discount for bulk commitment?");
      assert.equal(parsed.counter_discount_pct, 15.0);
    });

    it("portalCommentInputSchema rejects empty message", () => {
      assert.throws(() => portalCommentInputSchema.parse({ message: "" }), /empty/i);
    });

    it("portalCommentInputSchema rejects out of range discount", () => {
      assert.throws(
        () => portalCommentInputSchema.parse({ message: "Test", counter_discount_pct: -1 }),
        /negative/i
      );
      assert.throws(
        () => portalCommentInputSchema.parse({ message: "Test", counter_discount_pct: 105 }),
        /100%/i
      );
    });

    it("sanitizedQuoteLineSchema does not contain internal cost or margin keys", () => {
      const lineData = {
        id: 1,
        product_name: "Titan Blade Server",
        quantity: 2,
        unit_price: 2500,
        discount_pct: 10,
        discount_amount: 500,
        line_total: 4500,
        is_recurring: false,
      };

      const parsed = sanitizedQuoteLineSchema.parse(lineData);
      assert.equal((parsed as any).cost_price, undefined);
      assert.equal((parsed as any).margin_pct, undefined);
      assert.equal((parsed as any).blended_risk_score, undefined);
    });
  });

  describe("Public Magic Link Access (No JWT Auth Required)", () => {
    it("should allow public access to portal routes without Authorization header", async () => {
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const { port } = server.address() as any;
      const url = `http://localhost:${port}`;

      try {
        // Calling with non-existent token should return 404 Not Found, NOT 401 Unauthorized!
        const res = await fetch(`${url}/api/v1/portal/quotes/non-existent-uuid-token`);
        assert.equal(res.status, 404);

        const commentRes = await fetch(`${url}/api/v1/portal/quotes/non-existent-uuid-token/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "Hello from customer" }),
        });
        assert.equal(commentRes.status, 404);

        const confirmRes = await fetch(`${url}/api/v1/portal/quotes/non-existent-uuid-token/confirm`, {
          method: "POST",
        });
        assert.equal(confirmRes.status, 404);
      } finally {
        server.close();
      }
    });
  });
});
