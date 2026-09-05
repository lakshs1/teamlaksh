import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { registry } from "../../config/swagger.js";

extendZodWithOpenApi(z);

// ═══════════════════════════════════════════════════════════
// CATEGORY SCHEMAS
// ═══════════════════════════════════════════════════════════

export const createCategorySchema = z
  .object({
    name: z.string().min(2, "Category name is required").openapi({ example: "Hardware" }),
    max_discount_pct: z.coerce
      .number()
      .min(0, "Discount cannot be negative")
      .max(100, "Discount cannot exceed 100%")
      .openapi({ example: 15.0 }),
  })
  .openapi("CreateCategoryRequest");

export const categoryResponseSchema = z
  .object({
    id: z.number().int().openapi({ example: 1 }),
    name: z.string().openapi({ example: "Hardware" }),
    maxDiscountPct: z.string().or(z.number()).openapi({ example: "15.00" }),
    createdAt: z.coerce.date(),
  })
  .openapi("Category");

// ═══════════════════════════════════════════════════════════
// VARIANT SCHEMAS
// ═══════════════════════════════════════════════════════════

export const createVariantSchema = z
  .object({
    attribute_name: z.string().min(1, "Attribute name is required").openapi({ example: "Edition" }),
    attribute_value: z.string().min(1, "Attribute value is required").openapi({ example: "Enterprise" }),
    extra_price: z.coerce.number().min(0, "Extra price cannot be negative").default(0).openapi({ example: 50.0 }),
  })
  .openapi("CreateVariantRequest");

export const variantResponseSchema = z
  .object({
    id: z.number().int(),
    productId: z.number().int(),
    attributeName: z.string(),
    attributeValue: z.string(),
    extraPrice: z.string().or(z.number()),
    createdAt: z.coerce.date(),
  })
  .openapi("ProductVariant");

// ═══════════════════════════════════════════════════════════
// PRODUCT SCHEMAS
// ═══════════════════════════════════════════════════════════

export const createProductSchema = z
  .object({
    name: z.string().min(2, "Product name is required").openapi({ example: "Ultra Server Rack" }),
    description: z.string().optional().openapi({ example: "High-density enterprise compute rack" }),
    category_id: z.coerce.number().int().positive("category_id is required").openapi({ example: 1 }),
    base_price: z.coerce.number().min(0, "Base price cannot be negative").openapi({ example: 2500.0 }),
    cost_price: z.coerce.number().min(0, "Cost price cannot be negative").openapi({ example: 1600.0 }),
    unit: z.string().default("unit").openapi({ example: "unit" }),
    tax_pct: z.coerce.number().min(0).max(100).default(0).openapi({ example: 10.0 }),
    is_recurring: z.boolean().default(false).openapi({ example: false }),
    recurring_interval: z
      .enum(["monthly", "quarterly", "yearly"])
      .nullable()
      .optional()
      .openapi({ example: "monthly" }),
  })
  .openapi("CreateProductRequest");

export const updateProductSchema = z
  .object({
    name: z.string().min(2).optional(),
    description: z.string().nullable().optional(),
    category_id: z.coerce.number().int().positive().optional(),
    base_price: z.coerce.number().min(0).optional(),
    cost_price: z.coerce.number().min(0).optional(),
    unit: z.string().optional(),
    tax_pct: z.coerce.number().min(0).max(100).optional(),
    is_recurring: z.boolean().optional(),
    recurring_interval: z.enum(["monthly", "quarterly", "yearly"]).nullable().optional(),
    is_active: z.boolean().optional(),
  })
  .openapi("UpdateProductRequest");

export const productQuerySchema = z
  .object({
    search: z.string().optional(),
    category_id: z.coerce.number().int().positive().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  })
  .openapi("ProductQuery");

export const productResponseSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    description: z.string().nullable(),
    categoryId: z.number().int(),
    basePrice: z.string().or(z.number()),
    costPrice: z.string().or(z.number()),
    unit: z.string(),
    taxPct: z.string().or(z.number()),
    isRecurring: z.boolean(),
    recurringInterval: z.string().nullable(),
    isActive: z.boolean(),
    createdAt: z.coerce.date(),
    category: categoryResponseSchema.optional(),
    variants: z.array(variantResponseSchema).optional(),
  })
  .openapi("Product");

// ═══════════════════════════════════════════════════════════
// PRICE LIST SCHEMAS
// ═══════════════════════════════════════════════════════════

