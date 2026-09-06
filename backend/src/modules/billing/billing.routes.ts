import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import {
  listSubscriptionsHandler,
  getSubscriptionByIdHandler,
  updateSubscriptionHandler,
  cancelSubscriptionHandler,
  listSubscriptionPlansHandler,
  getSubscriptionPlanByIdHandler,
  createSubscriptionPlanHandler,
  updateSubscriptionPlanHandler,
  deleteSubscriptionPlanHandler,
  listInvoicesHandler,
  getInvoiceByIdHandler,
  payInvoiceHandler,
  createCreditNoteHandler,
  createInvoiceHandler,
} from "./billing.controller.js";
import {
  updateSubscriptionSchema,
  createSubscriptionPlanSchema,
  updateSubscriptionPlanSchema,
} from "./billing.schemas.js";

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

// ── Subscription Plans (PRD Section A5) ───────────────────
router.get("/plans", authenticate, listSubscriptionPlansHandler);
router.post(
  "/plans",
  authenticate,
  authorize("admin", "manager", "finance", "operations", "finance_operations"),
  validate({ body: createSubscriptionPlanSchema }),
  createSubscriptionPlanHandler
);
router.get("/plans/:id", authenticate, getSubscriptionPlanByIdHandler);
router.patch(
  "/plans/:id",
  authenticate,
  authorize("admin", "manager", "finance", "operations", "finance_operations"),
  validate({ body: updateSubscriptionPlanSchema }),
  updateSubscriptionPlanHandler
);
router.delete(
  "/plans/:id",
  authenticate,
  authorize("admin", "manager", "finance", "operations", "finance_operations"),
  deleteSubscriptionPlanHandler
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

