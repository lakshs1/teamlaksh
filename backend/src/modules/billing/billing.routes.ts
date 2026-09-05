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
  createCreditNoteHandler,
  createInvoiceHandler,
} from "./billing.controller.js";
import { updateSubscriptionSchema } from "./billing.schemas.js";

const router = Router();

// ── Subscriptions ─────────────────────────────────────────
router.get("/subscriptions", authenticate, listSubscriptionsHandler);
router.get("/subscriptions/:id", authenticate, getSubscriptionByIdHandler);
router.patch(
  "/subscriptions/:id",
  authenticate,
  authorize("finance", "operations", "finance_operations", "admin"),
  validate({ body: updateSubscriptionSchema }),
  updateSubscriptionHandler
);
router.post(
  "/subscriptions/:id/cancel",
  authenticate,
  authorize("finance", "operations", "finance_operations", "admin"),
  cancelSubscriptionHandler
);

// ── Invoices & Credit Notes ──────────────────────────────
router.get("/invoices", authenticate, listInvoicesHandler);
router.post(
  "/invoices",
  authenticate,
  authorize("finance", "operations", "finance_operations", "admin", "rep"),
  createInvoiceHandler
);
router.get("/invoices/:id", authenticate, getInvoiceByIdHandler);
router.post(
  "/invoices/:id/pay",
  authenticate,
  authorize("finance", "operations", "finance_operations", "admin"),
  payInvoiceHandler
);
router.post(
  "/invoices/:id/credit-note",
  authenticate,
  authorize("finance", "operations", "finance_operations", "admin"),
  createCreditNoteHandler
);
router.post(
  "/credit-notes",
  authenticate,
  authorize("finance", "operations", "finance_operations", "admin"),
  createCreditNoteHandler
);

export default router;

