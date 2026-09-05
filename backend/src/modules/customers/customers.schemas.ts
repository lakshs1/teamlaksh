import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { registry } from "../../config/swagger.js";

extendZodWithOpenApi(z);

// ═══════════════════════════════════════════════════════════
// CUSTOMER TIERS SCHEMAS
// ═══════════════════════════════════════════════════════════

export const createTierSchema = z
  .object({
    name: z.string().min(2, "Tier name must be at least 2 characters").openapi({ example: "Gold" }),
    max_discount_pct: z.coerce
      .number()
      .min(0, "Discount cannot be negative")
      .max(100, "Discount cannot exceed 100%")
      .openapi({ example: 15.0 }),
  })
  .openapi("CreateTierRequest");

export const customerTierResponseSchema = z
  .object({
    id: z.number().int().openapi({ example: 1 }),
    name: z.string().openapi({ example: "Gold" }),
    maxDiscountPct: z.string().or(z.number()).openapi({ example: "15.00" }),
    createdAt: z.coerce.date(),
  })
  .openapi("CustomerTier");

// ═══════════════════════════════════════════════════════════
// CUSTOMER SCHEMAS
// ═══════════════════════════════════════════════════════════

export const createCustomerSchema = z
  .object({
    name: z.string().min(2, "Customer name is required").openapi({ example: "Acme Global Industries" }),
    email: z.string().email("Invalid email format").openapi({ example: "procurement@acme.com" }),
    tier_id: z.number().int().positive().nullable().optional().openapi({ example: 1 }),
  })
  .openapi("CreateCustomerRequest");

export const updateCustomerSchema = z
  .object({
    name: z.string().min(2).optional(),
    email: z.string().email().optional(),
    tier_id: z.number().int().positive().nullable().optional(),
  })
  .openapi("UpdateCustomerRequest");

export const customerQuerySchema = z
  .object({
    search: z.string().optional(),
    tier_id: z.coerce.number().int().positive().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  })
  .openapi("CustomerQuery");

export const customerResponseSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    email: z.string().email(),
    tierId: z.number().nullable(),
    tier: customerTierResponseSchema.nullable().optional(),
    createdAt: z.coerce.date(),
  })
  .openapi("Customer");

// ═══════════════════════════════════════════════════════════
// OPENAPI SWAGGER REGISTRATIONS
// ═══════════════════════════════════════════════════════════

registry.registerPath({
  method: "get",
  path: "/customers/tiers",
  tags: ["Customers"],
  summary: "List all customer discount tiers",
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "List of customer tiers",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.array(customerTierResponseSchema),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/customers/tiers",
  tags: ["Customers"],
  summary: "Create a new customer discount tier (Admin only)",
  security: [{ BearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: createTierSchema } } } },
  responses: {
    201: {
      description: "Customer tier created",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: customerTierResponseSchema,
          }),
        },
      },
    },
    409: { description: "Tier name already exists" },
  },
});

registry.registerPath({
  method: "get",
  path: "/customers",
  tags: ["Customers"],
  summary: "List and search customers",
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "Paginated list of customers",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.array(customerResponseSchema),
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
  path: "/customers",
  tags: ["Customers"],
  summary: "Create a customer",
  security: [{ BearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: createCustomerSchema } } } },
  responses: {
    201: {
      description: "Customer created",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: customerResponseSchema,
          }),
        },
      },
    },
    409: { description: "Customer email already exists" },
  },
});

registry.registerPath({
  method: "get",
  path: "/customers/{id}",
  tags: ["Customers"],
  summary: "Get customer by ID",
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "Customer detail with tier",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: customerResponseSchema,
          }),
        },
      },
    },
    404: { description: "Customer not found" },
  },
});

registry.registerPath({
  method: "patch",
  path: "/customers/{id}",
  tags: ["Customers"],
  summary: "Update customer",
  security: [{ BearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: updateCustomerSchema } } } },
  responses: {
    200: {
      description: "Customer updated",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: customerResponseSchema,
          }),
        },
      },
    },
  },
});
