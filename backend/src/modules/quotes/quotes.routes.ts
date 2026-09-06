import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.middleware.js";
import {
  listQuotesHandler,
  createQuoteHandler,
  getQuoteByIdHandler,
  updateQuoteHandler,
  addLineHandler,
  updateLineHandler,
  deleteLineHandler,
  submitQuoteHandler,
  confirmQuoteHandler,
  acceptCounterHandler,
} from "./quotes.controller.js";

const router = Router();
const allStaffRoles = ["rep", "admin", "manager", "finance_operations", "finance", "operations"] as const;

// ── Quote CRUD ────────────────────────────────────────────
router.get("/", authenticate, listQuotesHandler);
router.post("/", authenticate, authorize(...allStaffRoles), createQuoteHandler);
router.get("/:id", authenticate, getQuoteByIdHandler);
router.patch("/:id", authenticate, authorize(...allStaffRoles), updateQuoteHandler);

// ── Line Management ───────────────────────────────────────
router.post("/:id/lines", authenticate, authorize(...allStaffRoles), addLineHandler);
router.patch("/:id/lines/:lineId", authenticate, authorize(...allStaffRoles), updateLineHandler);
router.delete("/:id/lines/:lineId", authenticate, authorize(...allStaffRoles), deleteLineHandler);

// ── State Machine Actions ─────────────────────────────────
router.post("/:id/submit", authenticate, authorize(...allStaffRoles), submitQuoteHandler);
router.post("/:id/confirm", authenticate, authorize(...allStaffRoles), confirmQuoteHandler);
router.post("/:id/accept-counter", authenticate, authorize(...allStaffRoles), acceptCounterHandler);

export default router;
