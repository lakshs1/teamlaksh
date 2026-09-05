import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { registry } from "../../config/swagger.js";

extendZodWithOpenApi(z);

// ═══════════════════════════════════════════════════════════
// UPSELL RULES SCHEMAS
// ═══════════════════════════════════════════════════════════

export const createUpsellRuleSchema = z
  .object({
    source_product_id: z.coerce.number().int().positive("Source product ID must be a positive integer").openapi({ example: 101 }),
    suggested_product_id: z.coerce.number().int().positive("Suggested product ID must be a positive integer").openapi({ example: 105 }),
    rank: z.coerce.number().int().optional().default(1).openapi({ example: 10, description: "Higher rank is displayed first" }),
    is_promoted: z.boolean().optional().default(false).openapi({ example: true, description: "Boosted in recommendation results" }),
    min_margin_pct: z.coerce.number().min(0, "Minimum margin percentage cannot be negative").max(100, "Maximum 100%").optional().default(0).openapi({ example: 25.0 }),
  })
  .refine((data) => data.source_product_id !== data.suggested_product_id, {
    message: "Source product and suggested product cannot be identical",
    path: ["suggested_product_id"],
  })
  .openapi("CreateUpsellRuleRequest");

export const upsellRuleResponseSchema = z
  .object({
    id: z.number().int(),
    source_product_id: z.number().int(),
    suggested_product_id: z.number().int(),
    rank: z.number().int(),
    is_promoted: z.boolean(),
    min_margin_pct: z.number(),
    created_at: z.coerce.date(),
    source_product: z
      .object({
        id: z.number().int(),
        name: z.string(),
        base_price: z.number(),
      })
      .optional(),
    suggested_product: z
      .object({
        id: z.number().int(),
        name: z.string(),
        base_price: z.number(),
        cost_price: z.number(),
      })
      .optional(),
  })
  .openapi("UpsellRuleResponse");

// ═══════════════════════════════════════════════════════════
// SUGGESTIONS RESPONSE SCHEMAS
// ═══════════════════════════════════════════════════════════

export const recommendationSuggestionSchema = z
  .object({
    product_id: z.number().int().openapi({ example: 105 }),
    product_name: z.string().openapi({ example: "1-Year Extended Warranty Support" }),
    base_price: z.number().openapi({ example: 300.0 }),
    cost_price: z.number().openapi({ example: 50.0 }),
    margin_pct: z.number().openapi({ example: 83.33 }),
    is_promoted: z.boolean().openapi({ example: true }),
    rank: z.number().int().openapi({ example: 10 }),
    reason: z.string().openapi({ example: "Frequently bought together with Enterprise Server Rack X1" }),
  })
  .openapi("RecommendationSuggestion");

// ═══════════════════════════════════════════════════════════
// OPENAPI PATH REGISTRATIONS
// ═══════════════════════════════════════════════════════════

registry.registerPath({
  method: "get",
  path: "/recommendations/quotes/{quoteId}/suggestions",
  tags: ["Recommendations"],
  summary: "Get upsell and cross-sell suggestions for an active quote",
  security: [{ BearerAuth: [] }],
  parameters: [
    {
      name: "quoteId",
      in: "path",
      required: true,
      schema: { type: "integer" },
      description: "Quotation ID to generate recommendations for",
    },
  ],
  responses: {
    200: {
      description: "Ranked list of upsell and cross-sell suggestions",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.array(recommendationSuggestionSchema),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/recommendations/rules",
  tags: ["Recommendations"],
  summary: "List all configured upsell and cross-sell rules",
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "List of upsell rules",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.array(upsellRuleResponseSchema),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/recommendations/rules",
  tags: ["Recommendations"],
  summary: "Create a new upsell rule (Admin)",
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: createUpsellRuleSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Upsell rule created successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: upsellRuleResponseSchema,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/recommendations/rules/{id}",
  tags: ["Recommendations"],
  summary: "Delete an upsell rule (Admin)",
  security: [{ BearerAuth: [] }],
  parameters: [
    {
      name: "id",
      in: "path",
      required: true,
      schema: { type: "integer" },
      description: "Rule ID to delete",
    },
  ],
  responses: {
    200: {
      description: "Upsell rule deleted successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            message: z.string(),
          }),
        },
      },
    },
  },
});
