import type { Request, Response, NextFunction } from "express";
import {
  listSubscriptions,
  getSubscriptionById,
  createSubscription,
  updateSubscription,
  cancelSubscription,
  listSubscriptionPlans,
  getSubscriptionPlanById,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  listInvoices,
  getInvoiceById,
  markInvoicePaid,
  createCreditNote,
  createInvoice,
} from "./billing.service.js";

import {
  subscriptionQuerySchema,
  createSubscriptionSchema,
  updateSubscriptionSchema,
  createSubscriptionPlanSchema,
  updateSubscriptionPlanSchema,
  invoiceQuerySchema,
} from "./billing.schemas.js";
import { ApiError } from "../../lib/api-error.js";

export async function listSubscriptionsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const query = subscriptionQuerySchema.parse(req.query);
    const data = await listSubscriptions(query);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function createSubscriptionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createSubscriptionSchema.parse(req.body);
    const data = await createSubscription(body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getSubscriptionByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) throw ApiError.badRequest("Invalid subscription ID");
    const data = await getSubscriptionById(id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateSubscriptionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) throw ApiError.badRequest("Invalid subscription ID");
    const body = updateSubscriptionSchema.parse(req.body);
    const data = await updateSubscription(id, body);
    res.status(200).json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
}

export async function cancelSubscriptionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) throw ApiError.badRequest("Invalid subscription ID");
    const data = await cancelSubscription(id, req.body);
    res.status(200).json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
}

export async function listInvoicesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const query = invoiceQuerySchema.parse(req.query);
    const { items, pagination } = await listInvoices(query);
    res.status(200).json({ success: true, data: items, pagination });
  } catch (err) {
    next(err);
  }
}

export async function getInvoiceByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) throw ApiError.badRequest("Invalid invoice ID");
    const data = await getInvoiceById(id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function payInvoiceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) throw ApiError.badRequest("Invalid invoice ID");
    const data = await markInvoicePaid(id);
    res.status(200).json({ success: true, data, message: "Invoice marked as paid" });
  } catch (err) {
    next(err);
  }
}

export async function createCreditNoteHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id ? Number(req.params.id) : undefined;
    const { amount, reason, notes, customer_id, quote_id } = req.body;
    if (!amount || amount <= 0) throw ApiError.badRequest("Valid positive amount required");
    const result = await createCreditNote({
      invoice_id: id,
      customer_id,
      quote_id,
      amount: Number(amount),
      reason: reason || "Adjustment / SLA Credit",
      notes,
    });
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function createInvoiceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { customer_id, quote_id, subtotal, tax, total, type, due_date } = req.body;
    if (!customer_id) throw ApiError.badRequest("Customer ID required");
    if (!subtotal || subtotal <= 0) throw ApiError.badRequest("Valid subtotal required");
    const data = await createInvoice({
      customer_id: Number(customer_id),
      quote_id: quote_id ? Number(quote_id) : undefined,
      subtotal: Number(subtotal),
      tax: tax ? Number(tax) : undefined,
      total: total ? Number(total) : undefined,
      type: type || "one_time",
      due_date: due_date ? new Date(due_date) : undefined,
    });
    res.status(201).json({ success: true, data, message: "Invoice created successfully" });
  } catch (err) {
    next(err);
  }
}

// ── Subscription Plans Handlers ───────────────────────────

export async function listSubscriptionPlansHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await listSubscriptionPlans();
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getSubscriptionPlanByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) throw ApiError.badRequest("Invalid plan ID");
    const data = await getSubscriptionPlanById(id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function createSubscriptionPlanHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createSubscriptionPlanSchema.parse(req.body);
    const data = await createSubscriptionPlan(body);
    res.status(201).json({ success: true, data, message: "Subscription plan created successfully" });
  } catch (err) {
    next(err);
  }
}

export async function updateSubscriptionPlanHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) throw ApiError.badRequest("Invalid plan ID");
    const body = updateSubscriptionPlanSchema.parse(req.body);
    const data = await updateSubscriptionPlan(id, body);
    res.status(200).json({ success: true, data, message: "Subscription plan updated successfully" });
  } catch (err) {
    next(err);
  }
}

export async function deleteSubscriptionPlanHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) throw ApiError.badRequest("Invalid plan ID");
    const data = await deleteSubscriptionPlan(id);
    res.status(200).json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
}

