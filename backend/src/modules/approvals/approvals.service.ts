import { eq, and, inArray, desc } from "drizzle-orm";
import { db, quotes, approvalLogs, customers, users, customerTiers } from "@db";
import { ApiError } from "../../lib/api-error.js";

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

type ReviewerRole = "manager" | "finance" | "operations" | "finance_operations" | "admin";

const PENDING_MANAGER_STATUS = "pending_manager";
const PENDING_FINANCE_STATUS = "pending_finance";

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

async function getQuoteOrThrow(id: number) {
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
  if (!quote) throw ApiError.notFound(`Quote with ID ${id} not found`);
  return quote;
}

function levelForRole(role: ReviewerRole): string {
  if (role === "manager") return "manager";
  if (role === "finance" || role === "operations" || role === "finance_operations") return "finance_operations";
  return "admin";
}

// ═══════════════════════════════════════════════════════════
// READ
// ═══════════════════════════════════════════════════════════

/**
 * Full Approval Governance Queue — returns quotes across all governance states
 * with enriched customer, customer tier, sales rep data, and canAct calculation.
 */
export async function getApprovalsQueue(
  reviewer: { id: number; role: string },
  query: { status?: string; scope?: string } = {}
) {
  const allRows = await db
    .select({
      id: quotes.id,
      quoteNumber: quotes.quoteNumber,
      customerId: quotes.customerId,
      repId: quotes.repId,
      status: quotes.status,
      subtotal: quotes.subtotal,
      totalDiscount: quotes.totalDiscount,
      totalTax: quotes.totalTax,
      grandTotal: quotes.grandTotal,
      blendedRiskScore: quotes.blendedRiskScore,
      approvalRoute: quotes.approvalRoute,
      notes: quotes.notes,
      expiresAt: quotes.expiresAt,
      createdAt: quotes.createdAt,
      updatedAt: quotes.updatedAt,
      customer: {
        id: customers.id,
        name: customers.name,
        email: customers.email,
      },
      tierName: customerTiers.name,
      rep: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
    })
    .from(quotes)
    .leftJoin(customers, eq(quotes.customerId, customers.id))
    .leftJoin(customerTiers, eq(customers.tierId, customerTiers.id))
    .leftJoin(users, eq(quotes.repId, users.id))
    .orderBy(desc(quotes.updatedAt));

  // Determine quotes that are part of the discount approval governance flow
  const governanceQuotes = allRows.filter((q) => {
    const isApprovalStatus = [
      PENDING_MANAGER_STATUS,
      PENDING_FINANCE_STATUS,
      "approved",
      "rejected",
      "revision",
    ].includes(q.status);
    const hasRoute = q.approvalRoute === "manager" || q.approvalRoute === "manager_finance";
    const hasRisk = parseFloat(String(q.blendedRiskScore || "0")) > 0;
    return isApprovalStatus || hasRoute || hasRisk;
  });

  // Calculate canAct and stage per reviewer
  const isManager = reviewer.role === "manager";
  const isFinanceOps =
    reviewer.role === "finance" ||
    reviewer.role === "operations" ||
    reviewer.role === "finance_operations";
  const isAdmin = reviewer.role === "admin";

  const enriched: any[] = governanceQuotes.map((q: any) => {
    const canAct =
      (isAdmin && [PENDING_MANAGER_STATUS, PENDING_FINANCE_STATUS].includes(q.status)) ||
      (isManager && q.status === PENDING_MANAGER_STATUS) ||
      (isFinanceOps && q.status === PENDING_FINANCE_STATUS);

    let currentStage = "approved";
    if (q.status === PENDING_MANAGER_STATUS) currentStage = "manager";
    else if (q.status === PENDING_FINANCE_STATUS) currentStage = "finance";
    else if (q.status === "rejected") currentStage = "rejected";
    else if (q.status === "revision") currentStage = "revision";

    let requiredLevelText = "Level 1: Manager Review";
    if (q.approvalRoute === "manager_finance" || parseFloat(String(q.blendedRiskScore || "0")) > 25) {
      requiredLevelText = "Level 2: Finance & Operations";
    }

    return {
      ...q,
      customer: {
        ...q.customer,
        tier: {
          name: q.tierName || "Standard",
        },
      },
      canAct,
      currentStage,
      requiredLevelText,
    };
  });

  // Overall counts
  const stats = {
    total: enriched.length,
    myQueue: enriched.filter((q: any) => q.canAct).length,
    pendingManager: enriched.filter((q: any) => q.status === PENDING_MANAGER_STATUS).length,
    pendingFinance: enriched.filter((q: any) => q.status === PENDING_FINANCE_STATUS).length,
    approved: enriched.filter((q: any) => q.status === "approved").length,
    rejected: enriched.filter((q: any) => q.status === "rejected").length,
  };

  // Filter application
  let filtered = enriched;
  if (query.scope === "my_queue") {
    filtered = filtered.filter((q: any) => q.canAct);
  } else if (query.status === "pending") {
    filtered = filtered.filter(
      (q: any) => q.status === PENDING_MANAGER_STATUS || q.status === PENDING_FINANCE_STATUS
    );
  } else if (query.status === "approved") {
    filtered = filtered.filter((q: any) => q.status === "approved");
  } else if (query.status === "rejected") {
    filtered = filtered.filter((q: any) => q.status === "rejected");
  }

  return {
    items: filtered,
    stats,
  };
}

