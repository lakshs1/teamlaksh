import { Router } from "express";
import { validate } from "../../middleware/validate.middleware.js";
import {
  getSanitizedQuoteHandler,
  addPortalCommentHandler,
  confirmPortalQuoteHandler,
} from "./portal.controller.js";
import { portalCommentInputSchema } from "./portal.schemas.js";

const router = Router();

// ── Customer Portal (Public Magic Link — No JWT required) ──
router.get("/quotes/:token", getSanitizedQuoteHandler);
router.post(
  "/quotes/:token/comments",
  validate({ body: portalCommentInputSchema }),
  addPortalCommentHandler
);
router.post("/quotes/:token/confirm", confirmPortalQuoteHandler);

export default router;
