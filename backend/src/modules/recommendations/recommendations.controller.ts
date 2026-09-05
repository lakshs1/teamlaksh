import type { Request, Response, NextFunction } from "express";
import {
  getSuggestionsForQuote,
  listRules,
  createRule,
  deleteRule,
} from "./recommendations.service.js";
import { createUpsellRuleSchema } from "./recommendations.schemas.js";
import { ApiError } from "../../lib/api-error.js";

export async function getSuggestionsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const quoteId = Number(req.params.quoteId);
    if (isNaN(quoteId)) throw ApiError.badRequest("Invalid quote ID");
    const data = await getSuggestionsForQuote(quoteId);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function listRulesHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await listRules();
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function createRuleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createUpsellRuleSchema.parse(req.body);
    const data = await createRule(body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function deleteRuleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) throw ApiError.badRequest("Invalid rule ID");
    const result = await deleteRule(id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