/**
 * Returns quotes pending this reviewer's action, role-gated:
 * - manager → pending_manager queue
 * - finance / operations / finance_operations → pending_finance queue
 * - admin → both queues
 */
export async function getPendingApprovals(reviewer: { id: number; role: string }) {
  let statusFilter: string[];

  if (reviewer.role === "manager") {
    statusFilter = [PENDING_MANAGER_STATUS];
  } else if (reviewer.role === "finance" || reviewer.role === "operations" || reviewer.role === "finance_operations") {
    statusFilter = [PENDING_FINANCE_STATUS];
  } else if (reviewer.role === "admin" || reviewer.role === "rep") {
    statusFilter = [PENDING_MANAGER_STATUS, PENDING_FINANCE_STATUS];
  } else {
    throw ApiError.forbidden("Only manager, finance/operations, admin, or rep roles can access the approval queue");
  }

  const conditions = [inArray(quotes.status, statusFilter)];
  if (reviewer.role === "rep") {
    conditions.push(eq(quotes.repId, reviewer.id));
  }

  const rows = await db
    .select({
      id: quotes.id,
      quoteNumber: quotes.quoteNumber,
      customerId: quotes.customerId,
      repId: quotes.repId,
      status: quotes.status,
      subtotal: quotes.subtotal,
      totalDiscount: quotes.totalDiscount,
      grandTotal: quotes.grandTotal,
      blendedRiskScore: quotes.blendedRiskScore,
      approvalRoute: quotes.approvalRoute,
      notes: quotes.notes,
      expiresAt: quotes.expiresAt,
      createdAt: quotes.createdAt,
      updatedAt: quotes.updatedAt,
      customer: {
        id: customers.id,
        name: customers.name,
        email: customers.email,
      },
      tierName: customerTiers.name,
      rep: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
    })
    .from(quotes)
    .leftJoin(customers, eq(quotes.customerId, customers.id))
    .leftJoin(customerTiers, eq(customers.tierId, customerTiers.id))
    .leftJoin(users, eq(quotes.repId, users.id))
    .where(and(...conditions))
    .orderBy(desc(quotes.updatedAt));

  return rows.map((r) => ({
    ...r,
    customer: {
      ...r.customer,
      tier: {
        name: r.tierName || "Standard",
      },
    },
  }));
}

export async function getApprovalLogs(quoteId: number) {
  // Verify quote exists
  await getQuoteOrThrow(quoteId);

  const logs = await db
    .select({
      id: approvalLogs.id,
      quoteId: approvalLogs.quoteId,
      reviewerId: approvalLogs.reviewerId,
      action: approvalLogs.action,
      level: approvalLogs.level,
      reason: approvalLogs.reason,
      createdAt: approvalLogs.createdAt,
    })
    .from(approvalLogs)
    .where(eq(approvalLogs.quoteId, quoteId))
    .orderBy(approvalLogs.createdAt);

  return logs;
}

// ═══════════════════════════════════════════════════════════
// APPROVAL STATE MACHINE
// ═══════════════════════════════════════════════════════════

/**
 * Smart approve — advances state based on role and approval_route:
 *
 * manager reviewing pending_manager:
 *   - If approval_route = 'manager'         → approved
 *   - If approval_route = 'manager_finance' → pending_finance
 *
 * finance reviewing pending_finance:
 *   → approved
 */