export const createPriceListSchema = z
  .object({
    name: z.string().min(2, "Price list name is required").openapi({ example: "Gold Tier Pricing" }),
    tier_id: z.coerce.number().int().positive().nullable().optional().openapi({ example: 1 }),
    currency: z.string().default("USD").openapi({ example: "USD" }),
  })
  .openapi("CreatePriceListRequest");

export const addPriceListItemSchema = z
  .object({
    product_id: z.coerce.number().int().positive("product_id is required").openapi({ example: 1 }),
    unit_price: z.coerce.number().min(0, "Unit price cannot be negative").openapi({ example: 2100.0 }),
  })
  .openapi("AddPriceListItemRequest");

export const priceListItemResponseSchema = z
  .object({
    id: z.number().int(),
    priceListId: z.number().int(),
    productId: z.number().int(),
    unitPrice: z.string().or(z.number()),
    createdAt: z.coerce.date(),
  })
  .openapi("PriceListItem");

export const priceListResponseSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    tierId: z.number().nullable(),
    currency: z.string(),
    isActive: z.boolean(),
    createdAt: z.coerce.date(),
    items: z.array(priceListItemResponseSchema).optional(),
  })
  .openapi("PriceList");

// ═══════════════════════════════════════════════════════════
// OPENAPI SWAGGER REGISTRATIONS
// ═══════════════════════════════════════════════════════════

registry.registerPath({
  method: "get",
  path: "/catalog/categories",
  tags: ["Catalog"],
  summary: "List all product categories",
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "List of product categories",
      content: { "application/json": { schema: z.object({ success: z.literal(true), data: z.array(categoryResponseSchema) }) } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/catalog/categories",
  tags: ["Catalog"],
  summary: "Create product category (Admin only)",
  security: [{ BearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: createCategorySchema } } } },
  responses: {
    201: {
      description: "Category created",
      content: { "application/json": { schema: z.object({ success: z.literal(true), data: categoryResponseSchema }) } },
    },
    409: { description: "Category name already exists" },
  },
});

registry.registerPath({
  method: "get",
  path: "/catalog/products",
  tags: ["Catalog"],
  summary: "List products with filtering and pagination",
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "Paginated list of products",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.array(productResponseSchema),
            pagination: z.object({ page: z.number(), limit: z.number(), total: z.number(), totalPages: z.number() }),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/catalog/products",
  tags: ["Catalog"],
  summary: "Create product (Admin only)",
  security: [{ BearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: createProductSchema } } } },
  responses: {
    201: {
      description: "Product created",
      content: { "application/json": { schema: z.object({ success: z.literal(true), data: productResponseSchema }) } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/catalog/products/{id}",
  tags: ["Catalog"],
  summary: "Get product details by ID with variants and category",
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "Product detail",
      content: { "application/json": { schema: z.object({ success: z.literal(true), data: productResponseSchema }) } },
    },
    404: { description: "Product not found" },
  },
});

registry.registerPath({
  method: "patch",
  path: "/catalog/products/{id}",
  tags: ["Catalog"],
  summary: "Update product (Admin only)",
  security: [{ BearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: updateProductSchema } } } },
  responses: {
    200: {
      description: "Product updated",
      content: { "application/json": { schema: z.object({ success: z.literal(true), data: productResponseSchema }) } },
    },
    404: { description: "Product not found" },
  },
});

registry.registerPath({
  method: "post",
  path: "/catalog/products/{id}/variants",
  tags: ["Catalog"],
  summary: "Add variant to product (Admin only)",
  security: [{ BearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: createVariantSchema } } } },
  responses: {
    201: {
      description: "Variant created",
      content: { "application/json": { schema: z.object({ success: z.literal(true), data: variantResponseSchema }) } },
    },
    404: { description: "Product not found" },
  },
});

registry.registerPath({
  method: "get",
  path: "/catalog/price-lists",
  tags: ["Catalog"],
  summary: "List all price lists",
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "List of price lists",
      content: { "application/json": { schema: z.object({ success: z.literal(true), data: z.array(priceListResponseSchema) }) } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/catalog/price-lists",
  tags: ["Catalog"],
  summary: "Create price list (Admin only)",
  security: [{ BearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: createPriceListSchema } } } },
  responses: {
    201: {
      description: "Price list created",
      content: { "application/json": { schema: z.object({ success: z.literal(true), data: priceListResponseSchema }) } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/catalog/price-lists/{id}/items",
  tags: ["Catalog"],
  summary: "Add price list item (Admin only)",
  security: [{ BearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: addPriceListItemSchema } } } },
  responses: {
    201: {
      description: "Item added to price list",
      content: { "application/json": { schema: z.object({ success: z.literal(true), data: priceListItemResponseSchema }) } },
    },
  },
});
