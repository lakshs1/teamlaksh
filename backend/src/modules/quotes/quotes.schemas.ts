import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { registry } from "../../config/swagger.js";

extendZodWithOpenApi(z);

// ═══════════════════════════════════════════════════════════
// QUOTE SCHEMAS
// ═══════════════════════════════════════════════════════════

export const QUOTE_STATUSES = [
  "draft",
  "submitted",
  "pending_manager",
  "pending_finance",
  "approved",
  "fulfillment",
  "confirmed",
  "invoiced",
  "rejected",
  "revision",
] as const;

export const createQuoteSchema = z
  .object({
    customer_id: z.coerce.number().int().positive("customer_id is required").openapi({ example: 1 }),
    notes: z.string().optional().openapi({ example: "Priority deal for Q3 close" }),
    expires_at: z.coerce.date().nullable().optional().openapi({ example: "2026-12-31T00:00:00Z" }),
  })
  .openapi("CreateQuoteRequest");

export const updateQuoteSchema = z
  .object({
    notes: z.string().nullable().optional(),
    expires_at: z.coerce.date().nullable().optional(),
  })
  .openapi("UpdateQuoteRequest");

export const quoteQuerySchema = z
  .object({
    status: z.string().optional(),
    search: z.string().optional(),

    customer_id: z.coerce.number().int().positive().optional(),
    rep_id: z.coerce.number().int().positive().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  })
  .openapi("QuoteQuery");

// ═══════════════════════════════════════════════════════════
// QUOTE LINE SCHEMAS
// ═══════════════════════════════════════════════════════════

export const addLineSchema = z
  .object({
    product_id: z.coerce.number().int().positive("product_id is required").openapi({ example: 1 }),
    variant_id: z.coerce.number().int().positive().nullable().optional().openapi({ example: null }),
    quantity: z.coerce.number().int().positive().default(1).openapi({ example: 2 }),
    discount_pct: z.coerce.number().min(0).max(100).default(0).openapi({ example: 5.0 }),
  })
  .openapi("AddLineRequest");

export const updateLineSchema = z
  .object({
    quantity: z.coerce.number().int().positive().optional(),
    discount_pct: z.coerce.number().min(0).max(100).optional(),
  })
  .openapi("UpdateLineRequest");

// ═══════════════════════════════════════════════════════════
// RESPONSE SCHEMAS
// ═══════════════════════════════════════════════════════════

export const quoteLineResponseSchema = z
  .object({
    id: z.number().int(),
    quoteId: z.number().int(),
    productId: z.number().int(),
    variantId: z.number().int().nullable(),
    quantity: z.number().int(),
    unitPrice: z.string().or(z.number()),
    costPrice: z.string().or(z.number()),
    discountPct: z.string().or(z.number()),
    discountAmount: z.string().or(z.number()),
    lineTotal: z.string().or(z.number()),
    marginPct: z.string().or(z.number()),
    allowedDiscountPct: z.string().or(z.number()),
    excessPct: z.string().or(z.number()),
    isRecurring: z.boolean(),
    isUpsell: z.boolean(),
    createdAt: z.coerce.date(),
    product: z
      .object({
        id: z.number(),
        name: z.string(),
        unit: z.string(),
        basePrice: z.string().or(z.number()),
        category: z
          .object({ id: z.number(), name: z.string() })
          .nullable()
          .optional(),
      })
      .optional(),
  })
  .openapi("QuoteLine");

export const quoteResponseSchema = z
  .object({
    id: z.number().int(),
    quoteNumber: z.string(),
    customerId: z.number().int(),
    repId: z.number().int(),
    status: z.string(),
    portalToken: z.string().nullable(),
    subtotal: z.string().or(z.number()),
    totalDiscount: z.string().or(z.number()),
    totalTax: z.string().or(z.number()),
    grandTotal: z.string().or(z.number()),
    blendedRiskScore: z.string().or(z.number()),
    approvalRoute: z.string().nullable(),
    notes: z.string().nullable(),
    expiresAt: z.coerce.date().nullable(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    customer: z
      .object({
        id: z.number(),
        name: z.string(),
        email: z.string(),
        tier: z.object({ id: z.number(), name: z.string() }).nullable().optional(),
      })
      .optional(),
    lines: z.array(quoteLineResponseSchema).optional(),
  })
  .openapi("Quote");

export const submitResponseSchema = z
  .object({
    id: z.number().int(),
    status: z.string(),
    blendedRiskScore: z.string().or(z.number()),
    approvalRoute: z.string().nullable(),
    message: z.string(),
  })
  .openapi("SubmitQuoteResponse");

// ═══════════════════════════════════════════════════════════
// OPENAPI SWAGGER REGISTRATIONS
// ═══════════════════════════════════════════════════════════

registry.registerPath({
  method: "get",
  path: "/quotes",
  tags: ["Quotes"],
  summary: "List all quotes with filtering and pagination",
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "Paginated quote list",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.array(quoteResponseSchema),
            pagination: z.object({ page: z.number(), limit: z.number(), total: z.number(), totalPages: z.number() }),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/quotes",
  tags: ["Quotes"],
  summary: "Create a new draft quote",
  security: [{ BearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: createQuoteSchema } } } },
  responses: {
    201: {
      description: "Draft quote created with portal_token",
      content: { "application/json": { schema: z.object({ success: z.literal(true), data: quoteResponseSchema }) } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/quotes/{id}",
  tags: ["Quotes"],
  summary: "Get full quote detail with lines, margins, risk score",
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "Full quote detail",
      content: { "application/json": { schema: z.object({ success: z.literal(true), data: quoteResponseSchema }) } },
    },
    404: { description: "Quote not found" },
  },
});

registry.registerPath({
  method: "patch",
  path: "/quotes/{id}",
  tags: ["Quotes"],
  summary: "Update draft quote metadata (notes, expiry)",
  security: [{ BearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: updateQuoteSchema } } } },
  responses: {
    200: {
      description: "Quote updated",
      content: { "application/json": { schema: z.object({ success: z.literal(true), data: quoteResponseSchema }) } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/quotes/{id}/lines",
  tags: ["Quotes"],
  summary: "Add line to quote with computed margin and allowed discount",
  security: [{ BearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: addLineSchema } } } },
  responses: {
    201: {
      description: "Line added and quote totals updated",
      content: { "application/json": { schema: z.object({ success: z.literal(true), data: quoteLineResponseSchema }) } },
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/quotes/{id}/lines/{lineId}",
  tags: ["Quotes"],
  summary: "Update line quantity or discount, recompute totals",
  security: [{ BearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: updateLineSchema } } } },
  responses: {
    200: {
      description: "Line updated",
      content: { "application/json": { schema: z.object({ success: z.literal(true), data: quoteLineResponseSchema }) } },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/quotes/{id}/lines/{lineId}",
  tags: ["Quotes"],
  summary: "Remove a line from the quote",
  security: [{ BearerAuth: [] }],
  responses: {
    200: { description: "Line deleted, quote totals recalculated" },
  },
});

registry.registerPath({
  method: "post",
  path: "/quotes/{id}/submit",
  tags: ["Quotes"],
  summary: "Submit quote — compute blended risk, determine approval route",
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "Quote submitted with risk score and routing decision",
      content: { "application/json": { schema: z.object({ success: z.literal(true), data: submitResponseSchema }) } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/quotes/{id}/confirm",
  tags: ["Quotes"],
  summary: "Rep confirms approved quote → moves to fulfillment",
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "Quote confirmed, moved to fulfillment",
      content: { "application/json": { schema: z.object({ success: z.literal(true), data: quoteResponseSchema }) } },
    },
  },
});
