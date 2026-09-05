import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { registry } from "../../config/swagger.js";

extendZodWithOpenApi(z);

// ═══════════════════════════════════════════════════════════
// DISCOUNT RULES SCHEMAS
// ═══════════════════════════════════════════════════════════

export const createDiscountRuleSchema = z
  .object({
    tier_id: z.coerce.number().int().positive("tier_id is required").openapi({ example: 1 }),
    category_id: z.coerce.number().int().positive("category_id is required").openapi({ example: 1 }),
    max_discount_pct: z.coerce
      .number()
      .min(0, "Discount cannot be negative")
      .max(100, "Discount cannot exceed 100%")
      .openapi({ example: 20.0 }),
    manager_threshold_pct: z.coerce
      .number()
      .min(0)
      .max(100)
      .default(0)
      .openapi({ example: 0 }),
    finance_threshold_pct: z.coerce
      .number()
      .min(0)
      .max(100)
      .default(5)
      .openapi({ example: 5.0 }),
  })
  .openapi("CreateDiscountRuleRequest");

export const updateDiscountRuleSchema = z
  .object({
    max_discount_pct: z.coerce.number().min(0).max(100).optional(),
    manager_threshold_pct: z.coerce.number().min(0).max(100).optional(),
    finance_threshold_pct: z.coerce.number().min(0).max(100).optional(),
  })
  .openapi("UpdateDiscountRuleRequest");

export const discountRuleQuerySchema = z
  .object({
    tier_id: z.coerce.number().int().positive().optional(),
    category_id: z.coerce.number().int().positive().optional(),
  })
  .openapi("DiscountRuleQuery");

export const checkDiscountQuerySchema = z
  .object({
    tier_id: z.coerce.number().int().positive(),
    category_id: z.coerce.number().int().positive(),
    requested_discount_pct: z.coerce.number().min(0).max(100),
  })
  .openapi("CheckDiscountQuery");

export const discountRuleResponseSchema = z
  .object({
    id: z.number().int(),
    tierId: z.number().int(),
    categoryId: z.number().int(),
    maxDiscountPct: z.string().or(z.number()),
    managerThresholdPct: z.string().or(z.number()),
    financeThresholdPct: z.string().or(z.number()),
    createdAt: z.coerce.date(),
    tier: z
      .object({
        id: z.number(),
        name: z.string(),
        maxDiscountPct: z.string().or(z.number()),
      })
      .optional(),
    category: z
      .object({
        id: z.number(),
        name: z.string(),
        maxDiscountPct: z.string().or(z.number()),
      })
      .optional(),
  })
  .openapi("DiscountRule");

// ═══════════════════════════════════════════════════════════
// OPENAPI SWAGGER REGISTRATIONS
// ═══════════════════════════════════════════════════════════

registry.registerPath({
  method: "get",
  path: "/discount-rules",
  tags: ["Discount Rules"],
  summary: "Get all discount rules with tier and category metadata",
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "List of discount rules",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.array(discountRuleResponseSchema),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/discount-rules",
  tags: ["Discount Rules"],
  summary: "Create discount governance rule (Admin only)",
  security: [{ BearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: createDiscountRuleSchema } } } },
  responses: {
    201: {
      description: "Discount rule created",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: discountRuleResponseSchema,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/discount-rules/{id}",
  tags: ["Discount Rules"],
  summary: "Update discount governance rule (Admin only)",
  security: [{ BearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: updateDiscountRuleSchema } } } },
  responses: {
    200: {
      description: "Discount rule updated",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: discountRuleResponseSchema,
          }),
        },
      },
    },
    404: { description: "Discount rule not found" },
  },
});
