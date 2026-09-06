/**
 * Data Mappers — Transform backend API responses into frontend interface shapes.
 *
 * The backend (Drizzle ORM) returns camelCase fields, but some names differ
 * from the frontend Zustand store interfaces. These mappers bridge the gap.
 */

import type {
  Quotation,
  QuotationLine,
  ApprovalItem,
  FulfillmentItem,
  WarehouseSplit,
  SubscriptionItem,
  InvoiceItem,
  DealHealthItem,
  ProductItem,
} from '../stores/dealflowStore';

// ─── Helpers ────────────────────────────────────────────────────
function str(v: any): string {
  return v != null ? String(v) : '';
}
function num(v: any): number {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}
function dateStr(v: any): string {
  if (!v) return new Date().toISOString().split('T')[0];
  return new Date(v).toISOString().split('T')[0];
}

// ─── Quote Line ─────────────────────────────────────────────────
export function mapQuoteLine(line: any): QuotationLine {
  return {
    id: str(line.id),
    productId: str(line.productId),
    productName: line.product?.name || line.productName || 'Unknown Product',
    category: line.product?.category || line.category || '',
    description: line.product?.description || line.description || '',
    quantity: num(line.quantity),
    unitPrice: num(line.unitPrice || line.product?.basePrice),
    discount: num(line.discountPct),
    allowedDiscount: num(line.allowedDiscountPct),
    taxPercent: num(line.taxPct || 0),
    total: num(line.lineTotal),
  };
}

// ─── Quote / Quotation ──────────────────────────────────────────
const STATUS_MAP: Record<string, Quotation['status']> = {
  draft: 'Draft',
  submitted: 'Sent',
  pending_manager: 'Pending Approval',
  pending_finance: 'Pending Approval',
  approved: 'Approved',
  confirmed: 'Confirmed',
  fulfillment: 'Confirmed',
  rejected: 'Expired',
  revision: 'Draft',
};

export function mapQuote(q: any): Quotation {
  const lines = (q.lines || []).map(mapQuoteLine);
  const status = STATUS_MAP[q.status] || 'Draft';
  const approvalRoute = q.approvalRoute || 'auto';

  return {
    id: str(q.id),
    reference: q.quoteNumber || `QT-${q.id}`,
    customerName: q.customer?.name || q.customerName || 'Unknown',
    customerTier: q.customer?.tier?.name || q.customerTier || 'Bronze',
    date: dateStr(q.createdAt),
    expiryDate: dateStr(q.expiresAt),
    paymentTerms: q.paymentTerms || 'Net 30',
    status,
    lines,
    untaxedAmount: num(q.subtotal),
    taxAmount: num(q.totalTax),
    totalAmount: num(q.grandTotal),
    blendedRiskScore: num(q.blendedRiskScore),
    requiresManagerApproval: approvalRoute === 'manager' || approvalRoute === 'manager_finance',
    requiresFinanceApproval: approvalRoute === 'manager_finance',
    portalToken: q.portalToken || q.portal_token || undefined,
    comments: q.comments || [],
    approvalLogs: q.approvalLogs || [],
    pendingCounterOffer: q.pendingCounterOffer ?? null,
    auditTrail: (q.approvalLogs || []).map((log: any) => ({
      step: log.level || log.step || 'Review',
      user: log.reviewer?.name || log.reviewerName || log.user || 'System',
      status: log.action === 'approved' ? 'Approved' : log.action === 'rejected' ? 'Rejected' : log.action || 'Logged',
      timestamp: log.createdAt ? new Date(log.createdAt).toLocaleTimeString() : '',
      note: log.reason || log.note || undefined,
    })),
  };
}

// ─── Approval Item ──────────────────────────────────────────────
export function mapApproval(q: any): ApprovalItem {
  const auditTrail = (q.approvalLogs || q.auditTrail || []).map((log: any) => ({
    step: log.level || log.step || 'Review',
    user: log.reviewer?.name || log.reviewerName || log.user || 'Reviewer',
    status: log.action === 'approved' ? 'Approved' : log.action === 'rejected' ? 'Rejected' : log.action || log.status || 'Pending',
    timestamp: log.createdAt ? new Date(log.createdAt).toLocaleTimeString() : log.timestamp || '',
    note: log.reason || log.note || undefined,
  }));

  const isApproved = q.status === 'approved';
  const isRejected = q.status === 'rejected';

  return {
    id: str(q.id),
    reference: q.quoteNumber || `QT-${str(q.id).padStart(4, '0')}`,
    quotationId: str(q.id),
    customerName: q.customer?.name || q.customerName || 'Unknown Customer',
    customerTier: q.customer?.tier?.name || q.customerTier || 'Gold Tier',
    requestType: 'Discount Approval',
    amount: num(q.grandTotal),
    totalDiscount: num(q.totalDiscount),
    requestedBy: q.rep?.name || q.requestedBy || 'Sales Rep',
    requestedDate: dateStr(q.createdAt),
    status: isApproved ? 'Approved' : isRejected ? 'Rejected' : 'Pending',
    currentStatus: q.status,
    approvalRoute: q.approvalRoute || 'manager',
    canAct: q.canAct ?? false,
    requiredLevelText: q.requiredLevelText || (q.approvalRoute === 'manager_finance' ? 'Level 2: Finance & Operations' : 'Level 1: Manager Review'),
    blendedRiskScore: num(q.blendedRiskScore),
    reason: q.notes || '',
    auditTrail,
  };
}

