import { eq, and, sql, desc, asc, inArray } from "drizzle-orm";
import {
  db,
  subscriptions,
  subscriptionPlans,
  billingSchedules,
  invoices,
  quotes,
  quoteLines,
  customers,
  products,
  productCategories,
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
  const planIds = Array.from(new Set(list.map((s) => s.planId).filter((id): id is number => id !== null)));

  const prodRows = await db.select().from(products).where(inArray(products.id, prodIds));
  const custRows = await db.select().from(customers).where(inArray(customers.id, custIds));
  const planRows = planIds.length > 0 ? await db.select().from(subscriptionPlans).where(inArray(subscriptionPlans.id, planIds)) : [];

  const prodMap = new Map(prodRows.map((p) => [p.id, p]));
  const custMap = new Map(custRows.map((c) => [c.id, c]));
  const planMap = new Map(planRows.map((p) => [p.id, p]));

  return list.map((s) => ({
    id: s.id,
    quote_id: s.quoteId,
    quote_line_id: s.quoteLineId,
    customer_id: s.customerId,
    product_id: s.productId,
    plan_id: s.planId,
    quantity: s.quantity,
    unit_price: Number(s.unitPrice),
    interval: s.interval,
    status: s.status,
    starts_at: s.startsAt,
    current_period_start: s.currentPeriodStart,
    current_period_end: s.currentPeriodEnd,
    cancel_at_period_end: s.cancelAtPeriodEnd,
    cancelled_at: s.cancelledAt,
    cancellation_reason: s.cancellationReason,
    created_at: s.createdAt,
    product_name: prodMap.get(s.productId)?.name,
    customer_name: custMap.get(s.customerId)?.name,
    plan_name: s.planId ? planMap.get(s.planId)?.name : null,
  }));
}

export async function getSubscriptionById(id: number) {
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.id, id)).limit(1);
  if (!sub) throw ApiError.notFound(`Subscription with ID ${id} not found`);

  const [prod] = await db.select().from(products).where(eq(products.id, sub.productId)).limit(1);
  const [cust] = await db.select().from(customers).where(eq(customers.id, sub.customerId)).limit(1);
  const [plan] = sub.planId
    ? await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, sub.planId)).limit(1)
    : [null];

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
    plan_id: sub.planId,
    quantity: sub.quantity,
    unit_price: Number(sub.unitPrice),
    interval: sub.interval,
    status: sub.status,
    starts_at: sub.startsAt,
    current_period_start: sub.currentPeriodStart,
    current_period_end: sub.currentPeriodEnd,
    cancel_at_period_end: sub.cancelAtPeriodEnd,
    cancelled_at: sub.cancelledAt,
    cancellation_reason: sub.cancellationReason,
    created_at: sub.createdAt,
    product_name: prod?.name,
    customer_name: cust?.name,
    plan_name: plan?.name || null,
    plan: plan
      ? {
          id: plan.id,
          name: plan.name,
          proration_rule: plan.prorationRule,
          allow_mid_cycle_changes: plan.allowMidCycleChanges,
          cancellation_policy: plan.cancellationPolicy,
          refund_percentage: Number(plan.refundPercentage),
        }
      : null,
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

