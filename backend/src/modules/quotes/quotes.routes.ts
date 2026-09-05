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
} from "./quotes.controller.js";

const router = Router();

const ALL_INTERNAL_ROLES = ["rep", "admin", "manager", "finance", "operations", "finance_operations"];

// ── Quote CRUD ────────────────────────────────────────────
router.get("/", authenticate, listQuotesHandler);
router.post("/", authenticate, authorize(...ALL_INTERNAL_ROLES), createQuoteHandler);
router.get("/:id", authenticate, getQuoteByIdHandler);
router.patch("/:id", authenticate, authorize(...ALL_INTERNAL_ROLES), updateQuoteHandler);

// ── Line Management ───────────────────────────────────────
router.post("/:id/lines", authenticate, authorize(...ALL_INTERNAL_ROLES), addLineHandler);
router.patch("/:id/lines/:lineId", authenticate, authorize(...ALL_INTERNAL_ROLES), updateLineHandler);
router.delete("/:id/lines/:lineId", authenticate, authorize(...ALL_INTERNAL_ROLES), deleteLineHandler);

// ── State Machine Actions ─────────────────────────────────
router.post("/:id/submit", authenticate, authorize(...ALL_INTERNAL_ROLES), submitQuoteHandler);
router.post("/:id/confirm", authenticate, authorize(...ALL_INTERNAL_ROLES), confirmQuoteHandler);


export default router;
