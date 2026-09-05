import type { Request, Response, NextFunction } from "express";
import {
  getPendingApprovals,
  getApprovalLogs,
  approveQuote,
  rejectQuote,
  reviseQuote,
} from "./approvals.service.js";
import {
  approveActionSchema,
  rejectActionSchema,
  reviseActionSchema,
} from "./approvals.schemas.js";
import { ApiError } from "../../lib/api-error.js";

export async function getPendingApprovalsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    if (!user) throw ApiError.unauthorized("Not authenticated");
    const items = await getPendingApprovals(user);
    res.status(200).json({ success: true, data: items });
  } catch (err) {
    next(err);
  }
}

export async function getApprovalLogsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const quoteId = Number(req.params.quoteId);
    if (isNaN(quoteId)) throw ApiError.badRequest("Invalid quote ID");
    const logs = await getApprovalLogs(quoteId);
    res.status(200).json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
}

export async function approveQuoteHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const quoteId = Number(req.params.quoteId);
    if (isNaN(quoteId)) throw ApiError.badRequest("Invalid quote ID");
    const user = (req as any).user;
    if (!user) throw ApiError.unauthorized("Not authenticated");
    const data = approveActionSchema.parse(req.body);
    const result = await approveQuote(quoteId, user, data);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function rejectQuoteHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const quoteId = Number(req.params.quoteId);
    if (isNaN(quoteId)) throw ApiError.badRequest("Invalid quote ID");
    const user = (req as any).user;
    if (!user) throw ApiError.unauthorized("Not authenticated");
    const data = rejectActionSchema.parse(req.body);
    const result = await rejectQuote(quoteId, user, data);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function reviseQuoteHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const quoteId = Number(req.params.quoteId);
    if (isNaN(quoteId)) throw ApiError.badRequest("Invalid quote ID");
    const user = (req as any).user;
    if (!user) throw ApiError.unauthorized("Not authenticated");
    const data = reviseActionSchema.parse(req.body);
    const result = await reviseQuote(quoteId, user, data);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
