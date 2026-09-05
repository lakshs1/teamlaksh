import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.middleware.js";
import {
  getPendingApprovalsHandler,
  getApprovalLogsHandler,
  approveQuoteHandler,
  rejectQuoteHandler,
  reviseQuoteHandler,
} from "./approvals.controller.js";

const router = Router();

// ── Approval Queue ────────────────────────────────────────
router.get("/pending", authenticate, authorize("manager", "finance", "admin", "rep"), getPendingApprovalsHandler);

// ── Audit Trail ───────────────────────────────────────────
router.get("/quotes/:quoteId/logs", authenticate, getApprovalLogsHandler);

// ── Actions ───────────────────────────────────────────────
router.post("/quotes/:quoteId/approve", authenticate, authorize("manager", "finance", "admin"), approveQuoteHandler);
router.post("/quotes/:quoteId/reject", authenticate, authorize("manager", "finance", "admin"), rejectQuoteHandler);
router.post("/quotes/:quoteId/revise", authenticate, authorize("manager", "finance", "admin"), reviseQuoteHandler);

export default router;
