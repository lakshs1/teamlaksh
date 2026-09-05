import { eq, and, sql, desc, asc, inArray } from "drizzle-orm";
import {
  db,
  subscriptions,
  billingSchedules,
  invoices,
  quotes,
  quoteLines,
  customers,
  products,
} from "@db";
import { ApiError } from "../../lib/api-error.js";

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

async function generateInvoiceNumber(): Promise<string> {
  const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(invoices);
  const count = Number(countResult?.count || 0);
  const year = new Date().getFullYear();
  const seq = String(count + 1).padStart(4, "0");
  return `INV-${year}-${seq}`;
}

export function addInterval(date: Date, interval: string, count: number): Date {
  const res = new Date(date.getTime());
  if (interval === "monthly") {
    res.setMonth(res.getMonth() + count);
  } else if (interval === "quarterly") {
    res.setMonth(res.getMonth() + count * 3);
  } else if (interval === "yearly") {
    res.setFullYear(res.getFullYear() + count);
  } else {
    res.setMonth(res.getMonth() + count);
  }
  return res;
}

// ═══════════════════════════════════════════════════════════
// ADR-005 EAGER BILLING SCHEDULE GENERATOR
// ═══════════════════════════════════════════════════════════

/**
 * Pre-generates the upcoming billing schedule (e.g. 12 periods) for a subscription.
 */
export async function generateEagerBillingSchedules(
  subscriptionId: number,
  startsAt: Date,
  interval: string,
  quantity: number,
  unitPrice: number,
  periodsCount: number = 12
) {
  const perPeriodAmount = (quantity * unitPrice).toFixed(2);
  const rows = [];

  for (let i = 0; i < periodsCount; i++) {
    const periodStart = addInterval(startsAt, interval, i);
    const periodEnd = addInterval(startsAt, interval, i + 1);

    rows.push({
      subscriptionId,
      periodStart,
      periodEnd,
      amount: perPeriodAmount,
      status: "upcoming",
    });
  }

  const inserted = await db.insert(billingSchedules).values(rows).returning();
  return inserted;
}

// ═══════════════════════════════════════════════════════════
// SUBSCRIPTIONS SERVICES
// ═══════════════════════════════════════════════════════════

export async function listSubscriptions(filter: { customer_id?: number; status?: string }) {
  let query = db.select().from(subscriptions);

  const conditions = [];
  if (filter.customer_id) conditions.push(eq(subscriptions.customerId, filter.customer_id));
  if (filter.status) conditions.push(eq(subscriptions.status, filter.status));

  const list = conditions.length > 0
    ? await query.where(and(...conditions)).orderBy(desc(subscriptions.createdAt))
    : await query.orderBy(desc(subscriptions.createdAt));

  if (list.length === 0) return [];

  const prodIds = Array.from(new Set(list.map((s) => s.productId)));
  const custIds = Array.from(new Set(list.map((s) => s.customerId)));

  const prodRows = await db.select().from(products).where(inArray(products.id, prodIds));
  const custRows = await db.select().from(customers).where(inArray(customers.id, custIds));

  const prodMap = new Map(prodRows.map((p) => [p.id, p]));
  const custMap = new Map(custRows.map((c) => [c.id, c]));

  return list.map((s) => ({
    id: s.id,
    quote_id: s.quoteId,
    quote_line_id: s.quoteLineId,
    customer_id: s.customerId,
    product_id: s.productId,
    quantity: s.quantity,
    unit_price: Number(s.unitPrice),
    interval: s.interval,
    status: s.status,
    starts_at: s.startsAt,
    current_period_start: s.currentPeriodStart,
    current_period_end: s.currentPeriodEnd,
    created_at: s.createdAt,
    product_name: prodMap.get(s.productId)?.name,
    customer_name: custMap.get(s.customerId)?.name,
  }));
}

