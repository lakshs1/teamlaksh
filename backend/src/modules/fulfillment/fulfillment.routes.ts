import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import {
  getWarehouseSplitHandler,
  acceptWarehouseSplitHandler,
  overrideWarehouseSplitHandler,
  listWarehousesHandler,
  createWarehouseHandler,
  updateWarehouseHandler,
  getWarehouseStockHandler,
  updateWarehouseStockHandler,
  replenishWarehouseStockHandler,
  checkBackordersRestockHandler,
  consolidateBackordersHandler,
  simulateInboundRestockHandler,
} from "./fulfillment.controller.js";
import {
  createWarehouseSchema,
  updateWarehouseSchema,
  updateStockSchema,
  replenishStockSchema,
  manualSplitOverrideSchema,
} from "./fulfillment.schemas.js";

const router = Router();

// ── Quote Warehouse Splitting & Fulfillment ───────────────
router.get("/quotes/:quoteId/split", authenticate, getWarehouseSplitHandler);
router.post(
  "/quotes/:quoteId/split/accept",
  authenticate,
  authorize("rep", "finance", "operations", "finance_operations", "admin"),
  acceptWarehouseSplitHandler
);
router.post(
  "/quotes/:quoteId/split/override",
  authenticate,
  authorize("rep", "finance", "operations", "finance_operations", "admin"),
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
  authorize("rep", "finance", "operations", "finance_operations", "admin"),
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
  authorize("admin", "operations", "finance", "finance_operations"),
  validate({ body: createWarehouseSchema }),
  createWarehouseHandler
);
router.patch(
  "/warehouses/:id",
  authenticate,
  authorize("admin", "operations", "finance", "finance_operations"),
  validate({ body: updateWarehouseSchema }),
  updateWarehouseHandler
);

// ── Inventory & Stock Management ──────────────────────────
router.get("/warehouses/:id/stock", authenticate, getWarehouseStockHandler);
router.post(
  "/warehouses/:id/stock",
  authenticate,
  authorize("admin", "operations", "finance", "finance_operations"),
  validate({ body: updateStockSchema }),
  updateWarehouseStockHandler
);
router.post(
  "/warehouses/:id/replenish",
  authenticate,
  authorize("admin", "operations", "finance", "finance_operations"),
  validate({ body: replenishStockSchema }),
  replenishWarehouseStockHandler
);

export default router;
