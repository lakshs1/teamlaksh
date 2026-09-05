import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import {
  listSubscriptionsHandler,
  getSubscriptionByIdHandler,
  updateSubscriptionHandler,
  cancelSubscriptionHandler,
  listInvoicesHandler,
  getInvoiceByIdHandler,
  payInvoiceHandler,
} from "./billing.controller.js";
import { updateSubscriptionSchema } from "./billing.schemas.js";

const router = Router();

// ── Subscriptions ─────────────────────────────────────────
router.get("/subscriptions", authenticate, listSubscriptionsHandler);
router.get("/subscriptions/:id", authenticate, getSubscriptionByIdHandler);
router.patch(
  "/subscriptions/:id",
  authenticate,
  authorize("finance", "admin"),
  validate({ body: updateSubscriptionSchema }),
  updateSubscriptionHandler
);
router.post(
  "/subscriptions/:id/cancel",
  authenticate,
  authorize("finance", "admin"),
  cancelSubscriptionHandler
);

// ── Invoices ──────────────────────────────────────────────
router.get("/invoices", authenticate, listInvoicesHandler);
router.get("/invoices/:id", authenticate, getInvoiceByIdHandler);
router.post("/invoices/:id/pay", authenticate, authorize("finance", "admin"), payInvoiceHandler);

export default router;
