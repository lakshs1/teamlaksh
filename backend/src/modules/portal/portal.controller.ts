import type { Request, Response, NextFunction } from "express";
import {
  getSanitizedQuote,
  addPortalComment,
  confirmPortalQuote,
} from "./portal.service.js";
import { portalCommentInputSchema } from "./portal.schemas.js";

export async function getSanitizedQuoteHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.params.token as string;
    const data = await getSanitizedQuote(token);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function addPortalCommentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.params.token as string;
    const body = portalCommentInputSchema.parse(req.body);
    const data = await addPortalComment(token, body);
    res.status(201).json({ success: true, data, message: "Comment submitted successfully" });
  } catch (err) {
    next(err);
  }
}

export async function confirmPortalQuoteHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.params.token as string;
    const data = await confirmPortalQuote(token);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