// ─── Fulfillment ────────────────────────────────────────────────
export function mapFulfillment(data: any): FulfillmentItem {
  const sourceSplits = (data.warehouse_splits && data.warehouse_splits.length > 0)
    ? data.warehouse_splits
    : (data.splits || []);

  const splits: WarehouseSplit[] = sourceSplits.map((s: any) => ({
    warehouseId: s.warehouse_id || s.warehouseId,
    warehouseName: s.warehouse_name || s.warehouse?.name || s.warehouseName || `Warehouse ${s.warehouseId || ''}`,
    quantityFulfilled: num(s.quantity_fulfilled || s.quantityAllocated || s.quantity),
    stockAvailable: num(s.stock_available || s.stockAvailable || s.quantityOnHand),
    estimatedCost: num(s.estimated_cost || s.estimatedCost || 0),
    shipmentCount: num(s.shipment_count || 1),
    shippingCostWeight: num(s.shipping_cost_weight || 1.0),
    items: (s.items || []).map((it: any) => ({
      quoteLineId: it.quote_line_id || it.quoteLineId,
      productId: it.product_id || it.productId,
      productName: it.product_name || it.productName || 'Item',
      quantity: num(it.quantity),
    })),
  }));

  const backorderedList = (data.backordered || []).map((b: any) => ({
    id: b.id,
    quoteLineId: b.quote_line_id || b.quoteLineId,
    productId: b.product_id || b.productId,
    productName: b.product_name || b.productName || 'Product',
    quantity: num(b.quantity_backordered || b.quantityRemaining || b.quantity),
  }));

  const customerName =
    data.customer?.name ||
    data.quote?.customer?.name ||
    data.customerName ||
    data.customer_name ||
    'Unknown';

  const ref =
    data.reference ||
    (data.quoteNumber ? data.quoteNumber.replace('QT-', 'SO/') : '') ||
    (data.quote?.quoteNumber ? data.quote.quoteNumber.replace('QT-', 'SO/') : '') ||
    `SO/${str(data.quoteId || data.id).padStart(5, '0')}`;

  return {
    id: str(data.quoteId || data.id),
    reference: ref,
    quotationReference: data.quote?.quoteNumber || data.quoteNumber || data.quotationReference || '',
    customerName,
    scheduledDate: dateStr(data.scheduledDate || data.createdAt || data.date),
    status: data.status || 'Ready',
    responsible: data.performedBy || data.responsible || data.rep?.name || 'Operations',
    lines: (data.lines || data.quote?.lines || []).map((l: any) => ({
      id: l.id,
      productId: l.productId,
      productName: l.product?.name || l.productName || '',
      description: l.description || '',
      demand: num(l.quantity),
      done: num(l.quantityFulfilled || 0),
      unit: l.product?.unit || l.unit || 'Units',
    })),
    splits,
    totalShippingCost: num(data.total_estimated_shipping_cost || 0),
    backorderPrompt: backorderedList.length > 0,
    backorderedItems: backorderedList,
  };
}


// ─── Subscription ───────────────────────────────────────────────
const INTERVAL_MAP: Record<string, SubscriptionItem['billingFrequency']> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

export function mapSubscription(sub: any): SubscriptionItem {
  return {
    id: str(sub.id),
    reference: `SUB/${str(sub.id).padStart(5, '0')}`,
    customerName: sub.customer?.name || sub.customerName || sub.customer_name || 'Unknown',
    planName: sub.plan_name || sub.product?.name || sub.product_name || sub.planName || 'Subscription',
    startDate: dateStr(sub.startsAt || sub.startDate || sub.starts_at),
    nextBillingDate: dateStr(sub.currentPeriodEnd || sub.nextBillingDate || sub.current_period_end),
    billingFrequency: INTERVAL_MAP[sub.interval] || 'Monthly',
    status: sub.status === 'active' ? 'Active'
      : sub.status === 'paused' ? 'Paused'
      : sub.status === 'cancelled' ? 'Cancelled'
      : 'Expired',
    recurringLines: [{
      productName: sub.product?.name || 'Product',
      description: sub.product?.description || '',
      quantity: num(sub.quantity),
      unitPrice: num(sub.unitPrice),
      amount: num(sub.quantity) * num(sub.unitPrice),
    }],
  };
}

