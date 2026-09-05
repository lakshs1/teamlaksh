import type { Request, Response, NextFunction } from "express";
import {
  listSubscriptions,
  getSubscriptionById,
  updateSubscription,
  cancelSubscription,
  listInvoices,
  getInvoiceById,
  markInvoicePaid,
} from "./billing.service.js";
import {
  subscriptionQuerySchema,
  updateSubscriptionSchema,
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
    const data = await cancelSubscription(id);
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
