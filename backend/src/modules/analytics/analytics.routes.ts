import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import {
  getDealHealthHandler,
  listAlertsHandler,
  resolveAlertHandler,
  escalateAlertHandler,
  getSalesReportHandler,
} from "./analytics.controller.js";
import {
  dealHealthQuerySchema,
  alertsQuerySchema,
  escalateAlertSchema,
  salesReportQuerySchema,
} from "./analytics.schemas.js";

const router = Router();

// ── Deal Health & Overview ────────────────────────────────
router.get(
  "/deal-health",
  authenticate,
  authorize("rep", "manager", "admin", "finance", "operations"),
  validate({ query: dealHealthQuerySchema }),
  getDealHealthHandler
);

// ── Deal Alerts ───────────────────────────────────────────
router.get(
  "/alerts",
  authenticate,
  authorize("rep", "manager", "admin", "finance", "operations"),
  validate({ query: alertsQuerySchema }),
  listAlertsHandler
);

router.post(
  "/alerts/:id/resolve",
  authenticate,
  authorize("rep", "manager", "admin"),
  resolveAlertHandler
);

router.post(
  "/alerts/:id/escalate",
  authenticate,
  authorize("rep", "manager", "admin"),
  validate({ body: escalateAlertSchema }),
  escalateAlertHandler
);

// ── Sales & Margins Analytics Report ──────────────────────
router.get(
  "/reports/sales",
  authenticate,
  authorize("rep", "manager", "admin", "finance", "operations"),
  validate({ query: salesReportQuerySchema }),
  getSalesReportHandler
);

export default router;
