import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { registry } from "../../config/swagger.js";

extendZodWithOpenApi(z);

// ═══════════════════════════════════════════════════════════
// SUBSCRIPTION SCHEMAS
// ═══════════════════════════════════════════════════════════

export const subscriptionQuerySchema = z
  .object({
    customer_id: z.coerce.number().int().positive().optional().openapi({ example: 10 }),
    status: z.enum(["active", "paused", "cancelled"]).optional().openapi({ example: "active" }),
  })
  .openapi("SubscriptionQuery");

export const createSubscriptionSchema = z
  .object({
    customer_id: z.coerce.number().int().positive("Customer ID is required").openapi({ example: 1 }),
    product_id: z.coerce.number().int().positive().optional().openapi({ example: 2 }),
    plan_id: z.coerce.number().int().positive().optional().openapi({ example: 1 }),
    quantity: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
    unit_price: z.coerce.number().min(0).optional().openapi({ example: 99.0 }),
    interval: z.enum(["monthly", "quarterly", "yearly"]).default("monthly").openapi({ example: "monthly" }),
    starts_at: z.coerce.date().optional().openapi({ example: "2026-09-06" }),
    quote_id: z.coerce.number().int().optional(),
  })
  .openapi("CreateSubscriptionRequest");

export const updateSubscriptionSchema = z
  .object({
    quantity: z.coerce
      .number()
      .int()
      .positive("Quantity must be a positive integer")
      .optional()
      .openapi({ example: 15, description: "Scale seats up or down mid-cycle" }),
    status: z
      .enum(["active", "paused", "cancelled"])
      .optional()
      .openapi({ example: "active" }),
  })
  .openapi("UpdateSubscriptionRequest");

export const billingScheduleSchema = z
  .object({
    id: z.number().int(),
    subscription_id: z.number().int(),
    period_start: z.coerce.date(),
    period_end: z.coerce.date(),
    amount: z.number(),
    status: z.string(), // upcoming | invoiced | paid | cancelled
    invoice_id: z.number().int().nullable().optional(),
    created_at: z.coerce.date(),
  })
  .openapi("BillingSchedule");

export const subscriptionResponseSchema = z
  .object({
    id: z.number().int(),
    quote_id: z.number().int(),
    quote_line_id: z.number().int(),
    customer_id: z.number().int(),
    product_id: z.number().int(),
    quantity: z.number().int(),
    unit_price: z.number(),
    interval: z.string(), // monthly | quarterly | yearly
    status: z.string(), // active | paused | cancelled
    starts_at: z.coerce.date(),
    current_period_start: z.coerce.date(),
    current_period_end: z.coerce.date(),
    created_at: z.coerce.date(),
    product_name: z.string().optional(),
    customer_name: z.string().optional(),
    schedules: z.array(billingScheduleSchema).optional(),
  })
  .openapi("SubscriptionResponse");

// ═══════════════════════════════════════════════════════════
// INVOICE SCHEMAS
// ═══════════════════════════════════════════════════════════

export const invoiceQuerySchema = z
  .object({
    customer_id: z.coerce.number().int().positive().optional().openapi({ example: 10 }),
    status: z.enum(["draft", "sent", "paid", "cancelled"]).optional().openapi({ example: "paid" }),
    type: z.enum(["one_time", "recurring", "credit_note"]).optional().openapi({ example: "recurring" }),
    page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
    limit: z.coerce.number().int().min(1).max(100).default(20).openapi({ example: 20 }),
  })
  .openapi("InvoiceQuery");

export const invoiceResponseSchema = z
  .object({
    id: z.number().int(),
    invoice_number: z.string().openapi({ example: "INV-2026-0001" }),
    quote_id: z.number().int(),
    customer_id: z.number().int(),
    type: z.string().openapi({ example: "recurring" }), // one_time | recurring | credit_note
    subtotal: z.number(),
    tax: z.number(),
    total: z.number(),
    status: z.string().openapi({ example: "draft" }), // draft | sent | paid | cancelled
    due_date: z.coerce.date().nullable().optional(),
    paid_at: z.coerce.date().nullable().optional(),
    created_at: z.coerce.date(),
    customer: z
      .object({
        id: z.number().int(),
        name: z.string(),
        email: z.string(),
      })
      .optional(),
  })
  .openapi("InvoiceResponse");

// ═══════════════════════════════════════════════════════════
// OPENAPI PATH REGISTRATIONS
// ═══════════════════════════════════════════════════════════

