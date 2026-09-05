import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import {
  getWarehouseSplitHandler,
  acceptWarehouseSplitHandler,
  overrideWarehouseSplitHandler,
  listWarehousesHandler,
  createWarehouseHandler,
  getWarehouseStockHandler,
  updateWarehouseStockHandler,
  checkBackordersRestockHandler,
  consolidateBackordersHandler,
  simulateInboundRestockHandler,
} from "./fulfillment.controller.js";
import {
  createWarehouseSchema,
  updateStockSchema,
  manualSplitOverrideSchema,
} from "./fulfillment.schemas.js";

const router = Router();

// ── Quote Warehouse Splitting & Fulfillment ───────────────
router.get("/quotes/:quoteId/split", authenticate, getWarehouseSplitHandler);
router.post(
  "/quotes/:quoteId/split/accept",
  authenticate,
  authorize("rep", "finance", "operations", "admin"),
  acceptWarehouseSplitHandler
);
router.post(
  "/quotes/:quoteId/split/override",
  authenticate,
  authorize("rep", "finance", "operations", "admin"),
  validate({ body: manualSplitOverrideSchema }),
  overrideWarehouseSplitHandler
);

// ── Backorder Consolidation Mid-Fulfillment (PRD B6) ──────
router.get(
  "/quotes/:quoteId/backorders/check-restock",
  authenticate,
  checkBackordersRestockHandler
);
router.post(
  "/quotes/:quoteId/backorders/consolidate",
  authenticate,
  authorize("rep", "finance", "operations", "admin"),
  consolidateBackordersHandler
);
router.post(
  "/quotes/:quoteId/backorders/simulate-restock",
  authenticate,
  simulateInboundRestockHandler
);

// ── Warehouses Management ─────────────────────────────────
router.get("/warehouses", authenticate, listWarehousesHandler);
router.post(
  "/warehouses",
  authenticate,
  authorize("admin", "operations"),
  validate({ body: createWarehouseSchema }),
  createWarehouseHandler
);

// ── Inventory & Stock Management ──────────────────────────
router.get("/warehouses/:id/stock", authenticate, getWarehouseStockHandler);
router.post(
  "/warehouses/:id/stock",
  authenticate,
  authorize("admin", "operations"),
  validate({ body: updateStockSchema }),
  updateWarehouseStockHandler
);

export default router;
