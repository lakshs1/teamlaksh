import { Router } from "express";
import { z } from "zod";
import * as customersController from "./customers.controller.js";
import { validate } from "../../middleware/validate.middleware.js";
import { authenticate, authorize } from "../../middleware/auth.middleware.js";
import {
  createTierSchema,
  createCustomerSchema,
  updateCustomerSchema,
  customerQuerySchema,
} from "./customers.schemas.js";

const router = Router();

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// ── Customer Tiers ──────────────────────────────────────────
router.get("/tiers", authenticate, customersController.getTiers);
router.post(
  "/tiers",
  authenticate,
  authorize("admin"),
  validate({ body: createTierSchema }),
  customersController.createTier
);

// ── Customers ───────────────────────────────────────────────
router.get(
  "/",
  authenticate,
  validate({ query: customerQuerySchema }),
  customersController.listCustomers
);

router.post(
  "/",
  authenticate,
  validate({ body: createCustomerSchema }),
  customersController.createCustomer
);

router.get(
  "/:id",
  authenticate,
  validate({ params: idParamSchema }),
  customersController.getCustomerById
);

router.patch(
  "/:id",
  authenticate,
  validate({ params: idParamSchema, body: updateCustomerSchema }),
  customersController.updateCustomer
);

export default router;
