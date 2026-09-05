import { z } from "zod";
import { registry } from "../../config/swagger.js";

// ═══════════════════════════════════════════════════════════
// QUERY & BODY SCHEMAS
// ═══════════════════════════════════════════════════════════

export const dealHealthQuerySchema = z.object({
  stalled_days: z.coerce.number().int().positive().default(7),
});

export type DealHealthQuery = z.infer<typeof dealHealthQuerySchema>;

export const alertsQuerySchema = z.object({
  type: z.enum(["stalled", "discount_anomaly", "delivery_risk"]).optional(),
  severity: z.enum(["info", "warning", "critical"]).optional(),
  is_resolved: z.preprocess((val) => {
    if (typeof val === "string") return val === "true";
    return val;
  }, z.boolean().optional()),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type AlertsQuery = z.infer<typeof alertsQuerySchema>;

export const escalateAlertSchema = z.object({
  message: z.string().trim().max(1000).optional(),
});

export type EscalateAlertInput = z.infer<typeof escalateAlertSchema>;

export const salesReportQuerySchema = z.object({
  period: z
    .enum(["today", "weekly", "monthly", "quarterly", "yearly", "all"])
    .default("monthly"),
  rep_id: z.coerce.number().int().positive().optional(),
  category_id: z.coerce.number().int().positive().optional(),
  product_id: z.coerce.number().int().positive().optional(),
  status: z.string().optional(),
});

export type SalesReportQuery = z.infer<typeof salesReportQuerySchema>;

// ═══════════════════════════════════════════════════════════
// OPENAPI SWAGGER REGISTRATIONS
// ═══════════════════════════════════════════════════════════

const stalledQuoteSchema = registry.register(
  "StalledQuote",
  z.object({
    id: z.number(),
    quote_number: z.string(),
    customer_name: z.string(),
    days_inactive: z.number(),
    grand_total: z.number(),
    rep_name: z.string(),
  })
);

const discountAnomalySchema = registry.register(
  "DiscountAnomaly",
  z.object({
    id: z.number(),
    quote_number: z.string(),
    rep_name: z.string(),
    excess_pct: z.number(),
    blended_risk_score: z.number(),
  })
);

const deliveryRiskSchema = registry.register(
  "DeliveryRisk",
  z.object({
    quote_id: z.number(),
    product_name: z.string(),
    shortage_quantity: z.number(),
  })
);

const dealHealthResponseSchema = registry.register(
  "DealHealthResponse",
  z.object({
    stalled_quotes: z.array(stalledQuoteSchema),
    discount_anomalies: z.array(discountAnomalySchema),
    delivery_risks: z.array(deliveryRiskSchema),
  })
);

const alertItemSchema = registry.register(
  "AlertItem",
  z.object({
    id: z.number(),
    quote_id: z.number(),
    quote_number: z.string().optional(),
    customer_name: z.string().optional(),
    type: z.string(),
    severity: z.string(),
    message: z.string(),
    is_resolved: z.boolean(),
    created_at: z.date(),
  })
);

const salesReportResponseSchema = registry.register(
  "SalesReportResponse",
  z.object({
    total_quotes: z.number(),
    total_revenue: z.number(),
    avg_discount_pct: z.number(),
    avg_margin_pct: z.number(),
    by_rep: z.array(
      z.object({
        rep_id: z.number(),
        rep_name: z.string(),
        quotes: z.number(),
        revenue: z.number(),
      })
    ),
    by_category: z.array(
      z.object({
        category_id: z.number(),
        category_name: z.string(),
        revenue: z.number(),
      })
    ),
  })
);

// OpenAPI Routes Registration
registry.registerPath({
  method: "get",
  path: "/api/v1/analytics/deal-health",
  tags: ["Analytics"],
  summary: "Get deal health and risk overview",
  description:
    "Returns stalled quotations, discount policy anomalies, and warehouse fulfillment delivery shortages. Requires manager or admin role.",
  security: [{ BearerAuth: [] }],
  parameters: [
    {
      name: "stalled_days",
      in: "query",
      required: false,
      schema: { type: "integer", default: 7 },
      description: "Days of inactivity to consider a quote stalled",
    },
  ],
  responses: {
    200: {
      description: "Deal health summary",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: dealHealthResponseSchema,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/analytics/alerts",
  tags: ["Analytics"],
  summary: "List deal alerts",
  description: "Returns paginated deal alerts with filters. Requires manager or admin role.",
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "Paginated deal alerts",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.array(alertItemSchema),
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
  method: "post",
  path: "/api/v1/analytics/alerts/{id}/resolve",
  tags: ["Analytics"],
  summary: "Resolve a deal alert",
  description: "Marks a deal alert as resolved. Requires manager or admin role.",
  security: [{ BearerAuth: [] }],
  parameters: [
    {
      name: "id",
      in: "path",
      required: true,
      schema: { type: "integer" },
    },
  ],
  responses: {
    200: {
      description: "Alert marked as resolved",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/analytics/alerts/{id}/escalate",
  tags: ["Analytics"],
  summary: "Escalate an alert to the sales rep",
  description:
    "Bumps alert severity to critical and writes an audit log entry in approval_logs. Requires manager or admin role.",
  security: [{ BearerAuth: [] }],
  parameters: [
    {
      name: "id",
      in: "path",
      required: true,
      schema: { type: "integer" },
    },
  ],
  request: {
    body: {
      content: {
        "application/json": {
          schema: escalateAlertSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Alert escalated",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
            data: alertItemSchema,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/analytics/reports/sales",
  tags: ["Analytics"],
  summary: "Get sales and margin analytics report",
  description:
    "Aggregates total revenue, quote count, average discounts and margins by timeframe, sales rep, and category.",
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "Sales & margin analytics report",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: salesReportResponseSchema,
          }),
        },
      },
    },
  },
});
