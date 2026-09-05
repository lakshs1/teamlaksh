import { eq, and, inArray, desc } from "drizzle-orm";
import { db, quotes, approvalLogs, customers, users } from "@db";
import { ApiError } from "../../lib/api-error.js";

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

type ReviewerRole = "manager" | "finance" | "admin";

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
  if (role === "finance") return "finance";
  return "admin";
}

// ═══════════════════════════════════════════════════════════
// READ
// ═══════════════════════════════════════════════════════════

/**
 * Returns quotes pending this reviewer's action, role-gated:
 * - manager → pending_manager queue
 * - finance  → pending_finance queue
 * - admin    → both queues
 */
export async function getPendingApprovals(reviewer: { id: number; role: string }) {
  let statusFilter: string[];

  if (reviewer.role === "manager") {
    statusFilter = [PENDING_MANAGER_STATUS];
  } else if (reviewer.role === "finance") {
    statusFilter = [PENDING_FINANCE_STATUS];
  } else if (reviewer.role === "admin" || reviewer.role === "rep") {
    statusFilter = [PENDING_MANAGER_STATUS, PENDING_FINANCE_STATUS];
  } else {
    throw ApiError.forbidden("Only manager, finance, admin, or rep roles can access the approval queue");
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
    })
    .from(quotes)
    .leftJoin(customers, eq(quotes.customerId, customers.id))
    .where(and(...conditions))
    .orderBy(desc(quotes.updatedAt));

  return rows;
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

  // Validate that this reviewer CAN act on this quote
  if (
    (role === "manager" && quote.status !== PENDING_MANAGER_STATUS) ||
    (role === "finance" && quote.status !== PENDING_FINANCE_STATUS)
  ) {
    throw ApiError.badRequest(
      `Cannot approve a quote with status '${quote.status}' as ${role}. Expected: ${
        role === "manager" ? PENDING_MANAGER_STATUS : PENDING_FINANCE_STATUS
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

  if (role === "finance" || (role === "admin" && quote.status === PENDING_FINANCE_STATUS)) {
    // Finance approval always finalizes
    newStatus = "approved";
  } else if (role === "manager" || (role === "admin" && quote.status === PENDING_MANAGER_STATUS)) {
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
      : `Manager approved — awaiting finance review`;

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

  // Role-status check
  if (role === "manager" && quote.status === PENDING_FINANCE_STATUS) {
    throw ApiError.forbidden("Manager cannot reject a quote in finance review");
  }
  if (role === "finance" && quote.status === PENDING_MANAGER_STATUS) {
    throw ApiError.forbidden("Finance cannot reject a quote in manager review");
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

  // Role-status check
  if (role === "manager" && quote.status === PENDING_FINANCE_STATUS) {
    throw ApiError.forbidden("Manager cannot request revision on a quote in finance review");
  }
  if (role === "finance" && quote.status === PENDING_MANAGER_STATUS) {
    throw ApiError.forbidden("Finance cannot request revision on a quote in manager review");
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
