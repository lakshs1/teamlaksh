import { eq, and, inArray, sql, desc, asc } from "drizzle-orm";
import {
  db,
  quotes,
  quoteLines,
  products,
  warehouses,
  warehouseStock,
  fulfillmentSplits,
  backorders,
  stockMovements,
  approvalLogs,
} from "@db";
import { ApiError } from "../../lib/api-error.js";

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export interface SplitItem {
  quote_line_id: number;
  product_id: number;
  product_name: string;
  variant_id?: number | null;
  warehouse_id: number;
  warehouse_name: string;
  quantity: number;
  is_backordered: boolean;
}

export interface BackorderItem {
  quote_line_id: number;
  product_id: number;
  product_name: string;
  quantity_backordered: number;
}

export interface SplitRecommendationResult {
  quote_id: number;
  splits: SplitItem[];
  backordered: BackorderItem[];
  total_shipments: number;
  can_fulfill_completely: boolean;
}

export interface ManualSplitAllocation {
  quote_line_id: number;
  warehouse_id: number;
  quantity: number;
}

// ═══════════════════════════════════════════════════════════
// HELPER: PULL QUOTE OR THROW
// ═══════════════════════════════════════════════════════════

async function getQuoteOrThrow(quoteId: number) {
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, quoteId)).limit(1);
  if (!quote) throw ApiError.notFound(`Quote with ID ${quoteId} not found`);
  return quote;
}

// ═══════════════════════════════════════════════════════════
// ADR-004: GREEDY SINGLE-PASS WAREHOUSE SPLIT ALGORITHM
// ═══════════════════════════════════════════════════════════

/**
 * Computes optimal warehouse fulfillment splits using ADR-004 Greedy Algorithm.
 * Sorts warehouses by shipping_cost_weight (cheapest first) and available stock.
 * Excess unfulfilled quantities are flagged as backordered.
 */
export async function calculateWarehouseSplit(quoteId: number): Promise<SplitRecommendationResult> {
  const quote = await getQuoteOrThrow(quoteId);

  // Fetch quote lines
  const lines = await db.select().from(quoteLines).where(eq(quoteLines.quoteId, quoteId));
  if (lines.length === 0) {
    return {
      quote_id: quoteId,
      splits: [],
      backordered: [],
      total_shipments: 0,
      can_fulfill_completely: true,
    };
  }

  // Filter physical items (non-recurring)
  const physicalLines = lines.filter((l) => !l.isRecurring);
  if (physicalLines.length === 0) {
    return {
      quote_id: quoteId,
      splits: [],
      backordered: [],
      total_shipments: 0,
      can_fulfill_completely: true,
    };
  }

  // Fetch products
  const productIds = Array.from(new Set(physicalLines.map((l) => l.productId)));
  const productRows = await db.select().from(products).where(inArray(products.id, productIds));
  const productMap = new Map<number, (typeof productRows)[0]>();
  for (const p of productRows) {
    productMap.set(p.id, p);
  }

  // Fetch active warehouses ordered by shipping_cost_weight ASC (lowest cost first)
  const activeWarehouses = await db
    .select()
    .from(warehouses)
    .where(eq(warehouses.isActive, true))
    .orderBy(asc(warehouses.shippingCostWeight));

  const warehouseMap = new Map<number, (typeof activeWarehouses)[0]>();
  for (const wh of activeWarehouses) {
    warehouseMap.set(wh.id, wh);
  }

  // Fetch stock levels for relevant products
  const stockRows = await db
    .select()
    .from(warehouseStock)
    .where(inArray(warehouseStock.productId, productIds));

  // Mutable stock map to track simulated allocation: "warehouseId_productId_variantId" -> availableQty
  const stockAvailableMap = new Map<string, number>();
  for (const s of stockRows) {
    const key = `${s.warehouseId}_${s.productId}_${s.variantId ?? "null"}`;
    const available = Math.max(0, s.quantityOnHand - s.quantityReserved);
    stockAvailableMap.set(key, available);
  }

  const splits: SplitItem[] = [];
  const backordered: BackorderItem[] = [];

  for (const line of physicalLines) {
    let remainingQty = line.quantity;
    const prod = productMap.get(line.productId);
    const prodName = prod ? prod.name : `Product #${line.productId}`;

    for (const wh of activeWarehouses) {
      const stockKey = `${wh.id}_${line.productId}_${line.variantId ?? "null"}`;
      const available = stockAvailableMap.get(stockKey) || 0;

      if (available > 0) {
        const take = Math.min(remainingQty, available);
        splits.push({
          quote_line_id: line.id,
          product_id: line.productId,
          product_name: prodName,
          variant_id: line.variantId ?? null,
          warehouse_id: wh.id,
          warehouse_name: wh.name,
          quantity: take,
          is_backordered: false,
        });

        remainingQty -= take;
        stockAvailableMap.set(stockKey, available - take);

        if (remainingQty === 0) break;
      }
    }

    if (remainingQty > 0) {
      backordered.push({
        quote_line_id: line.id,
        product_id: line.productId,
        product_name: prodName,
        quantity_backordered: remainingQty,
      });
    }
  }

  const uniqueWarehouses = new Set(splits.map((s) => s.warehouse_id));
  const total_shipments = uniqueWarehouses.size;
  const can_fulfill_completely = backordered.length === 0;

  return {
    quote_id: quoteId,
    splits,
    backordered,
    total_shipments,
    can_fulfill_completely,
  };
}