export async function getSubscriptionById(id: number) {
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.id, id)).limit(1);
  if (!sub) throw ApiError.notFound(`Subscription with ID ${id} not found`);

  const [prod] = await db.select().from(products).where(eq(products.id, sub.productId)).limit(1);
  const [cust] = await db.select().from(customers).where(eq(customers.id, sub.customerId)).limit(1);

  const schedules = await db
    .select()
    .from(billingSchedules)
    .where(eq(billingSchedules.subscriptionId, id))
    .orderBy(asc(billingSchedules.periodStart));

  return {
    id: sub.id,
    quote_id: sub.quoteId,
    quote_line_id: sub.quoteLineId,
    customer_id: sub.customerId,
    product_id: sub.productId,
    quantity: sub.quantity,
    unit_price: Number(sub.unitPrice),
    interval: sub.interval,
    status: sub.status,
    starts_at: sub.startsAt,
    current_period_start: sub.currentPeriodStart,
    current_period_end: sub.currentPeriodEnd,
    created_at: sub.createdAt,
    product_name: prod?.name,
    customer_name: cust?.name,
    schedules: schedules.map((sc) => ({
      id: sc.id,
      subscription_id: sc.subscriptionId,
      period_start: sc.periodStart,
      period_end: sc.periodEnd,
      amount: Number(sc.amount),
      status: sc.status,
      invoice_id: sc.invoiceId,
      created_at: sc.createdAt,
    })),
  };
}

/**
 * Mid-cycle seat update with proration calculation.
 * Updates future schedules and creates an invoice/credit note for the prorated delta.
 */
export async function updateSubscription(
  id: number,
  input: { quantity?: number; status?: string }
) {
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.id, id)).limit(1);
  if (!sub) throw ApiError.notFound(`Subscription with ID ${id} not found`);

  let generatedInvoice: any = null;
  let proratedDelta = 0;

  if (input.quantity !== undefined && input.quantity !== sub.quantity) {
    const now = new Date();
    const startMs = sub.currentPeriodStart.getTime();
    const endMs = sub.currentPeriodEnd.getTime();
    const totalCycleMs = Math.max(1, endMs - startMs);
    const remainingMs = Math.max(0, endMs - now.getTime());
    const remainingRatio = remainingMs / totalCycleMs;

    const deltaQty = input.quantity - sub.quantity;
    const unitPrice = Number(sub.unitPrice);
    proratedDelta = Math.round(deltaQty * unitPrice * remainingRatio * 100) / 100;

    // Update upcoming schedules to reflect the new recurring amount
    const newScheduleAmount = (input.quantity * unitPrice).toFixed(2);
    await db
      .update(billingSchedules)
      .set({ amount: newScheduleAmount })
      .where(
        and(
          eq(billingSchedules.subscriptionId, id),
          eq(billingSchedules.status, "upcoming")
        )
      );

    // If prorated delta > 0, generate invoice for the difference
    if (proratedDelta > 0) {
      const invoiceNumber = await generateInvoiceNumber();
      const [inv] = await db
        .insert(invoices)
        .values({
          invoiceNumber,
          quoteId: sub.quoteId,
          customerId: sub.customerId,
          type: "recurring",
          subtotal: proratedDelta.toFixed(2),
          tax: "0.00",
          total: proratedDelta.toFixed(2),
          status: "sent",
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        })
        .returning();
      generatedInvoice = inv;
    } else if (proratedDelta < 0) {
      // Credit note for downgrade
      const creditAmount = Math.abs(proratedDelta).toFixed(2);
      const invoiceNumber = await generateInvoiceNumber();
      const [inv] = await db
        .insert(invoices)
        .values({
          invoiceNumber,
          quoteId: sub.quoteId,
          customerId: sub.customerId,
          type: "credit_note",
          subtotal: creditAmount,
          tax: "0.00",
          total: creditAmount,
          status: "paid",
          paidAt: new Date(),
        })
        .returning();
      generatedInvoice = inv;
    }
  }

  const [updatedSub] = await db
    .update(subscriptions)
    .set({
      quantity: input.quantity ?? sub.quantity,
      status: input.status ?? sub.status,
    })
    .where(eq(subscriptions.id, id))
    .returning();

  const details = await getSubscriptionById(updatedSub.id);

  return {
    subscription: details,
    prorated_amount: proratedDelta,
    invoice: generatedInvoice
      ? {
          id: generatedInvoice.id,
          invoice_number: generatedInvoice.invoiceNumber,
          type: generatedInvoice.type,
          total: Number(generatedInvoice.total),
          status: generatedInvoice.status,
        }
      : null,
    message:
      proratedDelta > 0
        ? `Seats scaled to ${input.quantity}. Generated prorated invoice ${generatedInvoice?.invoiceNumber} for $${proratedDelta}.`
        : proratedDelta < 0
        ? `Seats reduced to ${input.quantity}. Issued credit note ${generatedInvoice?.invoiceNumber} for $${Math.abs(proratedDelta)}.`
        : "Subscription updated successfully.",
  };
}

