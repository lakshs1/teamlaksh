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

export interface WarehouseSummarySplit {
  warehouse_id: number;
  warehouse_name: string;
  quantity_fulfilled: number;
  stock_available: number;
  shipment_count: number;
  estimated_cost: number;
  shipping_cost_weight?: number;
  items: Array<{
    quote_line_id: number;
    product_id: number;
    product_name: string;
    quantity: number;
  }>;
}

export interface SplitRecommendationResult {
  quote_id: number;
  splits: SplitItem[];
  warehouse_splits: WarehouseSummarySplit[];
  backordered: BackorderItem[];
  total_shipments: number;
  total_estimated_shipping_cost: number;
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
      warehouse_splits: [],
      backordered: [],
      total_shipments: 0,
      total_estimated_shipping_cost: 0,
      can_fulfill_completely: true,
    };
  }

  // Filter physical items (non-recurring)
  const physicalLines = lines.filter((l) => !l.isRecurring);
  if (physicalLines.length === 0) {
    return {
      quote_id: quoteId,
      splits: [],
      warehouse_splits: [],
      backordered: [],
      total_shipments: 0,
      total_estimated_shipping_cost: 0,
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

  // Build warehouse summaries with calculated shipping cost and item details
  const warehouse_splits: WarehouseSummarySplit[] = [];
  let totalOrderShippingCost = 0;

  for (const wh of activeWarehouses) {
    const whSplits = splits.filter((s) => s.warehouse_id === wh.id);
    if (whSplits.length === 0) continue;

    const totalQty = whSplits.reduce((acc, s) => acc + s.quantity, 0);
    const weight = Number(wh.shippingCostWeight) || 1.0;
    // Base shipment rate ₹1,200 weighted by warehouse distance factor and package quantity
    const estimatedCost = Math.round(1200 * weight + totalQty * 25);
    totalOrderShippingCost += estimatedCost;

    // Total available stock in warehouse
    let whStockTotal = 0;
    for (const [key, qty] of stockAvailableMap.entries()) {
      if (key.startsWith(`${wh.id}_`)) whStockTotal += qty;
    }

    warehouse_splits.push({
      warehouse_id: wh.id,
      warehouse_name: wh.name,
      quantity_fulfilled: totalQty,
      stock_available: whStockTotal + totalQty,
      shipment_count: 1,
      estimated_cost: estimatedCost,
      shipping_cost_weight: weight,
      items: whSplits.map((s) => ({
        quote_line_id: s.quote_line_id,
        product_id: s.product_id,
        product_name: s.product_name,
        quantity: s.quantity,
      })),
    });
  }

  return {
    quote_id: quoteId,
    splits,
    warehouse_splits,
    backordered,
    total_shipments,
    total_estimated_shipping_cost: totalOrderShippingCost,
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

// ═══════════════════════════════════════════════════════════
// BACKORDER CONSOLIDATION & RESTOCK CHECK (PRD B6)
// ═══════════════════════════════════════════════════════════

export async function checkBackordersRestock(quoteId: number) {
  // 1. Fetch quote
  await getQuoteOrThrow(quoteId);

  // 2. Fetch open backorders for quote
  const openBackorders = await db
    .select()
    .from(backorders)
    .where(and(eq(backorders.quoteId, quoteId), eq(backorders.status, "open")));

  if (openBackorders.length === 0) {
    return {
      has_new_stock: false,
      can_consolidate: false,
      backorders: [],
      restocked_items: [],
      message: "No open backorders for this order.",
    };
  }

  const productIds = Array.from(new Set(openBackorders.map((b) => b.productId)));
  const productRows = await db.select().from(products).where(inArray(products.id, productIds));
  const productMap = new Map(productRows.map((p) => [p.id, p]));

  // 3. Check live available stock across active warehouses
  const stockRows = await db
    .select()
    .from(warehouseStock)
    .where(inArray(warehouseStock.productId, productIds));

  const activeWhs = await db
    .select()
    .from(warehouses)
    .where(eq(warehouses.isActive, true))
    .orderBy(asc(warehouses.shippingCostWeight));

  const restockedItems: Array<{
    backorder_id: number;
    quote_line_id: number;
    product_id: number;
    product_name: string;
    quantity_backordered: number;
    quantity_available_now: number;
    preferred_warehouse_id: number;
    preferred_warehouse_name: string;
  }> = [];

  let canConsolidateAny = false;

  for (const bo of openBackorders) {
    const prod = productMap.get(bo.productId);
    const prodName = prod ? prod.name : `Product #${bo.productId}`;

    // Find if any active warehouse has available stock
    for (const wh of activeWhs) {
      const stock = stockRows.find(
        (s) => s.warehouseId === wh.id && s.productId === bo.productId
      );
      const available = stock ? Math.max(0, stock.quantityOnHand - stock.quantityReserved) : 0;

      if (available > 0) {
        canConsolidateAny = true;
        restockedItems.push({
          backorder_id: bo.id,
          quote_line_id: bo.quoteLineId,
          product_id: bo.productId,
          product_name: prodName,
          quantity_backordered: bo.quantityRemaining,
          quantity_available_now: available,
          preferred_warehouse_id: wh.id,
          preferred_warehouse_name: wh.name,
        });
        break; // matched with lowest cost warehouse
      }
    }
  }

  return {
    has_new_stock: canConsolidateAny,
    can_consolidate: canConsolidateAny,
    backorders: openBackorders.map((b) => ({
      id: b.id,
      quote_line_id: b.quoteLineId,
      product_id: b.productId,
      quantity_backordered: b.quantityRemaining,
      product_name: productMap.get(b.productId)?.name || `Product #${b.productId}`,
    })),
    restocked_items: restockedItems,
  };
}

export async function consolidateBackorders(quoteId: number, userId: number) {
  const quote = await getQuoteOrThrow(quoteId);

  const openBackorders = await db
    .select()
    .from(backorders)
    .where(and(eq(backorders.quoteId, quoteId), eq(backorders.status, "open")));

  if (openBackorders.length === 0) {
    return {
      success: true,
      consolidated_count: 0,
      message: "No open backorders found to consolidate.",
    };
  }

  const activeWhs = await db
    .select()
    .from(warehouses)
    .where(eq(warehouses.isActive, true))
    .orderBy(asc(warehouses.shippingCostWeight));

  const consolidated: any[] = [];

  for (const bo of openBackorders) {
    let remaining = bo.quantityRemaining;

    for (const wh of activeWhs) {
      if (remaining <= 0) break;

      const [stock] = await db
        .select()
        .from(warehouseStock)
        .where(
          and(
            eq(warehouseStock.warehouseId, wh.id),
            eq(warehouseStock.productId, bo.productId)
          )
        )
        .limit(1);

      const available = stock ? Math.max(0, stock.quantityOnHand - stock.quantityReserved) : 0;
      if (available <= 0) continue;

      const take = Math.min(remaining, available);

      // Create fulfillment split
      const [splitRecord] = await db
        .insert(fulfillmentSplits)
        .values({
          quoteId,
          quoteLineId: bo.quoteLineId,
          warehouseId: wh.id,
          quantity: take,
          quantityAllocated: take,
          quantityFulfilled: 0,
          isBackordered: false,
          status: "allocated",
          allocatedBy: userId,
          notes: "Consolidated backorder allocation from newly arrived stock",
        })
        .returning();

      consolidated.push(splitRecord);

      // Decrement stock
      await db
        .update(warehouseStock)
        .set({
          quantity: sql`${warehouseStock.quantity} - ${take}`,
          quantityOnHand: sql`${warehouseStock.quantityOnHand} - ${take}`,
          updatedAt: new Date(),
        })
        .where(eq(warehouseStock.id, stock.id));

      // Stock movement audit
      await db.insert(stockMovements).values({
        warehouseId: wh.id,
        productId: bo.productId,
        quantityChange: -take,
        movementType: "backorder_consolidation",
        referenceId: quote.quoteNumber,
        performedBy: userId,
        notes: `Backorder consolidated for quote ${quote.quoteNumber}`,
      });

      remaining -= take;
    }

    // Update backorder record
    if (remaining <= 0) {
      await db
        .update(backorders)
        .set({
          quantityRemaining: 0,
          status: "resolved",
          resolvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(backorders.id, bo.id));
    } else if (remaining < bo.quantityRemaining) {
      await db
        .update(backorders)
        .set({
          quantityRemaining: remaining,
          status: "partially_resolved",
          updatedAt: new Date(),
        })
        .where(eq(backorders.id, bo.id));
    }
  }

  // Audit log
  await db.insert(approvalLogs).values({
    quoteId,
    reviewerId: userId,
    action: "backorder_consolidated",
    level: "operations",
    reason: `Consolidated ${consolidated.length} backorder splits following inbound restock`,
  });

  return {
    success: true,
    consolidated_count: consolidated.length,
    message: `Successfully consolidated ${consolidated.length} backordered items into active fulfillment splits.`,
  };
}

export async function simulateInboundRestock(quoteId: number, userId?: number) {
  const openBackorders = await db
    .select()
    .from(backorders)
    .where(and(eq(backorders.quoteId, quoteId), eq(backorders.status, "open")));

  let targetProductIds: number[] = [];
  if (openBackorders.length > 0) {
    targetProductIds = openBackorders.map((b) => b.productId);
  } else {
    // If no backorder record committed yet, get from split calculation
    const rec = await calculateWarehouseSplit(quoteId);
    targetProductIds = rec.backordered.map((b) => b.product_id);
  }

  const [primaryWh] = await db
    .select()
    .from(warehouses)
    .where(eq(warehouses.isActive, true))
    .orderBy(asc(warehouses.shippingCostWeight))
    .limit(1);

  if (!primaryWh) throw ApiError.badRequest("No active warehouse found for restock");

  let restockedCount = 0;
  for (const pid of targetProductIds) {
    await updateWarehouseStock(
      primaryWh.id,
      {
        product_id: pid,
        quantity: 50,
      },
      userId
    );
    restockedCount++;
  }

  return {
    success: true,
    warehouse_name: primaryWh.name,
    restocked_products_count: restockedCount,
    message: `Restocked inbound inventory (+50 units) at ${primaryWh.name} for ${restockedCount} products.`,
  };
}

