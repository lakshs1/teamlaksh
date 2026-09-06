import type { Request, Response, NextFunction } from "express";
import {
  calculateWarehouseSplit,
  acceptWarehouseSplit,
  overrideWarehouseSplit,
  listWarehouses,
  createWarehouse,
  updateWarehouse,
  getWarehouseStock,
  updateWarehouseStock,
  replenishWarehouseStock,
  simulateProductAllocation,
  checkBackordersRestock,
  consolidateBackorders,
  simulateInboundRestock,
} from "./fulfillment.service.js";
import {
  createWarehouseSchema,
  updateWarehouseSchema,
  updateStockSchema,
  replenishStockSchema,
  manualSplitOverrideSchema,
  simulateAllocationSchema,
} from "./fulfillment.schemas.js";
import { ApiError } from "../../lib/api-error.js";

export async function getWarehouseSplitHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const quoteId = Number(req.params.quoteId);
    if (isNaN(quoteId)) throw ApiError.badRequest("Invalid quote ID");
    const data = await calculateWarehouseSplit(quoteId);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function acceptWarehouseSplitHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const quoteId = Number(req.params.quoteId);
    if (isNaN(quoteId)) throw ApiError.badRequest("Invalid quote ID");
    const userId = (req as any).user?.id;
    if (!userId) throw ApiError.unauthorized("Authentication required");
    const data = await acceptWarehouseSplit(quoteId, userId);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function overrideWarehouseSplitHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const quoteId = Number(req.params.quoteId);
    if (isNaN(quoteId)) throw ApiError.badRequest("Invalid quote ID");
    const userId = (req as any).user?.id;
    if (!userId) throw ApiError.unauthorized("Authentication required");
    const body = manualSplitOverrideSchema.parse(req.body);
    const data = await overrideWarehouseSplit(quoteId, body.splits, userId);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function listWarehousesHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await listWarehouses();
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function createWarehouseHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createWarehouseSchema.parse(req.body);
    const data = await createWarehouse(body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateWarehouseHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const warehouseId = Number(req.params.id);
    if (isNaN(warehouseId)) throw ApiError.badRequest("Invalid warehouse ID");
    const body = updateWarehouseSchema.parse(req.body);
    const data = await updateWarehouse(warehouseId, body);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getWarehouseStockHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const warehouseId = Number(req.params.id);
    if (isNaN(warehouseId)) throw ApiError.badRequest("Invalid warehouse ID");
    const data = await getWarehouseStock(warehouseId);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateWarehouseStockHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const warehouseId = Number(req.params.id);
    if (isNaN(warehouseId)) throw ApiError.badRequest("Invalid warehouse ID");
    const userId = (req as any).user?.id;
    const body = updateStockSchema.parse(req.body);
    const data = await updateWarehouseStock(warehouseId, body, userId);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function replenishWarehouseStockHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const warehouseId = Number(req.params.id);
    if (isNaN(warehouseId)) throw ApiError.badRequest("Invalid warehouse ID");
    const userId = (req as any).user?.id;
    const body = replenishStockSchema.parse(req.body);
    const data = await replenishWarehouseStock(warehouseId, body, userId);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function simulateProductAllocationHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const body = simulateAllocationSchema.parse(req.body);
    const data = await simulateProductAllocation(body.product_id, body.quantity);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function checkBackordersRestockHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const quoteId = Number(req.params.quoteId);
    if (isNaN(quoteId)) throw ApiError.badRequest("Invalid quote ID");
    const data = await checkBackordersRestock(quoteId);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function consolidateBackordersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const quoteId = Number(req.params.quoteId);
    if (isNaN(quoteId)) throw ApiError.badRequest("Invalid quote ID");
    const userId = (req as any).user?.id || 1;
    const data = await consolidateBackorders(quoteId, userId);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function simulateInboundRestockHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const quoteId = Number(req.params.quoteId);
    if (isNaN(quoteId)) throw ApiError.badRequest("Invalid quote ID");
    const userId = (req as any).user?.id || 1;
    const data = await simulateInboundRestock(quoteId, userId);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
