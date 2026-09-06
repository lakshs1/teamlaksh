import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.middleware.js";
import {
  listApprovalsHandler,
  getPendingApprovalsHandler,
  getApprovalLogsHandler,
  approveQuoteHandler,
  rejectQuoteHandler,
  reviseQuoteHandler,
} from "./approvals.controller.js";

const router = Router();

// ── Approval Governance Queue ─────────────────────────────
router.get("/", authenticate, authorize("manager", "finance", "operations", "finance_operations", "admin"), listApprovalsHandler);
router.get("/pending", authenticate, authorize("manager", "finance", "operations", "finance_operations", "admin"), getPendingApprovalsHandler);

// ── Audit Trail ───────────────────────────────────────────
router.get("/quotes/:quoteId/logs", authenticate, getApprovalLogsHandler);

// ── Actions ───────────────────────────────────────────────
router.post("/quotes/:quoteId/approve", authenticate, authorize("manager", "finance", "operations", "finance_operations", "admin"), approveQuoteHandler);
router.post("/quotes/:quoteId/reject", authenticate, authorize("manager", "finance", "operations", "finance_operations", "admin"), rejectQuoteHandler);
router.post("/quotes/:quoteId/revise", authenticate, authorize("manager", "finance", "operations", "finance_operations", "admin"), reviseQuoteHandler);

export default router;