/**
 * Cancels subscription and generates a prorated credit note for unconsumed days.
 */
export async function cancelSubscription(id: number) {
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.id, id)).limit(1);
  if (!sub) throw ApiError.notFound(`Subscription with ID ${id} not found`);

  // Cancel future upcoming schedules
  await db
    .update(billingSchedules)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(billingSchedules.subscriptionId, id),
        eq(billingSchedules.status, "upcoming")
      )
    );

  // Calculate refund for remaining period days
  const now = new Date();
  const startMs = sub.currentPeriodStart.getTime();
  const endMs = sub.currentPeriodEnd.getTime();
  const totalCycleMs = Math.max(1, endMs - startMs);
  const remainingMs = Math.max(0, endMs - now.getTime());
  const remainingRatio = remainingMs / totalCycleMs;

  const refundAmount = Math.round(sub.quantity * Number(sub.unitPrice) * remainingRatio * 100) / 100;
  let creditNote: any = null;

  if (refundAmount > 0) {
    const invoiceNumber = await generateInvoiceNumber();
    const [inv] = await db
      .insert(invoices)
      .values({
        invoiceNumber,
        quoteId: sub.quoteId,
        customerId: sub.customerId,
        type: "credit_note",
        subtotal: refundAmount.toFixed(2),
        tax: "0.00",
        total: refundAmount.toFixed(2),
        status: "paid",
        paidAt: new Date(),
      })
      .returning();
    creditNote = inv;
  }

  const [cancelledSub] = await db
    .update(subscriptions)
    .set({ status: "cancelled" })
    .where(eq(subscriptions.id, id))
    .returning();

  return {
    subscription: cancelledSub,
    refund_amount: refundAmount,
    credit_note: creditNote
      ? {
          id: creditNote.id,
          invoice_number: creditNote.invoiceNumber,
          total: Number(creditNote.total),
          status: creditNote.status,
        }
      : null,
    message: creditNote
      ? `Subscription cancelled. Issued prorated credit note ${creditNote.invoiceNumber} for $${refundAmount}.`
      : "Subscription cancelled successfully.",
  };
}

// ═══════════════════════════════════════════════════════════
// INVOICES SERVICES
// ═══════════════════════════════════════════════════════════