registry.registerPath({
  method: "get",
  path: "/billing/subscriptions",
  tags: ["Billing"],
  summary: "List recurring subscriptions",
  security: [{ BearerAuth: [] }],
  parameters: [
    { name: "customer_id", in: "query", schema: { type: "integer" } },
    { name: "status", in: "query", schema: { type: "string", enum: ["active", "paused", "cancelled"] } },
  ],
  responses: {
    200: {
      description: "List of subscriptions",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.array(subscriptionResponseSchema),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/billing/subscriptions/{id}",
  tags: ["Billing"],
  summary: "Get subscription detail with full billing schedule",
  security: [{ BearerAuth: [] }],
  parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
  responses: {
    200: {
      description: "Subscription with schedules",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: subscriptionResponseSchema,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/billing/subscriptions/{id}",
  tags: ["Billing"],
  summary: "Update subscription seats/quantity with mid-cycle proration",
  security: [{ BearerAuth: [] }],
  parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
  request: {
    body: {
      content: { "application/json": { schema: updateSubscriptionSchema } },
    },
  },
  responses: {
    200: {
      description: "Subscription updated with proration invoice or credit note",
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
  method: "post",
  path: "/billing/subscriptions/{id}/cancel",
  tags: ["Billing"],
  summary: "Cancel subscription and generate prorated credit note for unconsumed days",
  security: [{ BearerAuth: [] }],
  parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
  responses: {
    200: {
      description: "Subscription cancelled with credit note invoice",
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
  path: "/billing/invoices",
  tags: ["Billing"],
  summary: "List invoices with pagination and filters",
  security: [{ BearerAuth: [] }],
  parameters: [
    { name: "customer_id", in: "query", schema: { type: "integer" } },
    { name: "status", in: "query", schema: { type: "string" } },
    { name: "type", in: "query", schema: { type: "string" } },
    { name: "page", in: "query", schema: { type: "integer", default: 1 } },
    { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
  ],
  responses: {
    200: {
      description: "Paginated invoices",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.array(invoiceResponseSchema),
            pagination: z.object({
              page: z.number(),
              limit: z.number(),
              total: z.number(),
              totalPages: z.number(),
            }),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/billing/invoices/{id}",
  tags: ["Billing"],
  summary: "Get invoice details",
  security: [{ BearerAuth: [] }],
  parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
  responses: {
    200: {
      description: "Invoice details",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: invoiceResponseSchema,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/billing/invoices/{id}/pay",
  tags: ["Billing"],
  summary: "Mark invoice as paid",
  security: [{ BearerAuth: [] }],
  parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
  responses: {
    200: {
      description: "Invoice marked as paid",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: invoiceResponseSchema,
            message: z.string(),
          }),
        },
      },
    },
  },
});

// ═══════════════════════════════════════════════════════════
// SUBSCRIPTION PLAN SCHEMAS (PRD Section A5)
// ═══════════════════════════════════════════════════════════

export const createSubscriptionPlanSchema = z
  .object({
    name: z.string().min(1, "Plan name is required").openapi({ example: "Pro Monthly SaaS" }),
    code: z.string().optional().openapi({ example: "PRO-M" }),
    description: z.string().optional().openapi({ example: "Full access license billed monthly" }),
    product_id: z.coerce.number().int().positive().optional().openapi({ example: 5 }),
    interval: z.enum(["monthly", "quarterly", "yearly"]).default("monthly").openapi({ example: "monthly" }),
    base_price: z.coerce.number().min(0, "Base price must be >= 0").openapi({ example: 99.0 }),
    cost_price: z.coerce.number().min(0).default(0).openapi({ example: 20.0 }),
    proration_rule: z.enum(["exact_day", "full_period", "no_proration"]).default("exact_day").openapi({ example: "exact_day" }),
    allow_mid_cycle_changes: z.boolean().default(true).openapi({ example: true }),
    cancellation_policy: z.enum(["prorated_refund", "end_of_cycle", "no_refund"]).default("prorated_refund").openapi({ example: "prorated_refund" }),
    refund_percentage: z.coerce.number().min(0).max(100).default(100).openapi({ example: 100 }),
    notice_period_days: z.coerce.number().int().min(0).default(0).openapi({ example: 0 }),
    is_active: z.boolean().default(true).openapi({ example: true }),
  })
  .openapi("CreateSubscriptionPlanRequest");

export const updateSubscriptionPlanSchema = createSubscriptionPlanSchema.partial().openapi("UpdateSubscriptionPlanRequest");

export const subscriptionPlanResponseSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    code: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    product_id: z.number().int().nullable().optional(),
    product_name: z.string().nullable().optional(),
    interval: z.string(),
    base_price: z.number(),
    cost_price: z.number(),
    proration_rule: z.string(),
    allow_mid_cycle_changes: z.boolean(),
    cancellation_policy: z.string(),
    refund_percentage: z.number(),
    notice_period_days: z.number(),
    is_active: z.boolean(),
    created_at: z.coerce.date(),
    updated_at: z.coerce.date(),
  })
  .openapi("SubscriptionPlanResponse");

registry.registerPath({
  method: "get",
  path: "/billing/plans",
  tags: ["Billing"],
  summary: "List defined recurring subscription plans",
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "List of subscription plans",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.array(subscriptionPlanResponseSchema),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/billing/plans",
  tags: ["Billing"],
  summary: "Create a new recurring subscription plan",
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: createSubscriptionPlanSchema } },
    },
  },
  responses: {
    201: {
      description: "Created subscription plan",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: subscriptionPlanResponseSchema,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/billing/plans/{id}",
  tags: ["Billing"],
  summary: "Get subscription plan by ID",
  security: [{ BearerAuth: [] }],
  parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
  responses: {
    200: {
      description: "Subscription plan details",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: subscriptionPlanResponseSchema,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/billing/plans/{id}",
  tags: ["Billing"],
  summary: "Update subscription plan",
  security: [{ BearerAuth: [] }],
  parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
  request: {
    body: {
      content: { "application/json": { schema: updateSubscriptionPlanSchema } },
    },
  },
  responses: {
    200: {
      description: "Updated subscription plan",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: subscriptionPlanResponseSchema,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/billing/plans/{id}",
  tags: ["Billing"],
  summary: "Delete subscription plan",
  security: [{ BearerAuth: [] }],
  parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
  responses: {
    200: {
      description: "Subscription plan deleted",
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