// ═══════════════════════════════════════════════════════════
// ACCEPT SPLIT & COMMIT ALLOCATION
// ═══════════════════════════════════════════════════════════

export async function acceptWarehouseSplit(quoteId: number, userId: number) {
  const quote = await getQuoteOrThrow(quoteId);

  // Allow fulfillment for quotes in fulfillment or approved status
  const allowedStatuses = ["fulfillment", "approved", "confirmed"];
  if (!allowedStatuses.includes(quote.status)) {
    throw ApiError.badRequest(
      `Cannot accept fulfillment for quote with status '${quote.status}'. Must be in 'fulfillment' or 'approved' state.`
    );
  }

  const recommendation = await calculateWarehouseSplit(quoteId);

  // 1. Commit splits to fulfillment_splits table
  for (const split of recommendation.splits) {
    await db.insert(fulfillmentSplits).values({
      quoteId,
      quoteLineId: split.quote_line_id,
      warehouseId: split.warehouse_id,
      quantity: split.quantity,
      quantityAllocated: split.quantity,
      quantityFulfilled: 0,
      isBackordered: false,
      status: "allocated",
      allocatedBy: userId,
      notes: "Automated warehouse split accepted",
    });

    // Decrement physical stock on hand
    await db
      .update(warehouseStock)
      .set({
        quantity: sql`${warehouseStock.quantity} - ${split.quantity}`,
        quantityOnHand: sql`${warehouseStock.quantityOnHand} - ${split.quantity}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(warehouseStock.warehouseId, split.warehouse_id),
          eq(warehouseStock.productId, split.product_id)
        )
      );

    // Audit log stock movement
    await db.insert(stockMovements).values({
      warehouseId: split.warehouse_id,
      productId: split.product_id,
      variantId: split.variant_id ?? null,
      quantityChange: -split.quantity,
      movementType: "allocation",
      referenceId: quote.quoteNumber,
      performedBy: userId,
      notes: `Allocated for quote ${quote.quoteNumber}`,
    });
  }

  // 2. Commit any backorders
  for (const bo of recommendation.backordered) {
    await db.insert(backorders).values({
      quoteId,
      quoteLineId: bo.quote_line_id,
      productId: bo.product_id,
      quantityBackordered: bo.quantity_backordered,
      quantityRemaining: bo.quantity_backordered,
      status: "open",
    });
  }

  // 3. Log to approval logs
  await db.insert(approvalLogs).values({
    quoteId,
    reviewerId: userId,
    action: "fulfillment_allocated",
    level: "operations",
    reason: `Fulfillment split accepted: ${recommendation.splits.length} allocations, ${recommendation.backordered.length} backordered lines`,
  });

  return {
    ...recommendation,
    message: `Fulfillment accepted with ${recommendation.splits.length} allocations across ${recommendation.total_shipments} warehouse(s).`,
  };
}

// ═══════════════════════════════════════════════════════════
// MANUAL SPLIT OVERRIDE
// ═══════════════════════════════════════════════════════════

export async function overrideWarehouseSplit(
  quoteId: number,
  splits: ManualSplitAllocation[],
  userId: number
) {
  const quote = await getQuoteOrThrow(quoteId);

  const allowedStatuses = ["fulfillment", "approved", "confirmed"];
  if (!allowedStatuses.includes(quote.status)) {
    throw ApiError.badRequest(
      `Cannot apply fulfillment override for quote with status '${quote.status}'. Must be in 'fulfillment' or 'approved' state.`
    );
  }

  const lines = await db.select().from(quoteLines).where(eq(quoteLines.quoteId, quoteId));
  const lineMap = new Map(lines.map((l) => [l.id, l]));

  const committedSplits: any[] = [];
  const committedBackorders: any[] = [];

  // Group requested allocations by quote line ID
  const allocationsByLine = new Map<number, ManualSplitAllocation[]>();
  for (const s of splits) {
    const existing = allocationsByLine.get(s.quote_line_id) || [];
    existing.push(s);
    allocationsByLine.set(s.quote_line_id, existing);
  }

  for (const [lineId, requestedAllocations] of allocationsByLine.entries()) {
    const line = lineMap.get(lineId);
    if (!line) {
      throw ApiError.badRequest(`Quote line ${lineId} does not belong to quote ${quoteId}`);
    }

    let totalAllocatedForLine = 0;

    for (const alloc of requestedAllocations) {
      totalAllocatedForLine += alloc.quantity;

      const [record] = await db
        .insert(fulfillmentSplits)
        .values({
          quoteId,
          quoteLineId: alloc.quote_line_id,
          warehouseId: alloc.warehouse_id,
          quantity: alloc.quantity,
          quantityAllocated: alloc.quantity,
          quantityFulfilled: 0,
          isBackordered: false,
          status: "allocated",
          allocatedBy: userId,
          notes: "Manual split override",
        })
        .returning();

      committedSplits.push(record);

      // Decrement stock
      await db
        .update(warehouseStock)
        .set({
          quantity: sql`${warehouseStock.quantity} - ${alloc.quantity}`,
          quantityOnHand: sql`${warehouseStock.quantityOnHand} - ${alloc.quantity}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(warehouseStock.warehouseId, alloc.warehouse_id),
            eq(warehouseStock.productId, line.productId)
          )
        );

      // Audit movement
      await db.insert(stockMovements).values({
        warehouseId: alloc.warehouse_id,
        productId: line.productId,
        variantId: line.variantId ?? null,
        quantityChange: -alloc.quantity,
        movementType: "allocation",
        referenceId: quote.quoteNumber,
        performedBy: userId,
        notes: `Manual split allocation for quote ${quote.quoteNumber}`,
      });
    }

    // Remainder to backorders if allocated is less than requested line quantity
    if (totalAllocatedForLine < line.quantity) {
      const remainingBackordered = line.quantity - totalAllocatedForLine;
      const [bo] = await db
        .insert(backorders)
        .values({
          quoteId,
          quoteLineId: line.id,
          productId: line.productId,
          quantityBackordered: remainingBackordered,
          quantityRemaining: remainingBackordered,
          status: "open",
        })
        .returning();
      committedBackorders.push(bo);
    }
  }

  // Audit in approval logs
  await db.insert(approvalLogs).values({
    quoteId,
    reviewerId: userId,
    action: "fulfillment_override",
    level: "operations",
    reason: `Manual fulfillment override with ${committedSplits.length} allocations and ${committedBackorders.length} backorders`,
  });

  return {
    quote_id: quoteId,
    splits: committedSplits,
    backordered: committedBackorders,
    message: "Manual split override applied successfully",
  };
}

