import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import {
  getSuggestionsHandler,
  listRulesHandler,
  createRuleHandler,
  deleteRuleHandler,
} from "./recommendations.controller.js";
import { createUpsellRuleSchema } from "./recommendations.schemas.js";

const router = Router();

// ── Quote Suggestions (Rep / Staff) ──────────────────────
router.get("/quotes/:quoteId/suggestions", authenticate, getSuggestionsHandler);

// ── Upsell Rules Management (Admin / Manager) ────────────
router.get("/rules", authenticate, authorize("admin", "manager"), listRulesHandler);
router.post(
  "/rules",
  authenticate,
  authorize("admin"),
  validate({ body: createUpsellRuleSchema }),
  createRuleHandler
);
router.delete("/rules/:id", authenticate, authorize("admin"), deleteRuleHandler);

export default router;
