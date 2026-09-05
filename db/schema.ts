import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  numeric,
  date,
  jsonb,
  char,
  primaryKey,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================================
// 1. USERS / AUTHENTICATION / AUTHORIZATION
// ============================================================================

/**
 * Users — both internal (admin/sales/finance/ops) and customer portal users.
 * user_type discriminates access: INTERNAL vs CUSTOMER.
 * email should use citext extension in production for case-insensitive uniqueness.
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash"),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  userType: varchar("user_type", { length: 20 }).notNull(), // INTERNAL | CUSTOMER
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Roles: ADMIN, SALES_REP, SALES_MANAGER, FINANCE, OPERATIONS, CUSTOMER_USER
 */
export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  roleType: varchar("role_type", { length: 20 }).notNull(), // INTERNAL | CUSTOMER
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Granular permissions: resource.action format (e.g. quotation.create, invoice.void)
 */
export const permissions = pgTable("permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 100 }).notNull().unique(),
  resource: varchar("resource", { length: 50 }).notNull(),
  action: varchar("action", { length: 50 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * M:N join — assigns roles to users
 */
export const userRoles = pgTable("user_roles", {
  userId: uuid("user_id").notNull().references(() => users.id),
  roleId: uuid("role_id").notNull().references(() => roles.id),
  assignedBy: uuid("assigned_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.roleId] }),
}));

/**
 * M:N join — assigns permissions to roles
 */
export const rolePermissions = pgTable("role_permissions", {
  roleId: uuid("role_id").notNull().references(() => roles.id),
  permissionId: uuid("permission_id").notNull().references(() => permissions.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.roleId, t.permissionId] }),
}));

// ============================================================================
// 2. SALES ORGANIZATION
// ============================================================================

/**
 * Sales teams managed by a sales manager
 */