export async function createSubscription(input: {
  customer_id: number;
  product_id?: number;
  plan_id?: number;
  quantity?: number;
  unit_price?: number;
  interval?: string;
  starts_at?: Date;
  quote_id?: number;
}) {
  const [cust] = await db.select().from(customers).where(eq(customers.id, input.customer_id)).limit(1);
  if (!cust) throw ApiError.notFound(`Customer with ID ${input.customer_id} not found`);

  let productId = input.product_id;
  let unitPrice = input.unit_price;
  let interval = input.interval || "monthly";

  if (input.plan_id) {
    const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, input.plan_id)).limit(1);
    if (plan) {
      productId = productId || plan.productId || undefined;
      unitPrice = unitPrice !== undefined ? unitPrice : Number(plan.basePrice);
      interval = plan.interval || interval;
    }
  }

  if (!productId) {
    const [recProd] = await db.select().from(products).where(eq(products.isRecurring, true)).limit(1);
    const fallback = recProd || (await db.select().from(products).limit(1))[0];
    if (!fallback) throw ApiError.badRequest("No products found in catalog to attach subscription");
    productId = fallback.id;
    if (unitPrice === undefined) unitPrice = Number(fallback.basePrice);
  }

  if (unitPrice === undefined) {
    const [p] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    unitPrice = Number(p?.basePrice || 100);
  }

  let quoteId = input.quote_id;
  let quoteLineId: number | undefined;

  if (quoteId) {
    const [line] = await db.select().from(quoteLines).where(eq(quoteLines.quoteId, quoteId)).limit(1);
    quoteLineId = line?.id;
  }

  if (!quoteId || !quoteLineId) {
    const [q] = await db.select().from(quotes).where(eq(quotes.customerId, input.customer_id)).limit(1);
    if (q) {
      quoteId = q.id;
      const [line] = await db.select().from(quoteLines).where(eq(quoteLines.quoteId, q.id)).limit(1);
      quoteLineId = line?.id;
    }
  }

  if (!quoteId || !quoteLineId) {
    const [anyLine] = await db.select().from(quoteLines).limit(1);
    if (anyLine) {
      quoteId = anyLine.quoteId;
      quoteLineId = anyLine.id;
    } else {
      const [anyQuote] = await db.select().from(quotes).limit(1);
      quoteId = anyQuote?.id || 1;
      quoteLineId = 1;
    }
  }

  const now = input.starts_at || new Date();
  const periodEnd = addInterval(now, interval, 1);
  const qty = input.quantity && input.quantity > 0 ? input.quantity : 1;

  const [sub] = await db
    .insert(subscriptions)
    .values({
      quoteId,
      quoteLineId,
      customerId: input.customer_id,
      productId,
      planId: input.plan_id || null,
      quantity: qty,
      unitPrice: unitPrice.toFixed(2),
      interval,
      status: "active",
      startsAt: now,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    })
    .returning();

  await generateEagerBillingSchedules(
    sub.id,
    now,
    interval,
    sub.quantity,
    Number(sub.unitPrice),
    12
  );

  return getSubscriptionById(sub.id);
}

/**
 * Mid-cycle seat update with plan-configured proration calculation.
 * Updates future schedules and creates an invoice/credit note for the prorated delta.
 */
export async function updateSubscription(
  id: number,
  input: { quantity?: number; status?: string }
) {
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.id, id)).limit(1);
  if (!sub) throw ApiError.notFound(`Subscription with ID ${id} not found`);

  let plan: any = null;
  if (sub.planId) {
    const [foundPlan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, sub.planId)).limit(1);
    plan = foundPlan;
  }

  // Check if mid-cycle changes are permitted
  if (plan && plan.allowMidCycleChanges === false && input.quantity !== undefined && input.quantity !== sub.quantity) {
    throw ApiError.badRequest("Mid-cycle quantity changes are disabled by this plan's policy.");
  }

  let generatedInvoice: any = null;
  let proratedDelta = 0;

  if (input.quantity !== undefined && input.quantity !== sub.quantity) {
    const deltaQty = input.quantity - sub.quantity;
    const unitPrice = Number(sub.unitPrice);
    const prorationRule = plan?.prorationRule || "exact_day";

    if (prorationRule === "no_proration") {
      proratedDelta = 0;
    } else if (prorationRule === "full_period") {
      proratedDelta = Math.round(deltaQty * unitPrice * 100) / 100;
    } else {
      // exact_day
      const now = new Date();
      const startMs = sub.currentPeriodStart.getTime();
      const endMs = sub.currentPeriodEnd.getTime();
      const totalCycleMs = Math.max(1, endMs - startMs);
      const remainingMs = Math.max(0, endMs - now.getTime());
      const remainingRatio = remainingMs / totalCycleMs;
      proratedDelta = Math.round(deltaQty * unitPrice * remainingRatio * 100) / 100;
    }

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
 * Cancels subscription based on plan's cancellation and refund policy.
 */
export async function cancelSubscription(id: number, input?: { reason?: string }) {
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.id, id)).limit(1);
  if (!sub) throw ApiError.notFound(`Subscription with ID ${id} not found`);

  let plan: any = null;
  if (sub.planId) {
    const [foundPlan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, sub.planId)).limit(1);
    plan = foundPlan;
  }

  const policy = plan?.cancellationPolicy || "prorated_refund";
  const refundPct = Number(plan?.refundPercentage ?? 100) / 100;

  if (policy === "end_of_cycle") {
    // Retain active status until current cycle concludes, mark flag
    const [updatedSub] = await db
      .update(subscriptions)
      .set({
        cancelAtPeriodEnd: true,
        cancellationReason: input?.reason || "Cancelled (effective at period end)",
      })
      .where(eq(subscriptions.id, id))
      .returning();

    return {
      subscription: updatedSub,
      refund_amount: 0,
      credit_note: null,
      message: "Subscription scheduled to cancel at the end of the current billing cycle. No immediate refund issued.",
    };
  }

  // Immediate cancellation: cancel future upcoming schedules
  await db
    .update(billingSchedules)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(billingSchedules.subscriptionId, id),
        eq(billingSchedules.status, "upcoming")
      )
    );

  let refundAmount = 0;
  let creditNote: any = null;

  if (policy === "prorated_refund") {
    const now = new Date();
    const startMs = sub.currentPeriodStart.getTime();
    const endMs = sub.currentPeriodEnd.getTime();
    const totalCycleMs = Math.max(1, endMs - startMs);
    const remainingMs = Math.max(0, endMs - now.getTime());
    const remainingRatio = remainingMs / totalCycleMs;

    refundAmount = Math.round(sub.quantity * Number(sub.unitPrice) * remainingRatio * refundPct * 100) / 100;

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
  }

  const [cancelledSub] = await db
    .update(subscriptions)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      cancellationReason: input?.reason || null,
    })
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
      : policy === "no_refund"
      ? "Subscription cancelled immediately with no refund as per plan policy."
      : "Subscription cancelled successfully.",
  };
}

