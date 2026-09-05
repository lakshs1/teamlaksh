import { Router } from "express";
import { z } from "zod";
import * as discountRulesController from "./discount-rules.controller.js";
import { validate } from "../../middleware/validate.middleware.js";
import { authenticate, authorize } from "../../middleware/auth.middleware.js";
import {
  createDiscountRuleSchema,
  updateDiscountRuleSchema,
  discountRuleQuerySchema,
  checkDiscountQuerySchema,
} from "./discount-rules.schemas.js";

const router = Router();

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// ── Policy Evaluation ───────────────────────────────────────
router.get(
  "/evaluate",
  authenticate,
  validate({ query: checkDiscountQuerySchema }),
  discountRulesController.evaluatePolicy
);

// ── Discount Rules CRUD ─────────────────────────────────────
router.get(
  "/",
  authenticate,
  validate({ query: discountRuleQuerySchema }),
  discountRulesController.getDiscountRules
);

router.post(
  "/",
  authenticate,
  authorize("admin"),
  validate({ body: createDiscountRuleSchema }),
  discountRulesController.createDiscountRule
);

router.patch(
  "/:id",
  authenticate,
  authorize("admin"),
  validate({ params: idParamSchema, body: updateDiscountRuleSchema }),
  discountRulesController.updateDiscountRule
);

export default router;