export const salesTeams = pgTable("sales_teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 150 }).notNull().unique(),
  managerUserId: uuid("manager_user_id").notNull().references(() => users.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * M:N — reps belong to teams. left_at tracks historical membership.
 */
export const salesTeamMembers = pgTable("sales_team_members", {
  teamId: uuid("team_id").notNull().references(() => salesTeams.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  leftAt: timestamp("left_at", { withTimezone: true }),
}, (t) => ({
  pk: primaryKey({ columns: [t.teamId, t.userId] }),
}));

// ============================================================================
// 3. CUSTOMERS
// ============================================================================

/**
 * Customer tiers: Bronze, Silver, Gold, Platinum — each with default discount limits
 */
export const customerTiers = pgTable("customer_tiers", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  defaultDiscountLimit: numeric("default_discount_limit", { precision: 7, scale: 4 }).notNull().default("0"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Customer companies — tied to a tier, with billing/shipping addresses as JSONB
 */
export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerCode: varchar("customer_code", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  customerTierId: uuid("customer_tier_id").notNull().references(() => customerTiers.id),
  currency: char("currency", { length: 3 }).notNull(),
  billingEmail: varchar("billing_email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  billingAddress: jsonb("billing_address"),
  shippingAddress: jsonb("shipping_address"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Links portal users to customer companies. is_primary marks the main contact.
 */
export const customerUsers = pgTable("customer_users", {
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.customerId, t.userId] }),
}));

// ============================================================================
// 4. PRODUCT CATALOG
// ============================================================================

export const productCategories = pgTable("product_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 150 }).notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Products — cost_price is INTERNAL ONLY, never exposed to customer APIs.
 * product_type: ONE_TIME | SERVICE | SUBSCRIPTION | HYBRID
 */
export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  sku: varchar("sku", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  categoryId: uuid("category_id").notNull().references(() => productCategories.id),
  description: text("description"),
  unit: varchar("unit", { length: 50 }).notNull(),
  basePrice: numeric("base_price", { precision: 19, scale: 4 }).notNull(),
  costPrice: numeric("cost_price", { precision: 19, scale: 4 }).notNull(), // INTERNAL ONLY
  taxRate: numeric("tax_rate", { precision: 7, scale: 4 }).notNull().default("0"),
  productType: varchar("product_type", { length: 30 }).notNull(), // ONE_TIME | SERVICE | SUBSCRIPTION | HYBRID
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Variants add price/cost deltas on top of the base product
 */
export const productVariants = pgTable("product_variants", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").notNull().references(() => products.id),
  sku: varchar("sku", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  priceDelta: numeric("price_delta", { precision: 19, scale: 4 }).notNull().default("0"),
  costDelta: numeric("cost_delta", { precision: 19, scale: 4 }).notNull().default("0"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * EAV attributes for variants (e.g. Size=XL, Pack=10-Pack)
 * UNIQUE(variant_id, attribute_name)
 */
export const productVariantAttributes = pgTable("product_variant_attributes", {
  id: uuid("id").primaryKey().defaultRandom(),
  variantId: uuid("variant_id").notNull().references(() => productVariants.id),
  attributeName: varchar("attribute_name", { length: 100 }).notNull(),
  attributeValue: varchar("attribute_value", { length: 200 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), // FIX: added per global rule
}, (t) => ({
  unq: unique().on(t.variantId, t.attributeName),
}));

// ============================================================================
// 5. PRICE LISTS
// ============================================================================

/**
 * Price lists can target a specific customer tier and have validity windows
 */
export const priceLists = pgTable("price_lists", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 150 }).notNull(),
  currency: char("currency", { length: 3 }).notNull(),
  customerTierId: uuid("customer_tier_id").references(() => customerTiers.id),
  isActive: boolean("is_active").notNull().default(true),
  validFrom: timestamp("valid_from", { withTimezone: true }),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Per-product override prices within a price list.
 * Quotation lines MUST snapshot the selected price — changes here don't alter existing quotes.
 */
export const priceListItems = pgTable("price_list_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  priceListId: uuid("price_list_id").notNull().references(() => priceLists.id),
  productId: uuid("product_id").notNull().references(() => products.id),
  variantId: uuid("variant_id").references(() => productVariants.id),
  unitPrice: numeric("unit_price", { precision: 19, scale: 4 }).notNull(),
  currency: char("currency", { length: 3 }).notNull(),
  validFrom: timestamp("valid_from", { withTimezone: true }),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// 6. DISCOUNT GOVERNANCE
// ============================================================================

/**
 * Discount bands per customer tier — defines risk levels for approval routing
 */
export const discountTiers = pgTable("discount_tiers", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerTierId: uuid("customer_tier_id").notNull().references(() => customerTiers.id),
  name: varchar("name", { length: 100 }).notNull(),
  minDiscount: numeric("min_discount", { precision: 7, scale: 4 }).notNull(),
  maxDiscount: numeric("max_discount", { precision: 7, scale: 4 }).notNull(),
  riskLevel: integer("risk_level").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Category-specific discount ceilings per tier (e.g. Hardware=15%, Service=10%)
 * UNIQUE(customer_tier_id, category_id)
 */
export const categoryDiscountLimits = pgTable("category_discount_limits", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerTierId: uuid("customer_tier_id").notNull().references(() => customerTiers.id),
  categoryId: uuid("category_id").notNull().references(() => productCategories.id),
  maxDiscount: numeric("max_discount", { precision: 7, scale: 4 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  unq: unique().on(t.customerTierId, t.categoryId),
}));

/**
 * Approval chain rules: risk score ranges mapped to required roles in sequence.
 * E.g. risk 10-30 → SALES_MANAGER (seq 1), risk 30-100 → SALES_MANAGER (seq 1) + FINANCE (seq 2)
 */
export const approvalRules = pgTable("approval_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 150 }).notNull(),
  minRiskScore: numeric("min_risk_score", { precision: 10, scale: 4 }).notNull(),
  maxRiskScore: numeric("max_risk_score", { precision: 10, scale: 4 }).notNull(),
  requiredRoleId: uuid("required_role_id").notNull().references(() => roles.id),
  sequenceNo: integer("sequence_no").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// 7. QUOTATIONS (Core Deal Engine)
// ============================================================================

/**
 * Quotation header — the living deal document.
 * margin_amount/percent and risk_score are INTERNAL ONLY.
 * version increments on re-approval cycles.
 */
export const quotations = pgTable("quotations", {
  id: uuid("id").primaryKey().defaultRandom(),
  quotationNumber: varchar("quotation_number", { length: 100 }).notNull().unique(),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  salesRepId: uuid("sales_rep_id").notNull().references(() => users.id),
  salesTeamId: uuid("sales_team_id").notNull().references(() => salesTeams.id),
  priceListId: uuid("price_list_id").references(() => priceLists.id),
  currency: char("currency", { length: 3 }).notNull(),
  status: varchar("status", { length: 40 }).notNull(), // DRAFT | PENDING_APPROVAL | APPROVED | REJECTED | RETURNED_FOR_REVISION | SENT | UNDER_NEGOTIATION | CONFIRMED | EXPIRED | CANCELLED
  subtotal: numeric("subtotal", { precision: 19, scale: 4 }).notNull().default("0"),
  discountTotal: numeric("discount_total", { precision: 19, scale: 4 }).notNull().default("0"),
  taxTotal: numeric("tax_total", { precision: 19, scale: 4 }).notNull().default("0"),
  total: numeric("total", { precision: 19, scale: 4 }).notNull().default("0"),
  marginAmount: numeric("margin_amount", { precision: 19, scale: 4 }).notNull().default("0"), // INTERNAL
  marginPercent: numeric("margin_percent", { precision: 7, scale: 4 }).notNull().default("0"), // INTERNAL
  riskScore: numeric("risk_score", { precision: 10, scale: 4 }).notNull().default("0"), // INTERNAL
  version: integer("version").notNull().default(1),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
});

/**
 * Quotation line items — each line snapshots pricing, discount, cost, margin, and risk.
 * cost_price, allowed_discount, excess_discount, risk_score are INTERNAL ONLY.
 * UNIQUE(quotation_id, line_number)
 */
export const quotationLines = pgTable("quotation_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  quotationId: uuid("quotation_id").notNull().references(() => quotations.id),
  productId: uuid("product_id").notNull().references(() => products.id),
  variantId: uuid("variant_id").references(() => productVariants.id),
  lineNumber: integer("line_number").notNull(),
  description: text("description"),
  quantity: numeric("quantity", { precision: 19, scale: 4 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 19, scale: 4 }).notNull(),
  costPrice: numeric("cost_price", { precision: 19, scale: 4 }).notNull(), // INTERNAL
  grossAmount: numeric("gross_amount", { precision: 19, scale: 4 }).notNull(),
  discountPercent: numeric("discount_percent", { precision: 7, scale: 4 }).notNull().default("0"),
  discountAmount: numeric("discount_amount", { precision: 19, scale: 4 }).notNull().default("0"),
  taxRate: numeric("tax_rate", { precision: 7, scale: 4 }).notNull().default("0"),
  taxAmount: numeric("tax_amount", { precision: 19, scale: 4 }).notNull().default("0"),
  netAmount: numeric("net_amount", { precision: 19, scale: 4 }).notNull(),
  allowedDiscount: numeric("allowed_discount", { precision: 7, scale: 4 }).notNull(), // INTERNAL — snapshotted ceiling
  excessDiscount: numeric("excess_discount", { precision: 7, scale: 4 }).notNull().default("0"), // INTERNAL
  riskScore: numeric("risk_score", { precision: 10, scale: 4 }).notNull().default("0"), // INTERNAL
  lineType: varchar("line_type", { length: 20 }).notNull(), // ONE_TIME | RECURRING
  subscriptionPlanId: uuid("subscription_plan_id").references(() => subscriptionPlans.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  unq: unique().on(t.quotationId, t.lineNumber),
}));

// ============================================================================
// 8. QUOTATION APPROVAL WORKFLOW
// ============================================================================

/**
 * Each approval step in the chain. Sequence enforced — step N waits for N-1.
 * UNIQUE(quotation_id, sequence_no)
 */
export const quotationApprovals = pgTable("quotation_approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  quotationId: uuid("quotation_id").notNull().references(() => quotations.id),
  sequenceNo: integer("sequence_no").notNull(),
  requiredRoleId: uuid("required_role_id").notNull().references(() => roles.id),
  assignedUserId: uuid("assigned_user_id").references(() => users.id),
  status: varchar("status", { length: 30 }).notNull(), // PENDING | APPROVED | REJECTED | RETURNED | SKIPPED
  riskScore: numeric("risk_score", { precision: 10, scale: 4 }).notNull(), // snapshot at creation
  decision: varchar("decision", { length: 30 }), // APPROVE | REJECT | RETURN
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  actedAt: timestamp("acted_at", { withTimezone: true }),
}, (t) => ({
  unq: unique().on(t.quotationId, t.sequenceNo),
}));

// ============================================================================
// 9. QUOTATION EVENTS / INTERNAL AUDIT (append-only)
// ============================================================================

export const quotationEvents = pgTable("quotation_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  quotationId: uuid("quotation_id").notNull().references(() => quotations.id),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  eventType: varchar("event_type", { length: 60 }).notNull(), // CREATED | UPDATED | LINE_ADDED | LINE_REMOVED | DISCOUNT_CHANGED | SUBMITTED | APPROVAL_REQUESTED | APPROVED | REJECTED | RETURNED | SENT | NEGOTIATION_STARTED | CUSTOMER_CHANGE_REQUESTED | TERMS_CHANGED | REENTERED_APPROVAL | CONFIRMED | CANCELLED
  oldData: jsonb("old_data"),
  newData: jsonb("new_data"),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// 10. CUSTOMER NEGOTIATION
// ============================================================================

/**
 * Customer-initiated change requests on quotation lines (discount counter, qty change, etc.)
 */
export const quotationChangeRequests = pgTable("quotation_change_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  quotationId: uuid("quotation_id").notNull().references(() => quotations.id),
  customerUserId: uuid("customer_user_id").notNull().references(() => users.id),
  quotationLineId: uuid("quotation_line_id").references(() => quotationLines.id),
  requestType: varchar("request_type", { length: 40 }).notNull(), // DISCOUNT | QUANTITY | PRODUCT | PRICE | OTHER
  requestedDiscount: numeric("requested_discount", { precision: 7, scale: 4 }),
  requestedQuantity: numeric("requested_quantity", { precision: 19, scale: 4 }),
  requestedPrice: numeric("requested_price", { precision: 19, scale: 4 }),
  reason: text("reason"),
  status: varchar("status", { length: 30 }).notNull(), // OPEN | ACCEPTED | REJECTED | SUPERSEDED | WITHDRAWN
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolvedBy: uuid("resolved_by").references(() => users.id),
});

/**
 * Line-level comments — is_customer_visible controls internal vs portal visibility
 */
export const quotationLineComments = pgTable("quotation_line_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  quotationId: uuid("quotation_id").notNull().references(() => quotations.id),
  quotationLineId: uuid("quotation_line_id").notNull().references(() => quotationLines.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  comment: text("comment").notNull(),
  isCustomerVisible: boolean("is_customer_visible").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Customer-visible timeline events on a quotation (status changes, messages)
 */
export const quotationPublicEvents = pgTable("quotation_public_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  quotationId: uuid("quotation_id").notNull().references(() => quotations.id),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// 11. ORDERS
// ============================================================================

/**
 * Orders are created ONLY from CONFIRMED quotations. 1:1 quotation→order.
 * All commercial values are immutable snapshots.
 */
export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderNumber: varchar("order_number", { length: 100 }).notNull().unique(),
  quotationId: uuid("quotation_id").notNull().unique().references(() => quotations.id),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  salesRepId: uuid("sales_rep_id").notNull().references(() => users.id),
  salesTeamId: uuid("sales_team_id").notNull().references(() => salesTeams.id),
  currency: char("currency", { length: 3 }).notNull(),
  status: varchar("status", { length: 40 }).notNull(), // CONFIRMED | FULFILLING | PARTIALLY_FULFILLED | FULFILLED | CANCELLED
  subtotal: numeric("subtotal", { precision: 19, scale: 4 }).notNull(),
  discountTotal: numeric("discount_total", { precision: 19, scale: 4 }).notNull(),
  taxTotal: numeric("tax_total", { precision: 19, scale: 4 }).notNull(),
  total: numeric("total", { precision: 19, scale: 4 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }).notNull(),
});

/**
 * Order line items — snapshots of quotation lines. UNIQUE(order_id, line_number)
 */
export const orderLines = pgTable("order_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id),
  quotationLineId: uuid("quotation_line_id").notNull().references(() => quotationLines.id),
  lineNumber: integer("line_number").notNull(),
  productId: uuid("product_id").notNull().references(() => products.id),
  variantId: uuid("variant_id").references(() => productVariants.id),
  description: text("description"),
  quantity: numeric("quantity", { precision: 19, scale: 4 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 19, scale: 4 }).notNull(),
  costPrice: numeric("cost_price", { precision: 19, scale: 4 }).notNull(), // INTERNAL
  discountAmount: numeric("discount_amount", { precision: 19, scale: 4 }).notNull(),
  taxAmount: numeric("tax_amount", { precision: 19, scale: 4 }).notNull(),
  netAmount: numeric("net_amount", { precision: 19, scale: 4 }).notNull(),
  lineType: varchar("line_type", { length: 20 }).notNull(), // ONE_TIME | RECURRING
  subscriptionPlanId: uuid("subscription_plan_id").references(() => subscriptionPlans.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  unq: unique().on(t.orderId, t.lineNumber),
}));

// ============================================================================
// 12. WAREHOUSES
// ============================================================================

export const warehouses = pgTable("warehouses", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 150 }).notNull(),
  address: jsonb("address"),
  shippingCostWeight: numeric("shipping_cost_weight", { precision: 19, scale: 4 }).notNull().default("1"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Per-warehouse per-product inventory. available = on_hand - reserved (computed).
 * UNIQUE(warehouse_id, product_id, variant_id)
 */
export const warehouseInventory = pgTable("warehouse_inventory", {
  id: uuid("id").primaryKey().defaultRandom(),
  warehouseId: uuid("warehouse_id").notNull().references(() => warehouses.id),
  productId: uuid("product_id").notNull().references(() => products.id),
  variantId: uuid("variant_id").references(() => productVariants.id),
  quantityOnHand: numeric("quantity_on_hand", { precision: 19, scale: 4 }).notNull().default("0"),
  quantityReserved: numeric("quantity_reserved", { precision: 19, scale: 4 }).notNull().default("0"),
  reorderLevel: numeric("reorder_level", { precision: 19, scale: 4 }).notNull().default("0"),
  reorderQuantity: numeric("reorder_quantity", { precision: 19, scale: 4 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), // FIX: added per global rule
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// 13. FULFILLMENT
// ============================================================================

export const fulfillmentOrders = pgTable("fulfillment_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id),
  status: varchar("status", { length: 40 }).notNull(), // PLANNED | PARTIALLY_FULFILLED | FULFILLED | CANCELLED
  isSystemGenerated: boolean("is_system_generated").notNull().default(true),
  estimatedShipmentCount: integer("estimated_shipment_count").notNull().default(0),
  estimatedShippingCost: numeric("estimated_shipping_cost", { precision: 19, scale: 4 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Per-warehouse allocation for each order line within a fulfillment order
 */
export const fulfillmentLines = pgTable("fulfillment_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  fulfillmentOrderId: uuid("fulfillment_order_id").notNull().references(() => fulfillmentOrders.id),
  orderLineId: uuid("order_line_id").notNull().references(() => orderLines.id),
  warehouseId: uuid("warehouse_id").notNull().references(() => warehouses.id),
  quantityAllocated: numeric("quantity_allocated", { precision: 19, scale: 4 }).notNull(),
  quantityFulfilled: numeric("quantity_fulfilled", { precision: 19, scale: 4 }).notNull().default("0"),
  status: varchar("status", { length: 30 }).notNull(), // ALLOCATED | PARTIALLY_FULFILLED | FULFILLED | CANCELLED
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// 14. BACKORDERS
// ============================================================================

export const backorders = pgTable("backorders", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderLineId: uuid("order_line_id").notNull().references(() => orderLines.id),
  quantityBackordered: numeric("quantity_backordered", { precision: 19, scale: 4 }).notNull(),
  quantityRemaining: numeric("quantity_remaining", { precision: 19, scale: 4 }).notNull(),
  status: varchar("status", { length: 40 }).notNull(), // OPEN | PARTIALLY_RESOLVED | RESOLVED | CANCELLED
  expectedDate: date("expected_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

// ============================================================================
// 15. SUBSCRIPTION PLANS
// ============================================================================

export const subscriptionPlans = pgTable("subscription_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 150 }).notNull(),
  billingInterval: varchar("billing_interval", { length: 20 }).notNull(), // MONTH | QUARTER | YEAR
  intervalCount: integer("interval_count").notNull().default(1),
  prorationEnabled: boolean("proration_enabled").notNull().default(true),
  cancellationPolicy: jsonb("cancellation_policy").notNull().default({}),
  refundPolicy: jsonb("refund_policy").notNull().default({}),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * M:N — which products can use which subscription plans
 */
export const productSubscriptionPlans = pgTable("product_subscription_plans", {
  productId: uuid("product_id").notNull().references(() => products.id),
  planId: uuid("plan_id").notNull().references(() => subscriptionPlans.id),
  isDefault: boolean("is_default").notNull().default(false),
}, (t) => ({
  pk: primaryKey({ columns: [t.productId, t.planId] }),
}));

// ============================================================================
// 16. CUSTOMER SUBSCRIPTIONS
// ============================================================================

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  subscriptionNumber: varchar("subscription_number", { length: 100 }).notNull().unique(),
  orderId: uuid("order_id").notNull().references(() => orders.id),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  status: varchar("status", { length: 30 }).notNull(), // ACTIVE | PAUSED | CANCELLED | EXPIRED
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  nextBillingDate: date("next_billing_date"),
  currency: char("currency", { length: 3 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
});

export const subscriptionLines = pgTable("subscription_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  subscriptionId: uuid("subscription_id").notNull().references(() => subscriptions.id),
  orderLineId: uuid("order_line_id").notNull().references(() => orderLines.id),
  productId: uuid("product_id").notNull().references(() => products.id),
  planId: uuid("plan_id").notNull().references(() => subscriptionPlans.id),
  quantity: numeric("quantity", { precision: 19, scale: 4 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 19, scale: 4 }).notNull(),
  currentPeriodStart: date("current_period_start").notNull(),
  currentPeriodEnd: date("current_period_end").notNull(),
  status: varchar("status", { length: 30 }).notNull(), // ACTIVE | PAUSED | CANCELLED
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// 17. BILLING
// ============================================================================

/**
 * One row per billing event. Immutable after invoicing.
 */
export const billingSchedules = pgTable("billing_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  subscriptionId: uuid("subscription_id").notNull().references(() => subscriptions.id),
  subscriptionLineId: uuid("subscription_line_id").notNull().references(() => subscriptionLines.id),
  billingDate: date("billing_date").notNull(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  quantity: numeric("quantity", { precision: 19, scale: 4 }).notNull(),
  baseAmount: numeric("base_amount", { precision: 19, scale: 4 }).notNull(),
  prorationAmount: numeric("proration_amount", { precision: 19, scale: 4 }).notNull().default("0"),
  taxAmount: numeric("tax_amount", { precision: 19, scale: 4 }).notNull().default("0"),
  totalAmount: numeric("total_amount", { precision: 19, scale: 4 }).notNull(),
  status: varchar("status", { length: 30 }).notNull(), // PENDING | INVOICED | PAID | FAILED | CANCELLED
  invoiceId: uuid("invoice_id").references(() => invoices.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// 18. INVOICES
// ============================================================================

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceNumber: varchar("invoice_number", { length: 100 }).notNull().unique(),
  orderId: uuid("order_id").notNull().references(() => orders.id),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  invoiceType: varchar("invoice_type", { length: 30 }).notNull(), // ONE_TIME | RECURRING | MIXED
  subtotal: numeric("subtotal", { precision: 19, scale: 4 }).notNull(),
  taxTotal: numeric("tax_total", { precision: 19, scale: 4 }).notNull(),
  total: numeric("total", { precision: 19, scale: 4 }).notNull(),
  amountPaid: numeric("amount_paid", { precision: 19, scale: 4 }).notNull().default("0"),
  amountDue: numeric("amount_due", { precision: 19, scale: 4 }).notNull(),
  status: varchar("status", { length: 30 }).notNull(), // DRAFT | ISSUED | PARTIALLY_PAID | PAID | VOID | OVERDUE
  issuedAt: timestamp("issued_at", { withTimezone: true }),
  dueDate: date("due_date"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Invoice line items — linked to either an order_line (one-time) or billing_schedule (recurring)
 */
export const invoiceLines = pgTable("invoice_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id").notNull().references(() => invoices.id),
  orderLineId: uuid("order_line_id").references(() => orderLines.id),
  billingScheduleId: uuid("billing_schedule_id").references(() => billingSchedules.id),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 19, scale: 4 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 19, scale: 4 }).notNull(),
  amount: numeric("amount", { precision: 19, scale: 4 }).notNull(),
  taxAmount: numeric("tax_amount", { precision: 19, scale: 4 }).notNull().default("0"),
  totalAmount: numeric("total_amount", { precision: 19, scale: 4 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// 19. PAYMENTS
// ============================================================================

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id").notNull().references(() => invoices.id),
  amount: numeric("amount", { precision: 19, scale: 4 }).notNull(),
  currency: char("currency", { length: 3 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 40 }).notNull(), // CASH | CARD | BANK_TRANSFER | UPI | OTHER
  transactionReference: varchar("transaction_reference", { length: 200 }),
  status: varchar("status", { length: 30 }).notNull(), // PENDING | SUCCESS | FAILED | REFUNDED
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// 20. CREDIT NOTES
// ============================================================================

export const creditNotes = pgTable("credit_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  creditNoteNumber: varchar("credit_note_number", { length: 100 }).notNull().unique(),
  invoiceId: uuid("invoice_id").notNull().references(() => invoices.id),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  subscriptionId: uuid("subscription_id").references(() => subscriptions.id),
  amount: numeric("amount", { precision: 19, scale: 4 }).notNull(),
  reason: text("reason").notNull(),
  status: varchar("status", { length: 30 }).notNull(), // DRAFT | ISSUED | APPLIED | VOID
  createdBy: uuid("created_by").notNull().references(() => users.id),
  approvedBy: uuid("approved_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// 21. UPSELL / CROSS-SELL
// ============================================================================

/**
 * Product pairing rules for recommendations. min_margin_percent gates suggestions.
 */
export const recommendationRules = pgTable("recommendation_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceProductId: uuid("source_product_id").notNull().references(() => products.id),
  suggestedProductId: uuid("suggested_product_id").notNull().references(() => products.id),
  ruleType: varchar("rule_type", { length: 30 }).notNull(), // UPSELL | CROSS_SELL
  score: numeric("score", { precision: 12, scale: 6 }).notNull().default("0"),
  minMarginPercent: numeric("min_margin_percent", { precision: 7, scale: 4 }).notNull().default("0"),
  isPromoted: boolean("is_promoted").notNull().default(false),
  priority: integer("priority").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Tracks what was shown/added/dismissed during quotation building
 */
export const recommendationEvents = pgTable("recommendation_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  quotationId: uuid("quotation_id").notNull().references(() => quotations.id),
  quotationLineId: uuid("quotation_line_id").references(() => quotationLines.id),
  suggestedProductId: uuid("suggested_product_id").notNull().references(() => products.id),
  action: varchar("action", { length: 30 }).notNull(), // SHOWN | ADDED | DISMISSED
  marginDelta: numeric("margin_delta", { precision: 19, scale: 4 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// 22. DEAL HEALTH
// ============================================================================

export const dealAlerts = pgTable("deal_alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  quotationId: uuid("quotation_id").notNull().references(() => quotations.id),
  alertType: varchar("alert_type", { length: 40 }).notNull(), // STALLED | DISCOUNT_ANOMALY | DELIVERY_SLIPPAGE | HIGH_RISK
  severity: varchar("severity", { length: 20 }).notNull(), // LOW | MEDIUM | HIGH | CRITICAL
  message: text("message").notNull(),
  detectedValue: numeric("detected_value", { precision: 19, scale: 4 }),
  thresholdValue: numeric("threshold_value", { precision: 19, scale: 4 }),
  status: varchar("status", { length: 30 }).notNull(), // OPEN | ACKNOWLEDGED | RESOLVED
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolvedBy: uuid("resolved_by").references(() => users.id),
});

/**
 * Per-rep discount history for anomaly baseline calculation
 */
export const salesRepDiscountHistory = pgTable("sales_rep_discount_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  salesRepId: uuid("sales_rep_id").notNull().references(() => users.id),
  quotationId: uuid("quotation_id").notNull().references(() => quotations.id),
  discountPercent: numeric("discount_percent", { precision: 7, scale: 4 }).notNull(),
  discountAmount: numeric("discount_amount", { precision: 19, scale: 4 }).notNull(),
  quotationTotal: numeric("quotation_total", { precision: 19, scale: 4 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// 23. GLOBAL AUDIT (append-only — NO UPDATE, NO DELETE)
// ============================================================================

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  entityType: varchar("entity_type", { length: 100 }).notNull(),
  entityId: uuid("entity_id").notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  oldData: jsonb("old_data"),
  newData: jsonb("new_data"),
  reason: text("reason"),
  ipAddress: varchar("ip_address", { length: 45 }), // FIX: varchar instead of inet (no native Drizzle inet type)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// ZOD SCHEMAS & TYPE INFERENCE
// ============================================================================

export const insertUserSchema = createInsertSchema(users, {
  firstName: (schema) => schema.min(1, "First name is required"),
  lastName: (schema) => schema.min(1, "Last name is required"),
  email: (schema) => schema.email("Invalid email address"),
});
export const selectUserSchema = createSelectSchema(users);
export type User = z.infer<typeof selectUserSchema>;
export type NewUser = z.infer<typeof insertUserSchema>;

export const insertQuotationSchema = createInsertSchema(quotations);
export const selectQuotationSchema = createSelectSchema(quotations);
export type Quotation = z.infer<typeof selectQuotationSchema>;

export const insertOrderSchema = createInsertSchema(orders);
export const selectOrderSchema = createSelectSchema(orders);
export type Order = z.infer<typeof selectOrderSchema>;

export const insertProductSchema = createInsertSchema(products);
export const selectProductSchema = createSelectSchema(products);
export type Product = z.infer<typeof selectProductSchema>;

export const insertCustomerSchema = createInsertSchema(customers);
export const selectCustomerSchema = createSelectSchema(customers);
export type Customer = z.infer<typeof selectCustomerSchema>;

export const insertInvoiceSchema = createInsertSchema(invoices);
export const selectInvoiceSchema = createSelectSchema(invoices);
export type Invoice = z.infer<typeof selectInvoiceSchema>;