// ═══════════════════════════════════════════════════════════
// SUBSCRIPTION PLANS SERVICES (PRD Section A5)
// ═══════════════════════════════════════════════════════════

export async function listSubscriptionPlans() {
  const plans = await db.select().from(subscriptionPlans).orderBy(desc(subscriptionPlans.createdAt));
  if (plans.length === 0) return [];

  const productIds = Array.from(new Set(plans.map((p) => p.productId).filter((id): id is number => id !== null)));
  let prodMap = new Map<number, any>();
  if (productIds.length > 0) {
    const prods = await db.select().from(products).where(inArray(products.id, productIds));
    prodMap = new Map(prods.map((p) => [p.id, p]));
  }

  return plans.map((p) => ({
    id: p.id,
    name: p.name,
    code: p.code,
    description: p.description,
    product_id: p.productId,
    product_name: p.productId ? prodMap.get(p.productId)?.name || null : null,
    interval: p.interval,
    base_price: Number(p.basePrice),
    cost_price: Number(p.costPrice),
    proration_rule: p.prorationRule,
    allow_mid_cycle_changes: p.allowMidCycleChanges,
    cancellation_policy: p.cancellationPolicy,
    refund_percentage: Number(p.refundPercentage),
    notice_period_days: p.noticePeriodDays,
    is_active: p.isActive,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  }));
}

export async function getSubscriptionPlanById(id: number) {
  const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id)).limit(1);
  if (!plan) throw ApiError.notFound(`Subscription plan with ID ${id} not found`);

  let productName = null;
  if (plan.productId) {
    const [prod] = await db.select().from(products).where(eq(products.id, plan.productId)).limit(1);
    productName = prod?.name || null;
  }

  return {
    id: plan.id,
    name: plan.name,
    code: plan.code,
    description: plan.description,
    product_id: plan.productId,
    product_name: productName,
    interval: plan.interval,
    base_price: Number(plan.basePrice),
    cost_price: Number(plan.costPrice),
    proration_rule: plan.prorationRule,
    allow_mid_cycle_changes: plan.allowMidCycleChanges,
    cancellation_policy: plan.cancellationPolicy,
    refund_percentage: Number(plan.refundPercentage),
    notice_period_days: plan.noticePeriodDays,
    is_active: plan.isActive,
    created_at: plan.createdAt,
    updated_at: plan.updatedAt,
  };
}

