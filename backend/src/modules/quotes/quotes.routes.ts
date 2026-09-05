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

// ── Quote CRUD ────────────────────────────────────────────
router.get("/", authenticate, listQuotesHandler);
router.post("/", authenticate, authorize("rep", "admin", "manager"), createQuoteHandler);
router.post("/", authenticate, authorize("rep", "admin", "manager", "finance_operations", "finance", "operations"), createQuoteHandler);
router.get("/:id", authenticate, getQuoteByIdHandler);
router.patch("/:id", authenticate, authorize("rep", "admin", "manager"), updateQuoteHandler);
router.patch("/:id", authenticate, authorize("rep", "admin", "manager", "finance_operations", "finance", "operations"), updateQuoteHandler);

// ── Line Management ───────────────────────────────────────
router.post("/:id/lines", authenticate, authorize("rep", "admin", "manager"), addLineHandler);
router.patch("/:id/lines/:lineId", authenticate, authorize("rep", "admin", "manager"), updateLineHandler);
router.delete("/:id/lines/:lineId", authenticate, authorize("rep", "admin", "manager"), deleteLineHandler);
router.post("/:id/lines", authenticate, authorize("rep", "admin", "manager", "finance_operations", "finance", "operations"), addLineHandler);
router.patch("/:id/lines/:lineId", authenticate, authorize("rep", "admin", "manager", "finance_operations", "finance", "operations"), updateLineHandler);
router.delete("/:id/lines/:lineId", authenticate, authorize("rep", "admin", "manager", "finance_operations", "finance", "operations"), deleteLineHandler);

// ── State Machine Actions ─────────────────────────────────
router.post("/:id/submit", authenticate, authorize("rep", "admin", "manager"), submitQuoteHandler);
router.post("/:id/confirm", authenticate, authorize("rep", "admin", "manager"), confirmQuoteHandler);
router.post("/:id/submit", authenticate, authorize("rep", "admin", "manager", "finance_operations", "finance", "operations"), submitQuoteHandler);
router.post("/:id/confirm", authenticate, authorize("rep", "admin", "manager", "finance_operations", "finance", "operations"), confirmQuoteHandler);


export default router;
