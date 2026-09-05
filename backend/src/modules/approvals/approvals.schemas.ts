import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { registry } from "../../config/swagger.js";

extendZodWithOpenApi(z);

// ═══════════════════════════════════════════════════════════
// APPROVAL ACTION SCHEMAS
// ═══════════════════════════════════════════════════════════

export const approveActionSchema = z
  .object({
    reason: z.string().max(1000).optional().openapi({ example: "Margins are acceptable" }),
  })
  .openapi("ApproveActionRequest");

export const rejectActionSchema = z
  .object({
    reason: z.string().min(1, "Reason is required when rejecting").max(1000).openapi({ example: "Discount exceeds policy limits" }),
  })
  .openapi("RejectActionRequest");

export const reviseActionSchema = z
  .object({
    reason: z
      .string()
      .min(1, "Reason is required when requesting revision")
      .max(1000)
      .openapi({ example: "Please reduce the discount on line 2" }),
  })
  .openapi("ReviseActionRequest");

// ═══════════════════════════════════════════════════════════
// RESPONSE SCHEMAS
// ═══════════════════════════════════════════════════════════

export const approvalLogSchema = z
  .object({
    id: z.number().int(),
    quoteId: z.number().int(),
    reviewerId: z.number().int(),
    action: z.string(),
    level: z.string(),
    reason: z.string().nullable(),
    createdAt: z.coerce.date(),
  })
  .openapi("ApprovalLog");

export const approvalResultSchema = z
  .object({
    quoteId: z.number().int(),
    previousStatus: z.string(),
    newStatus: z.string(),
    action: z.string(),
    level: z.string(),
    message: z.string(),
  })
  .openapi("ApprovalResult");

// ═══════════════════════════════════════════════════════════
// OPENAPI REGISTRATIONS
// ═══════════════════════════════════════════════════════════

registry.registerPath({
  method: "get",
  path: "/approvals/pending",
  tags: ["Approvals"],
  summary: "List quotes pending your approval (role-filtered)",
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "Pending quotes for manager or finance review",
      content: {
        "application/json": {
          schema: z.object({ success: z.literal(true), data: z.array(z.any()) }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/approvals/quotes/{quoteId}/logs",
  tags: ["Approvals"],
  summary: "Full audit trail for a quote",
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "Approval history",
      content: {
        "application/json": {
          schema: z.object({ success: z.literal(true), data: z.array(approvalLogSchema) }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/approvals/quotes/{quoteId}/approve",
  tags: ["Approvals"],
  summary: "Approve a pending quote (advances state)",
  security: [{ BearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: approveActionSchema } } } },
  responses: {
    200: {
      description: "Quote approved and state advanced",
      content: {
        "application/json": {
          schema: z.object({ success: z.literal(true), data: approvalResultSchema }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/approvals/quotes/{quoteId}/reject",
  tags: ["Approvals"],
  summary: "Reject a pending quote (terminal state: rejected)",
  security: [{ BearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: rejectActionSchema } } } },
  responses: {
    200: {
      description: "Quote rejected",
      content: {
        "application/json": {
          schema: z.object({ success: z.literal(true), data: approvalResultSchema }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/approvals/quotes/{quoteId}/revise",
  tags: ["Approvals"],
  summary: "Return quote for revision (status → draft)",
  security: [{ BearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: reviseActionSchema } } } },
  responses: {
    200: {
      description: "Quote returned to draft for revision",
      content: {
        "application/json": {
          schema: z.object({ success: z.literal(true), data: approvalResultSchema }),
        },
      },
    },
  },
});
