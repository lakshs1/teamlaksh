import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as http from "node:http";
import { app } from "../../app.js";
import {
  createWarehouseSchema,
  updateStockSchema,
  manualSplitOverrideSchema,
  splitRecommendationResponseSchema,
} from "./fulfillment.schemas.js";
import { generateAccessToken } from "../../lib/jwt.js";

describe("Fulfillment Module", () => {
  describe("Schema Validations", () => {
    it("createWarehouseSchema validates valid warehouse configuration", () => {
      const parsed = createWarehouseSchema.parse({
        name: "Main West Hub",
        code: "WH-WEST",
        location: "San Francisco, CA",
        shipping_cost_weight: 1.2,
        is_active: true,
      });
      assert.equal(parsed.name, "Main West Hub");
      assert.equal(parsed.code, "WH-WEST");
      assert.equal(parsed.shipping_cost_weight, 1.2);
      assert.equal(parsed.is_active, true);
    });

    it("createWarehouseSchema rejects short names and negative weights", () => {
      assert.throws(() => createWarehouseSchema.parse({ name: "A" }), /at least 2 characters/i);
      assert.throws(
        () => createWarehouseSchema.parse({ name: "Hub", shipping_cost_weight: -1 }),
        /cannot be negative/i
      );
    });

    it("updateStockSchema validates stock update request", () => {
      const parsed = updateStockSchema.parse({
        product_id: 101,
        variant_id: 2,
        quantity: 150,
        reorder_level: 25,
      });
      assert.equal(parsed.product_id, 101);
      assert.equal(parsed.variant_id, 2);
      assert.equal(parsed.quantity, 150);
      assert.equal(parsed.reorder_level, 25);
    });

    it("updateStockSchema rejects invalid product_id", () => {
      assert.throws(() => updateStockSchema.parse({ product_id: -1, quantity: 10 }), /positive/i);
    });

    it("manualSplitOverrideSchema requires at least 1 split allocation with positive quantity", () => {
      assert.throws(() => manualSplitOverrideSchema.parse({ splits: [] }), /at least one/i);

      assert.throws(
        () =>
          manualSplitOverrideSchema.parse({
            splits: [{ quote_line_id: 1, warehouse_id: 2, quantity: 0 }],
          }),
        /positive/i
      );

      const valid = manualSplitOverrideSchema.parse({
        splits: [
          { quote_line_id: 1, warehouse_id: 1, quantity: 5 },
          { quote_line_id: 1, warehouse_id: 2, quantity: 5 },
        ],
      });
      assert.equal(valid.splits.length, 2);
    });

    it("splitRecommendationResponseSchema parses recommendation structure", () => {
      const parsed = splitRecommendationResponseSchema.parse({
        quote_id: 42,
        splits: [
          {
            quote_line_id: 10,
            product_id: 101,
            product_name: "Titan Server Rack",
            warehouse_id: 1,
            warehouse_name: "Main Hub",
            quantity: 3,
            is_backordered: false,
          },
        ],
        backordered: [
          {
            quote_line_id: 11,
            product_id: 102,
            product_name: "Blade Enclosure",
            quantity_backordered: 2,
          },
        ],
        total_shipments: 1,
        can_fulfill_completely: false,
      });

      assert.equal(parsed.quote_id, 42);
      assert.equal(parsed.total_shipments, 1);
      assert.equal(parsed.can_fulfill_completely, false);
      assert.equal(parsed.backordered[0].quantity_backordered, 2);
    });
  });

  describe("ADR-004 Greedy Split Algorithm Simulation", () => {
    // Pure unit simulation verifying greedy allocation logic
    function simulateGreedySplit(
      lineQuantity: number,
      warehousesStock: Array<{ id: number; name: string; available: number; weight: number }>
    ) {
      // Sort warehouses by shipping_cost_weight ASC
      const sorted = [...warehousesStock].sort((a, b) => a.weight - b.weight);
      let remaining = lineQuantity;
      const splits: Array<{ warehouse_id: number; quantity: number }> = [];

      for (const wh of sorted) {
        if (wh.available > 0) {
          const take = Math.min(remaining, wh.available);
          splits.push({ warehouse_id: wh.id, quantity: take });
          remaining -= take;
          wh.available -= take;
          if (remaining === 0) break;
        }
      }

      return {
        splits,
        quantityBackordered: remaining,
        canFulfillCompletely: remaining === 0,
      };
    }

    it("fulfills fully from cheapest warehouse when sufficient stock exists", () => {
      const warehouses = [
        { id: 2, name: "Remote Depot", available: 100, weight: 2.0 },
        { id: 1, name: "Local Hub", available: 20, weight: 1.0 },
      ];

      const result = simulateGreedySplit(10, warehouses);
      assert.equal(result.canFulfillCompletely, true);
      assert.equal(result.quantityBackordered, 0);
      assert.equal(result.splits.length, 1);
      assert.equal(result.splits[0].warehouse_id, 1); // Picked cheapest warehouse
      assert.equal(result.splits[0].quantity, 10);
    });

    it("splits across multiple warehouses when primary warehouse has partial stock", () => {
      const warehouses = [
        { id: 1, name: "Cheapest Hub", available: 4, weight: 1.0 },
        { id: 2, name: "Secondary Depot", available: 10, weight: 1.5 },
      ];

      const result = simulateGreedySplit(10, warehouses);
      assert.equal(result.canFulfillCompletely, true);
      assert.equal(result.quantityBackordered, 0);
      assert.equal(result.splits.length, 2);
      assert.equal(result.splits[0].warehouse_id, 1);
      assert.equal(result.splits[0].quantity, 4); // All 4 from primary
      assert.equal(result.splits[1].warehouse_id, 2);
      assert.equal(result.splits[1].quantity, 6); // Remaining 6 from secondary
    });

    it("generates backorders when all warehouses have insufficient stock", () => {
      const warehouses = [
        { id: 1, name: "Hub A", available: 3, weight: 1.0 },
        { id: 2, name: "Hub B", available: 2, weight: 1.2 },
      ];

      const result = simulateGreedySplit(10, warehouses);
      assert.equal(result.canFulfillCompletely, false);
      assert.equal(result.quantityBackordered, 5); // 10 - (3 + 2) = 5
      assert.equal(result.splits.length, 2);
      assert.equal(result.splits[0].quantity, 3);
      assert.equal(result.splits[1].quantity, 2);
    });
  });

  describe("API Endpoints & Access Control", () => {
    it("should reject unauthenticated requests with 401", async () => {
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const { port } = server.address() as any;
      const url = `http://localhost:${port}`;

      try {
        const splitRes = await fetch(`${url}/api/v1/fulfillment/quotes/1/split`);
        assert.equal(splitRes.status, 401);

        const acceptRes = await fetch(`${url}/api/v1/fulfillment/quotes/1/split/accept`, {
          method: "POST",
        });
        assert.equal(acceptRes.status, 401);

        const overrideRes = await fetch(`${url}/api/v1/fulfillment/quotes/1/split/override`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ splits: [{ quote_line_id: 1, warehouse_id: 1, quantity: 1 }] }),
        });
        assert.equal(overrideRes.status, 401);

        const warehousesRes = await fetch(`${url}/api/v1/fulfillment/warehouses`);
        assert.equal(warehousesRes.status, 401);

        const createWhRes = await fetch(`${url}/api/v1/fulfillment/warehouses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Central Hub" }),
        });
        assert.equal(createWhRes.status, 401);
      } finally {
        server.close();
      }
    });

    it("should forbid unauthorized roles from creating warehouses or adjusting stock with 403", async () => {
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const { port } = server.address() as any;
      const url = `http://localhost:${port}`;

      const repToken = generateAccessToken({ id: 88, email: "rep@test.com", role: "rep" });

      try {
        // Sales rep cannot create warehouse
        const createWhRes = await fetch(`${url}/api/v1/fulfillment/warehouses`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${repToken}`,
          },
          body: JSON.stringify({ name: "Rogue Warehouse" }),
        });
        assert.equal(createWhRes.status, 403);

        // Sales rep cannot adjust stock directly
        const updateStockRes = await fetch(`${url}/api/v1/fulfillment/warehouses/1/stock`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${repToken}`,
          },
          body: JSON.stringify({ product_id: 1, quantity: 999 }),
        });
        assert.equal(updateStockRes.status, 403);
      } finally {
        server.close();
      }
    });
  });
});