// ═══════════════════════════════════════════════════════════
// WAREHOUSES & STOCK CRUD
// ═══════════════════════════════════════════════════════════

export async function listWarehouses() {
  const list = await db.select().from(warehouses).orderBy(warehouses.name);
  return list.map((w) => ({
    id: w.id,
    name: w.name,
    code: w.code,
    location: w.location,
    shipping_cost_weight: Number(w.shippingCostWeight),
    is_active: w.isActive,
    created_at: w.createdAt,
  }));
}

export async function createWarehouse(data: {
  name: string;
  code?: string;
  location?: string;
  shipping_cost_weight?: number;
  is_active?: boolean;
}) {
  const [created] = await db
    .insert(warehouses)
    .values({
      name: data.name,
      code: data.code,
      location: data.location,
      shippingCostWeight: (data.shipping_cost_weight ?? 1.0).toFixed(2),
      isActive: data.is_active ?? true,
    })
    .returning();

  return {
    id: created.id,
    name: created.name,
    code: created.code,
    location: created.location,
    shipping_cost_weight: Number(created.shippingCostWeight),
    is_active: created.isActive,
    created_at: created.createdAt,
  };
}

export async function getWarehouseStock(warehouseId: number) {
  const [wh] = await db.select().from(warehouses).where(eq(warehouses.id, warehouseId)).limit(1);
  if (!wh) {
    throw ApiError.notFound(`Warehouse with ID ${warehouseId} not found`);
  }

  const stockList = await db
    .select()
    .from(warehouseStock)
    .where(eq(warehouseStock.warehouseId, warehouseId));

  if (stockList.length === 0) return [];

  const prodIds = Array.from(new Set(stockList.map((s) => s.productId)));
  const prodRows = await db.select().from(products).where(inArray(products.id, prodIds));
  const prodMap = new Map(prodRows.map((p) => [p.id, p]));

  return stockList.map((s) => {
    const prod = prodMap.get(s.productId);
    const available = Math.max(0, s.quantityOnHand - s.quantityReserved);

    return {
      id: s.id,
      warehouse_id: s.warehouseId,
      product_id: s.productId,
      variant_id: s.variantId,
      quantity_on_hand: s.quantityOnHand,
      quantity_reserved: s.quantityReserved,
      available_quantity: available,
      reorder_level: s.reorderLevel,
      product_name: prod ? prod.name : undefined,
      warehouse_name: wh.name,
    };
  });
}