// ─── Invoice ────────────────────────────────────────────────────
export function mapInvoice(inv: any): InvoiceItem {
  const status = inv.status === 'paid' ? 'Paid'
    : inv.status === 'posted' || inv.status === 'sent' ? 'Posted'
    : inv.status === 'overdue' ? 'Overdue'
    : 'Draft';

  return {
    id: str(inv.id),
    reference: inv.invoiceNumber || inv.invoice_number || `INV/${str(inv.id).padStart(5, '0')}`,
    customerName: inv.customer?.name || inv.customerName || 'Unknown',
    invoiceDate: dateStr(inv.createdAt || inv.created_at),
    dueDate: dateStr(inv.dueDate || inv.due_date),
    amount: num(inv.total),
    status,
    paymentTerms: inv.paymentTerms || 'Net 30',

    lines: (inv.lines || []).map((l: any) => ({
      productName: l.product?.name || l.productName || '',
      description: l.description || '',
      quantity: num(l.quantity),
      unitPrice: num(l.unitPrice),
      taxes: num(l.tax),
      amount: num(l.total || l.lineTotal),
    })),
  };
}

// ─── Deal Health Alert ──────────────────────────────────────────
const RISK_MAP: Record<string, DealHealthItem['riskCategory']> = {
  stalled: 'Stalled Deal',
  discount_anomaly: 'Discount Anomaly',
  delivery_risk: 'Delivery Slippage',
};
const SEVERITY_MAP: Record<string, DealHealthItem['severity']> = {
  info: 'Low',
  warning: 'Medium',
  critical: 'Critical',
  high: 'High',
};

export function mapDealAlert(alert: any): DealHealthItem {
  const quoteRef =
    alert.quote_number ||
    alert.quoteNumber ||
    alert.quote?.quoteNumber ||
    (alert.quote_id || alert.quoteId || alert.quote?.id ? `QT-${alert.quote_id || alert.quoteId || alert.quote?.id}` : 'Quote');

  const custName =
    alert.customer_name ||
    alert.customerName ||
    alert.customer?.name ||
    alert.quote?.customer?.name ||
    'Unknown';

  const rep =
    alert.rep_name ||
    alert.repName ||
    alert.rep?.name ||
    alert.quote?.rep?.name ||
    'Sales Rep';

  return {
    id: str(alert.id),
    quoteId: alert.quote_id || alert.quoteId || alert.quote?.id,
    quotationRef: quoteRef,
    customerName: custName,
    repName: rep,
    amount: num(alert.quote?.grandTotal || alert.amount || alert.grand_total || 0),
    daysInactive: num(alert.days_inactive || alert.daysInactive || 0),
    riskCategory: RISK_MAP[alert.type] || 'Stalled Deal',
    severity: SEVERITY_MAP[alert.severity] || 'Medium',
    description: alert.message || alert.description || '',
    triggeredAction: (alert.is_resolved || alert.isResolved) ? 'Resolved' : undefined,
  };
}

// ─── Product ────────────────────────────────────────────────────
export function mapProduct(p: any): ProductItem {
  return {
    id: str(p.id),
    name: p.name || '',
    sku: p.sku || `SKU-${p.id}`,
    category: p.category?.name || p.categoryName || 'Uncategorized',
    salesPrice: num(p.basePrice),
    costPrice: num(p.costPrice),
    status: p.isActive === false ? 'Archived' : 'Active',
    description: p.description || '',
    canBeSold: true,
    canBePurchased: true,
  };
}

// ─── Auth User Mapper ───────────────────────────────────────────
export function mapAuthUser(u: any) {
  return {
    id: str(u.id),
    name: u.name || '',
    email: u.email || '',
    avatar: u.avatar_url || u.avatarUrl || undefined,
    phone: u.phone || undefined,
    role: mapRole(u.role),
    status: (u.isActive === false ? 'BANNED' : 'ACTIVE') as 'ACTIVE' | 'BANNED',
    emailVerified: true,
    createdAt: u.createdAt || new Date().toISOString(),
  };
}

const ROLE_BACKEND_TO_FRONTEND: Record<string, string> = {
  admin: 'ADMIN',
  manager: 'MANAGER',
  rep: 'rep',
  customer: 'customer',
  finance: 'MANAGER',
  operations: 'USER',
};

export function mapRole(backendRole: string): 'USER' | 'MANAGER' | 'ADMIN' | 'customer' | 'rep' {
  if (backendRole === 'customer') return 'customer';
  if (backendRole === 'rep') return 'rep';
  return (ROLE_BACKEND_TO_FRONTEND[backendRole] || 'USER') as 'USER' | 'MANAGER' | 'ADMIN' | 'customer' | 'rep';
}

