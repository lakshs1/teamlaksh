import type { Request, Response, NextFunction } from "express";
import {
  listQuotes,
  getQuoteById,
  createQuote,
  updateQuote,
  addLine,
  updateLine,
  deleteLine,
  submitQuote,
  confirmQuote,
  acceptCounterOffer,
} from "./quotes.service.js";
import {
  createQuoteSchema,
  updateQuoteSchema,
  quoteQuerySchema,
  addLineSchema,
  updateLineSchema,
} from "./quotes.schemas.js";
import { ApiError } from "../../lib/api-error.js";

export async function listQuotesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const query = quoteQuerySchema.parse(req.query);
    const { items, pagination } = await listQuotes(query);
    res.status(200).json({ success: true, data: items, pagination });
  } catch (err) {
    next(err);
  }
}

export async function createQuoteHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const repId = (req as any).user?.id;
    if (!repId) throw ApiError.unauthorized("Not authenticated");
    const data = createQuoteSchema.parse(req.body);
    const quote = await createQuote(repId, data);
    res.status(201).json({ success: true, data: quote });
  } catch (err) {
    next(err);
  }
}

export async function getQuoteByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) throw ApiError.badRequest("Invalid quote ID");
    const quote = await getQuoteById(id);
    res.status(200).json({ success: true, data: quote });
  } catch (err) {
    next(err);
  }
}

export async function updateQuoteHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) throw ApiError.badRequest("Invalid quote ID");
    const repId = (req as any).user?.id;
    const data = updateQuoteSchema.parse(req.body);
    const quote = await updateQuote(id, repId, data);
    res.status(200).json({ success: true, data: quote });
  } catch (err) {
    next(err);
  }
}

export async function addLineHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const quoteId = Number(req.params.id);
    if (isNaN(quoteId)) throw ApiError.badRequest("Invalid quote ID");
    const repId = (req as any).user?.id;
    const data = addLineSchema.parse(req.body);
    const line = await addLine(quoteId, repId, data);
    res.status(201).json({ success: true, data: line });
  } catch (err) {
    next(err);
  }
}

export async function updateLineHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const quoteId = Number(req.params.id);
    const lineId = Number(req.params.lineId);
    if (isNaN(quoteId) || isNaN(lineId)) throw ApiError.badRequest("Invalid ID");
    const repId = (req as any).user?.id;
    const data = updateLineSchema.parse(req.body);
    const line = await updateLine(quoteId, lineId, repId, data);
    res.status(200).json({ success: true, data: line });
  } catch (err) {
    next(err);
  }
}

export async function deleteLineHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const quoteId = Number(req.params.id);
    const lineId = Number(req.params.lineId);
    if (isNaN(quoteId) || isNaN(lineId)) throw ApiError.badRequest("Invalid ID");
    const repId = (req as any).user?.id;
    const result = await deleteLine(quoteId, lineId, repId);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function submitQuoteHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const quoteId = Number(req.params.id);
    if (isNaN(quoteId)) throw ApiError.badRequest("Invalid quote ID");
    const repId = (req as any).user?.id;
    const result = await submitQuote(quoteId, repId);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function confirmQuoteHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const quoteId = Number(req.params.id);
    if (isNaN(quoteId)) throw ApiError.badRequest("Invalid quote ID");
    const repId = (req as any).user?.id;
    const quote = await confirmQuote(quoteId, repId);
    res.status(200).json({ success: true, data: quote });
  } catch (err) {
    next(err);
  }
}

export async function acceptCounterHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const quoteId = Number(req.params.id);
    if (isNaN(quoteId)) throw ApiError.badRequest("Invalid quote ID");
    const user = (req as any).user;
    const result = await acceptCounterOffer(quoteId, user, req.body);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