export async function updateWarehouseStock(
  warehouseId: number,
  data: {
    product_id: number;
    variant_id?: number;
    quantity: number;
    reorder_level?: number;
    reorder_quantity?: number;
  },
  userId?: number
) {
  const [wh] = await db.select().from(warehouses).where(eq(warehouses.id, warehouseId)).limit(1);
  if (!wh) throw ApiError.notFound(`Warehouse with ID ${warehouseId} not found`);

  const [prod] = await db.select().from(products).where(eq(products.id, data.product_id)).limit(1);
  if (!prod) throw ApiError.notFound(`Product with ID ${data.product_id} not found`);

  // Check if stock record already exists
  const [existing] = await db
    .select()
    .from(warehouseStock)
    .where(
      and(
        eq(warehouseStock.warehouseId, warehouseId),
        eq(warehouseStock.productId, data.product_id)
      )
    )
    .limit(1);

  let updatedRecord;
  let delta = data.quantity;

  if (existing) {
    delta = data.quantity - existing.quantityOnHand;
    const [updated] = await db
      .update(warehouseStock)
      .set({
        quantity: data.quantity,
        quantityOnHand: data.quantity,
        variantId: data.variant_id ?? existing.variantId,
        reorderLevel: data.reorder_level ?? existing.reorderLevel,
        reorderQuantity: data.reorder_quantity ?? existing.reorderQuantity,
        updatedAt: new Date(),
      })
      .where(eq(warehouseStock.id, existing.id))
      .returning();
    updatedRecord = updated;
  } else {
    const [inserted] = await db
      .insert(warehouseStock)
      .values({
        warehouseId,
        productId: data.product_id,
        variantId: data.variant_id ?? null,
        quantity: data.quantity,
        quantityOnHand: data.quantity,
        quantityReserved: 0,
        reorderLevel: data.reorder_level ?? 10,
        reorderQuantity: data.reorder_quantity ?? 50,
      })
      .returning();
    updatedRecord = inserted;
  }

  // Audit stock movement if there is a non-zero delta
  if (delta !== 0) {
    await db.insert(stockMovements).values({
      warehouseId,
      productId: data.product_id,
      variantId: data.variant_id ?? null,
      quantityChange: delta,
      movementType: delta > 0 ? "restock" : "adjustment",
      referenceId: `WH-${warehouseId}`,
      performedBy: userId ?? null,
      notes: "Stock quantity adjustment",
    });
  }

  const available = Math.max(0, updatedRecord.quantityOnHand - updatedRecord.quantityReserved);

  return {
    id: updatedRecord.id,
    warehouse_id: updatedRecord.warehouseId,
    product_id: updatedRecord.productId,
    variant_id: updatedRecord.variantId,
    quantity_on_hand: updatedRecord.quantityOnHand,
    quantity_reserved: updatedRecord.quantityReserved,
    available_quantity: available,
    reorder_level: updatedRecord.reorderLevel,
    product_name: prod.name,
    warehouse_name: wh.name,
  };
}