export async function approveQuote(
  quoteId: number,
  reviewer: { id: number; role: string },
  data: { reason?: string }
) {
  const quote = await getQuoteOrThrow(quoteId);
  const previousStatus = quote.status;
  const role = reviewer.role as ReviewerRole;
  const isFinanceOps = role === "finance" || role === "operations" || role === "finance_operations";
  const isManager = role === "manager";

  // Validate that this reviewer CAN act on this quote
  if (
    (isManager && quote.status !== PENDING_MANAGER_STATUS) ||
    (isFinanceOps && quote.status !== PENDING_FINANCE_STATUS)
  ) {
    throw ApiError.badRequest(
      `Cannot approve a quote with status '${quote.status}' as ${role}. Expected: ${
        isManager ? PENDING_MANAGER_STATUS : PENDING_FINANCE_STATUS
      }`
    );
  }

  if (role === "admin") {
    // Admin can approve from any pending state
    if (![PENDING_MANAGER_STATUS, PENDING_FINANCE_STATUS].includes(quote.status)) {
      throw ApiError.badRequest(`Cannot approve a quote with status '${quote.status}'`);
    }
  }

  // Determine next state
  let newStatus: string;

  if (isFinanceOps || (role === "admin" && quote.status === PENDING_FINANCE_STATUS)) {
    // Finance/Operations approval always finalizes
    newStatus = "approved";
  } else if (isManager || (role === "admin" && quote.status === PENDING_MANAGER_STATUS)) {
    // Manager: check if we need finance next
    if (quote.approvalRoute === "manager_finance") {
      newStatus = PENDING_FINANCE_STATUS;
    } else {
      // approval_route = 'manager' or 'auto' (shouldn't be here, but handle gracefully)
      newStatus = "approved";
    }
  } else {
    newStatus = "approved";
  }

  await db
    .update(quotes)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(quotes.id, quoteId));

  await db.insert(approvalLogs).values({
    quoteId,
    reviewerId: reviewer.id,
    action: "approved",
    level: levelForRole(role),
    reason: data.reason || null,
  });

  const message =
    newStatus === "approved"
      ? "Quote fully approved"
      : `Manager approved — awaiting finance/operations review`;

  return {
    quoteId,
    previousStatus,
    newStatus,
    action: "approved",
    level: levelForRole(role),
    message,
  };
}

export async function rejectQuote(
  quoteId: number,
  reviewer: { id: number; role: string },
  data: { reason: string }
) {
  const quote = await getQuoteOrThrow(quoteId);
  const previousStatus = quote.status;
  const role = reviewer.role as ReviewerRole;

  const allowedStatuses = [PENDING_MANAGER_STATUS, PENDING_FINANCE_STATUS];
  if (!allowedStatuses.includes(quote.status)) {
    throw ApiError.badRequest(`Cannot reject a quote with status '${quote.status}'`);
  }

  const isFinanceOps = role === "finance" || role === "operations" || role === "finance_operations";
  const isManager = role === "manager";

  // Role-status check
  if (isManager && quote.status === PENDING_FINANCE_STATUS) {
    throw ApiError.forbidden("Manager cannot reject a quote in finance review");
  }
  if (isFinanceOps && quote.status === PENDING_MANAGER_STATUS) {
    throw ApiError.forbidden("Finance/Operations cannot reject a quote in manager review");
  }

  await db
    .update(quotes)
    .set({ status: "rejected", updatedAt: new Date() })
    .where(eq(quotes.id, quoteId));

  await db.insert(approvalLogs).values({
    quoteId,
    reviewerId: reviewer.id,
    action: "rejected",
    level: levelForRole(role),
    reason: data.reason,
  });

  return {
    quoteId,
    previousStatus,
    newStatus: "rejected",
    action: "rejected",
    level: levelForRole(role),
    message: "Quote rejected",
  };
}

export async function reviseQuote(
  quoteId: number,
  reviewer: { id: number; role: string },
  data: { reason: string }
) {
  const quote = await getQuoteOrThrow(quoteId);
  const previousStatus = quote.status;
  const role = reviewer.role as ReviewerRole;

  const allowedStatuses = [PENDING_MANAGER_STATUS, PENDING_FINANCE_STATUS];
  if (!allowedStatuses.includes(quote.status)) {
    throw ApiError.badRequest(`Cannot request revision on a quote with status '${quote.status}'`);
  }

  const isFinanceOps = role === "finance" || role === "operations" || role === "finance_operations";
  const isManager = role === "manager";

  // Role-status check
  if (isManager && quote.status === PENDING_FINANCE_STATUS) {
    throw ApiError.forbidden("Manager cannot request revision on a quote in finance review");
  }
  if (isFinanceOps && quote.status === PENDING_MANAGER_STATUS) {
    throw ApiError.forbidden("Finance/Operations cannot request revision on a quote in manager review");
  }

  // Reset to draft — rep needs to re-edit and resubmit
  await db
    .update(quotes)
    .set({
      status: "draft",
      blendedRiskScore: "0",
      approvalRoute: null,
      updatedAt: new Date(),
    })
    .where(eq(quotes.id, quoteId));

  await db.insert(approvalLogs).values({
    quoteId,
    reviewerId: reviewer.id,
    action: "returned_for_revision",
    level: levelForRole(role),
    reason: data.reason,
  });

  return {
    quoteId,
    previousStatus,
    newStatus: "draft",
    action: "returned_for_revision",
    level: levelForRole(role),
    message: "Quote returned to rep for revision",
  };
}
