import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { registry } from "../../config/swagger.js";

extendZodWithOpenApi(z);

// ═══════════════════════════════════════════════════════════
// WAREHOUSE SCHEMAS
// ═══════════════════════════════════════════════════════════

export const createWarehouseSchema = z
  .object({
    name: z.string().min(2, "Warehouse name must be at least 2 characters").openapi({ example: "Main East Hub" }),
    code: z.string().max(50).optional().openapi({ example: "WH-EAST" }),
    location: z.string().optional().openapi({ example: "New York Logistics Center, NY" }),
    shipping_cost_weight: z.coerce
      .number()
      .min(0, "Shipping cost weight cannot be negative")
      .optional()
      .default(1.0)
      .openapi({ example: 1.0, description: "Relative shipping cost priority factor (lower is cheaper/preferred)" }),
    is_active: z.boolean().optional().default(true).openapi({ example: true }),
  })
  .openapi("CreateWarehouseRequest");

export const updateWarehouseSchema = createWarehouseSchema.partial().openapi("UpdateWarehouseRequest");

export const warehouseResponseSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    code: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    shipping_cost_weight: z.number(),
    is_active: z.boolean(),
    created_at: z.coerce.date(),
  })
  .openapi("WarehouseResponse");

// ═══════════════════════════════════════════════════════════
// STOCK SCHEMAS
// ═══════════════════════════════════════════════════════════

export const updateStockSchema = z
  .object({
    product_id: z.coerce.number().int().positive("Product ID must be a positive integer").openapi({ example: 101 }),
    variant_id: z.coerce.number().int().positive().optional().openapi({ example: 1 }),
    quantity: z.coerce.number().int().openapi({ example: 50, description: "Quantity on hand" }),
    reorder_level: z.coerce.number().int().min(0).optional().default(10).openapi({ example: 10 }),
    reorder_quantity: z.coerce.number().int().min(1).optional().default(50).openapi({ example: 50 }),
    notes: z.string().optional().openapi({ example: "Stock adjustment" }),
  })
  .openapi("UpdateStockRequest");

export const replenishStockSchema = z
  .object({
    product_id: z.coerce.number().int().positive("Product ID must be positive").openapi({ example: 101 }),
    variant_id: z.coerce.number().int().positive().optional(),
    quantity: z.coerce.number().int().positive().optional().openapi({ example: 50, description: "Quantity to replenish (defaults to configured reorder_quantity)" }),
    notes: z.string().optional().openapi({ example: "Automated replenishment rule execution" }),
  })
  .openapi("ReplenishStockRequest");

export const warehouseStockResponseSchema = z
  .object({
    id: z.number().int(),
    warehouse_id: z.number().int(),
    product_id: z.number().int(),
    variant_id: z.number().int().nullable().optional(),
    quantity_on_hand: z.number().int(),
    quantity_reserved: z.number().int(),
    available_quantity: z.number().int(),
    reorder_level: z.number().int(),
    reorder_quantity: z.number().int().optional().default(50),
    stock_status: z.enum(["in_stock", "low_stock", "out_of_stock"]).optional(),
    product_name: z.string().optional(),
    category_name: z.string().optional(),
    sku: z.string().optional(),
    unit: z.string().optional(),
    base_price: z.number().optional(),
    warehouse_name: z.string().optional(),
  })
  .openapi("WarehouseStockResponse");

// ═══════════════════════════════════════════════════════════
// SPLIT & FULFILLMENT SCHEMAS
// ═══════════════════════════════════════════════════════════

export const splitAllocationItemSchema = z
  .object({
    quote_line_id: z.coerce.number().int().positive(),
    warehouse_id: z.coerce.number().int().positive(),
    quantity: z.coerce.number().int().positive("Allocated quantity must be positive"),
  })
  .openapi("SplitAllocationItem");

export const manualSplitOverrideSchema = z
  .object({
    splits: z.array(splitAllocationItemSchema).min(1, "At least one split allocation item is required"),
  })
  .openapi("ManualSplitOverrideRequest");

export const simulateAllocationSchema = z
  .object({
    product_id: z.coerce.number().int().positive("Product ID must be positive"),
    quantity: z.coerce.number().int().positive("Quantity must be positive"),
  })
  .openapi("SimulateAllocationRequest");

export const fulfillmentSplitItemSchema = z
  .object({
    quote_line_id: z.number().int(),
    product_id: z.number().int(),
    product_name: z.string(),
    variant_id: z.number().int().nullable().optional(),
    warehouse_id: z.number().int(),
    warehouse_name: z.string(),
    quantity: z.number().int(),
    is_backordered: z.boolean(),
  })
  .openapi("FulfillmentSplitItem");