export async function listInvoices(filter: {
  customer_id?: number;
  status?: string;
  type?: string;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, filter.page || 1);
  const limit = Math.max(1, Math.min(100, filter.limit || 20));
  const offset = (page - 1) * limit;

  const conditions = [];
  if (filter.customer_id) conditions.push(eq(invoices.customerId, filter.customer_id));
  if (filter.status) conditions.push(eq(invoices.status, filter.status));
  if (filter.type) conditions.push(eq(invoices.type, filter.type));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [countRes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(invoices)
    .where(whereClause);

  const total = Number(countRes?.count || 0);

  const rows = await db
    .select()
    .from(invoices)
    .where(whereClause)
    .orderBy(desc(invoices.createdAt))
    .limit(limit)
    .offset(offset);

  if (rows.length === 0) {
    return {
      items: [],
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  const custIds = Array.from(new Set(rows.map((r) => r.customerId)));
  const custRows = await db.select().from(customers).where(inArray(customers.id, custIds));
  const custMap = new Map(custRows.map((c) => [c.id, c]));

  const items = rows.map((inv) => ({
    id: inv.id,
    invoice_number: inv.invoiceNumber,
    quote_id: inv.quoteId,
    customer_id: inv.customerId,
    type: inv.type,
    subtotal: Number(inv.subtotal),
    tax: Number(inv.tax),
    total: Number(inv.total),
    status: inv.status,
    due_date: inv.dueDate,
    paid_at: inv.paidAt,
    created_at: inv.createdAt,
    customer: custMap.get(inv.customerId)
      ? {
          id: custMap.get(inv.customerId)!.id,
          name: custMap.get(inv.customerId)!.name,
          email: custMap.get(inv.customerId)!.email,
        }
      : undefined,
  }));

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getInvoiceById(id: number) {
  const [inv] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  if (!inv) throw ApiError.notFound(`Invoice with ID ${id} not found`);

  const [cust] = await db.select().from(customers).where(eq(customers.id, inv.customerId)).limit(1);

  return {
    id: inv.id,
    invoice_number: inv.invoiceNumber,
    quote_id: inv.quoteId,
    customer_id: inv.customerId,
    type: inv.type,
    subtotal: Number(inv.subtotal),
    tax: Number(inv.tax),
    total: Number(inv.total),
    status: inv.status,
    due_date: inv.dueDate,
    paid_at: inv.paidAt,
    created_at: inv.createdAt,
    customer: cust
      ? {
          id: cust.id,
          name: cust.name,
          email: cust.email,
        }
      : undefined,
  };
}

export async function markInvoicePaid(id: number) {
  const [inv] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  if (!inv) throw ApiError.notFound(`Invoice with ID ${id} not found`);

  const now = new Date();
  const [updated] = await db
    .update(invoices)
    .set({
      status: "paid",
      paidAt: now,
    })
    .where(eq(invoices.id, id))
    .returning();

  // If this invoice was linked to any billing schedules, mark them paid
  await db
    .update(billingSchedules)
    .set({ status: "paid" })
    .where(eq(billingSchedules.invoiceId, id));

  return getInvoiceById(updated.id);
}

export async function createCreditNote(input: {
  invoice_id?: number;
  customer_id?: number;
  quote_id?: number;
  amount: number;
  reason: string;
  notes?: string;
}) {
  let customerId = input.customer_id;
  let quoteId = input.quote_id;

  if (input.invoice_id) {
    const [inv] = await db.select().from(invoices).where(eq(invoices.id, input.invoice_id)).limit(1);
    if (inv) {
      customerId = customerId || inv.customerId;
      quoteId = quoteId || inv.quoteId;
    }
  }

  if (!customerId) {
    // default to first customer if available
    const [firstCust] = await db.select().from(customers).limit(1);
    customerId = firstCust?.id || 1;
  }
  if (!quoteId) {
    const [firstQuote] = await db.select().from(quotes).limit(1);
    quoteId = firstQuote?.id || 1;
  }

  const invoiceNumber = await generateInvoiceNumber();
  const amountStr = Number(input.amount).toFixed(2);

  const [creditNote] = await db
    .insert(invoices)
    .values({
      invoiceNumber: `CN-${invoiceNumber}`,
      quoteId,
      customerId,
      type: "credit_note",
      subtotal: amountStr,
      tax: "0.00",
      total: amountStr,
      status: "paid",
      paidAt: new Date(),
    })
    .returning();

  return {
    credit_note: creditNote,
    message: `Credit note ${creditNote.invoiceNumber} for ₹${Number(input.amount).toLocaleString("en-IN")} successfully issued. Reason: ${input.reason}`,
  };
}

export async function createInvoice(input: {
  customer_id: number;
  quote_id?: number;
  subtotal: number;
  tax?: number;
  total?: number;
  type?: string;
  due_date?: Date;
}) {
  const invoiceNumber = await generateInvoiceNumber();
  const subtotalStr = Number(input.subtotal).toFixed(2);
  const taxStr = Number(input.tax || 0).toFixed(2);
  const totalStr = Number(input.total || input.subtotal + (input.tax || 0)).toFixed(2);

  let quoteId = input.quote_id;
  if (!quoteId) {
    const [q] = await db.select().from(quotes).where(eq(quotes.customerId, input.customer_id)).limit(1);
    quoteId = q?.id || 1;
  }

  const [inv] = await db
    .insert(invoices)
    .values({
      invoiceNumber,
      quoteId,
      customerId: input.customer_id,
      type: input.type || "one_time",
      subtotal: subtotalStr,
      tax: taxStr,
      total: totalStr,
      status: "sent",
      dueDate: input.due_date || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    })
    .returning();

  return getInvoiceById(inv.id);
}