export async function createSubscriptionPlan(data: {
  name: string;
  code?: string;
  description?: string;
  product_id?: number;
  interval?: string;
  base_price: number;
  cost_price?: number;
  proration_rule?: string;
  allow_mid_cycle_changes?: boolean;
  cancellation_policy?: string;
  refund_percentage?: number;
  notice_period_days?: number;
  is_active?: boolean;
}) {
  let productId = data.product_id;

  if (productId) {
    const [existingProd] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!existingProd) throw ApiError.badRequest(`Product with ID ${productId} not found`);
    await db
      .update(products)
      .set({
        isRecurring: true,
        recurringInterval: data.interval || "monthly",
      })
      .where(eq(products.id, productId));
  } else {
    // Automatically provision product in Subscriptions category
    let [subCat] = await db.select().from(productCategories).where(eq(productCategories.name, "Subscriptions")).limit(1);
    if (!subCat) {
      const [firstCat] = await db.select().from(productCategories).limit(1);
      subCat = firstCat;
    }
    if (!subCat) {
      const [newCat] = await db.insert(productCategories).values({ name: "Subscriptions", maxDiscountPct: "30.00" }).returning();
      subCat = newCat;
    }

    const intervalUnit = data.interval === "yearly" ? "year" : data.interval === "quarterly" ? "quarter" : "month";
    const [newProd] = await db.insert(products).values({
      name: data.name,
      description: data.description || `Recurring subscription: ${data.name}`,
      categoryId: subCat.id,
      basePrice: String(data.base_price),
      costPrice: String(data.cost_price || 0),
      isRecurring: true,
      recurringInterval: data.interval || "monthly",
      unit: intervalUnit,
    }).returning();
    productId = newProd.id;
  }

  const [createdPlan] = await db.insert(subscriptionPlans).values({
    name: data.name,
    code: data.code || null,
    description: data.description || null,
    productId,
    interval: data.interval || "monthly",
    basePrice: String(data.base_price),
    costPrice: String(data.cost_price || 0),
    prorationRule: data.proration_rule || "exact_day",
    allowMidCycleChanges: data.allow_mid_cycle_changes ?? true,
    cancellationPolicy: data.cancellation_policy || "prorated_refund",
    refundPercentage: String(data.refund_percentage ?? 100),
    noticePeriodDays: data.notice_period_days ?? 0,
    isActive: data.is_active ?? true,
  }).returning();

  return getSubscriptionPlanById(createdPlan.id);
}

export async function updateSubscriptionPlan(
  id: number,
  data: Partial<{
    name: string;
    code: string;
    description: string;
    product_id: number;
    interval: string;
    base_price: number;
    cost_price: number;
    proration_rule: string;
    allow_mid_cycle_changes: boolean;
    cancellation_policy: string;
    refund_percentage: number;
    notice_period_days: number;
    is_active: boolean;
  }>
) {
  const [existing] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id)).limit(1);
  if (!existing) throw ApiError.notFound(`Subscription plan with ID ${id} not found`);

  const updates: any = { updatedAt: new Date() };
  if (data.name !== undefined) updates.name = data.name;
  if (data.code !== undefined) updates.code = data.code;
  if (data.description !== undefined) updates.description = data.description;
  if (data.product_id !== undefined) updates.productId = data.product_id;
  if (data.interval !== undefined) updates.interval = data.interval;
  if (data.base_price !== undefined) updates.basePrice = String(data.base_price);
  if (data.cost_price !== undefined) updates.costPrice = String(data.cost_price);
  if (data.proration_rule !== undefined) updates.prorationRule = data.proration_rule;
  if (data.allow_mid_cycle_changes !== undefined) updates.allowMidCycleChanges = data.allow_mid_cycle_changes;
  if (data.cancellation_policy !== undefined) updates.cancellationPolicy = data.cancellation_policy;
  if (data.refund_percentage !== undefined) updates.refundPercentage = String(data.refund_percentage);
  if (data.notice_period_days !== undefined) updates.noticePeriodDays = data.notice_period_days;
  if (data.is_active !== undefined) updates.isActive = data.is_active;

  await db.update(subscriptionPlans).set(updates).where(eq(subscriptionPlans.id, id));
  return getSubscriptionPlanById(id);
}

export async function deleteSubscriptionPlan(id: number) {
  const [existing] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id)).limit(1);
  if (!existing) throw ApiError.notFound(`Subscription plan with ID ${id} not found`);

  await db.delete(subscriptionPlans).where(eq(subscriptionPlans.id, id));
  return { message: "Subscription plan deleted successfully" };
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