export const backorderItemSchema = z
  .object({
    quote_line_id: z.number().int(),
    product_id: z.number().int(),
    product_name: z.string(),
    quantity_backordered: z.number().int(),
  })
  .openapi("BackorderItem");

export const splitRecommendationResponseSchema = z
  .object({
    quote_id: z.number().int(),
    splits: z.array(fulfillmentSplitItemSchema),
    backordered: z.array(backorderItemSchema),
    total_shipments: z.number().int(),
    can_fulfill_completely: z.boolean(),
  })
  .openapi("SplitRecommendationResponse");

// ═══════════════════════════════════════════════════════════
// OPENAPI PATH REGISTRATIONS
// ═══════════════════════════════════════════════════════════

registry.registerPath({
  method: "get",
  path: "/fulfillment/quotes/{quoteId}/split",
  tags: ["Fulfillment"],
  summary: "Calculate automated warehouse split recommendation (ADR-004 Greedy)",
  security: [{ BearerAuth: [] }],
  parameters: [
    {
      name: "quoteId",
      in: "path",
      required: true,
      schema: { type: "integer" },
      description: "Quote ID to compute warehouse splits for",
    },
  ],
  responses: {
    200: {
      description: "Automated warehouse split recommendation with backorder analysis",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: splitRecommendationResponseSchema,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/fulfillment/quotes/{quoteId}/split/accept",
  tags: ["Fulfillment"],
  summary: "Accept automated split, record allocations, and decrement inventory",
  security: [{ BearerAuth: [] }],
  parameters: [
    {
      name: "quoteId",
      in: "path",
      required: true,
      schema: { type: "integer" },
      description: "Quote ID to accept fulfillment for",
    },
  ],
  responses: {
    200: {
      description: "Fulfillment allocations committed and inventory decremented",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: splitRecommendationResponseSchema,
            message: z.string(),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/fulfillment/quotes/{quoteId}/split/override",
  tags: ["Fulfillment"],
  summary: "Commit manual warehouse split override",
  security: [{ BearerAuth: [] }],
  parameters: [
    {
      name: "quoteId",
      in: "path",
      required: true,
      schema: { type: "integer" },
      description: "Quote ID to apply override splits for",
    },
  ],
  request: {
    body: {
      content: {
        "application/json": {
          schema: manualSplitOverrideSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Manual split override applied and inventory adjusted",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.any(),
            message: z.string(),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/fulfillment/warehouses",
  tags: ["Fulfillment"],
  summary: "List all fulfillment warehouses",
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "List of warehouses",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.array(warehouseResponseSchema),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/fulfillment/warehouses",
  tags: ["Fulfillment"],
  summary: "Create a new warehouse (Admin / Operations)",
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: createWarehouseSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Warehouse created successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: warehouseResponseSchema,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/fulfillment/warehouses/{id}/stock",
  tags: ["Fulfillment"],
  summary: "Get stock levels for a specific warehouse",
  security: [{ BearerAuth: [] }],
  parameters: [
    {
      name: "id",
      in: "path",
      required: true,
      schema: { type: "integer" },
      description: "Warehouse ID",
    },
  ],
  responses: {
    200: {
      description: "Inventory levels for the warehouse",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.array(warehouseStockResponseSchema),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/fulfillment/warehouses/{id}/stock",
  tags: ["Fulfillment"],
  summary: "Set or update stock levels for a warehouse (Admin / Operations)",
  security: [{ BearerAuth: [] }],
  parameters: [
    {
      name: "id",
      in: "path",
      required: true,
      schema: { type: "integer" },
      description: "Warehouse ID",
    },
  ],
  request: {
    body: {
      content: {
        "application/json": {
          schema: updateStockSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Warehouse stock updated successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: warehouseStockResponseSchema,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/fulfillment/warehouses/{id}",
  tags: ["Fulfillment"],
  summary: "Update warehouse details and shipping cost weighting (Admin / Operations)",
  security: [{ BearerAuth: [] }],
  parameters: [
    {
      name: "id",
      in: "path",
      required: true,
      schema: { type: "integer" },
      description: "Warehouse ID",
    },
  ],
  request: {
    body: {
      content: {
        "application/json": {
          schema: updateWarehouseSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Warehouse updated successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: warehouseResponseSchema,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/fulfillment/warehouses/{id}/replenish",
  tags: ["Fulfillment"],
  summary: "Trigger replenishment for a warehouse item (Admin / Operations)",
  security: [{ BearerAuth: [] }],
  parameters: [
    {
      name: "id",
      in: "path",
      required: true,
      schema: { type: "integer" },
      description: "Warehouse ID",
    },
  ],
  request: {
    body: {
      content: {
        "application/json": {
          schema: replenishStockSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Stock replenished successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: warehouseStockResponseSchema,
          }),
        },
      },
    },
  },
});
