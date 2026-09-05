import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { registry } from "../../config/swagger.js";

extendZodWithOpenApi(z);

// ═══════════════════════════════════════════════════════════
// PORTAL COMMENTS SCHEMAS
// ═══════════════════════════════════════════════════════════

export const portalCommentInputSchema = z
  .object({
    quote_line_id: z.coerce.number().int().positive().optional().openapi({ example: 101, description: "Optional line item reference" }),
    message: z.string().min(1, "Message cannot be empty").max(2000).openapi({ example: "Can we get a 15% discount on the server rack?" }),
    counter_discount_pct: z.coerce
      .number()
      .min(0, "Discount cannot be negative")
      .max(100, "Discount cannot exceed 100%")
      .optional()
      .openapi({ example: 15.0, description: "Customer proposed counter discount" }),
    author_type: z.string().optional().openapi({ example: "customer" }),
    author_name: z.string().optional().openapi({ example: "Odoo Evaluators Inc" }),
  })
  .openapi("PortalCommentRequest");

export const portalCommentResponseSchema = z
  .object({
    id: z.number().int(),
    quote_id: z.number().int(),
    quote_line_id: z.number().int().nullable().optional(),
    author_type: z.string().openapi({ example: "customer" }),
    author_name: z.string().openapi({ example: "Acme Procurement" }),
    message: z.string(),
    counter_discount_pct: z.number().nullable().optional(),
    created_at: z.coerce.date(),
  })
  .openapi("PortalCommentResponse");

// ═══════════════════════════════════════════════════════════
// SANITIZED PORTAL QUOTE VIEW SCHEMAS (No Cost/Margin Leaks)
// ═══════════════════════════════════════════════════════════

export const sanitizedQuoteLineSchema = z
  .object({
    id: z.number().int(),
    product_name: z.string().openapi({ example: "Enterprise Server Rack X1" }),
    variant_name: z.string().nullable().optional().openapi({ example: "Dual PSU" }),
    quantity: z.number().int().openapi({ example: 2 }),
    unit_price: z.number().openapi({ example: 2800.0 }),
    discount_pct: z.number().openapi({ example: 10.0 }),
    discount_amount: z.number().openapi({ example: 560.0 }),
    line_total: z.number().openapi({ example: 5040.0 }),
    is_recurring: z.boolean().openapi({ example: false }),
  })
  .openapi("SanitizedQuoteLine");

export const sanitizedQuoteResponseSchema = z
  .object({
    quote_number: z.string().openapi({ example: "QT-2026-0042" }),
    customer_name: z.string().openapi({ example: "Acme Corp" }),
    status: z.string().openapi({ example: "draft" }),
    subtotal: z.number().openapi({ example: 5000.0 }),
    total_discount: z.number().openapi({ example: 500.0 }),
    total_tax: z.number().openapi({ example: 382.5 }),
    grand_total: z.number().openapi({ example: 4882.5 }),
    discount_pct: z.number().optional().openapi({ example: 10.0 }),
    expires_at: z.coerce.date().nullable().optional(),
    lines: z.array(sanitizedQuoteLineSchema),
    comments: z.array(portalCommentResponseSchema),
    customer_quotes: z.array(z.any()).optional(),
  })
  .openapi("SanitizedQuoteResponse");

export const portalConfirmResponseSchema = z
  .object({
    status: z.string().openapi({ example: "confirmed" }),
    approval_route: z.string().nullable().optional(),
    message: z.string().openapi({ example: "Thank you! Your quotation has been confirmed and submitted for processing." }),
  })
  .openapi("PortalConfirmResponse");

// ═══════════════════════════════════════════════════════════
// OPENAPI PATH REGISTRATIONS (Public Magic Link)
// ═══════════════════════════════════════════════════════════

registry.registerPath({
  method: "get",
  path: "/portal/quotes/{token}",
  tags: ["Customer Portal"],
  summary: "Public Magic Link: View sanitized quotation (No internal margins or costs)",
  parameters: [
    {
      name: "token",
      in: "path",
      required: true,
      schema: { type: "string" },
      description: "Quotation magic link UUID token",
    },
  ],
  responses: {
    200: {
      description: "Sanitized quote details with lines and negotiation comments",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: sanitizedQuoteResponseSchema,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/portal/quotes/{token}/comments",
  tags: ["Customer Portal"],
  summary: "Post a customer comment or propose a counter-discount",
  parameters: [
    {
      name: "token",
      in: "path",
      required: true,
      schema: { type: "string" },
      description: "Quotation magic link UUID token",
    },
  ],
  request: {
    body: {
      content: { "application/json": { schema: portalCommentInputSchema } },
    },
  },
  responses: {
    201: {
      description: "Comment or counter-discount posted successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: portalCommentResponseSchema,
            message: z.string(),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/portal/quotes/{token}/confirm",
  tags: ["Customer Portal"],
  summary: "Customer confirms and accepts quotation terms",
  parameters: [
    {
      name: "token",
      in: "path",
      required: true,
      schema: { type: "string" },
      description: "Quotation magic link UUID token",
    },
  ],
  responses: {
    200: {
      description: "Quotation confirmed or routed to approval if counter-discount exceeds threshold",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: portalConfirmResponseSchema,
          }),
        },
      },
    },
  },
});
