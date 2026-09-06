import {
  pgTable,
  serial,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  numeric,
  unique,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================================
// 1. USERS & ROLES
// ============================================================================

export const USER_ROLES = ["admin", "manager", "rep", "finance_operations", "finance", "operations", "customer"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: text("password"),
  role: varchar("role", { length: 50 }).notNull().default("rep"), // admin | manager | rep | finance_operations | finance | operations | customer
  avatarUrl: text("avatar_url"),
  githubUrl: text("github_url"),
  refreshToken: text("refresh_token"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code"),
  leaderId: integer("leader_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  tagline: text("tagline"),
  description: text("description"),
  techStack: jsonb("tech_stack"),
  repoUrl: text("repo_url"),
  demoUrl: text("demo_url"),
  teamId: integer("team_id").references(() => teams.id),
  status: text("status").default("active"),
  upvotes: integer("upvotes").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============================================================================
// 2. CUSTOMERS & TIERS
// ============================================================================

export const customerTiers = pgTable("customer_tiers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(), // Bronze, Silver, Gold, Platinum
  maxDiscountPct: numeric("max_discount_pct", { precision: 5, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  tierId: integer("tier_id").references(() => customerTiers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============================================================================
// 3. PRODUCT CATALOG, VARIANTS & CATEGORIES
// ============================================================================

export const productCategories = pgTable("product_categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(), // Hardware, Services, Subscriptions
  maxDiscountPct: numeric("max_discount_pct", { precision: 5, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  categoryId: integer("category_id")
    .notNull()
    .references(() => productCategories.id, { onDelete: "cascade" }),
  basePrice: numeric("base_price", { precision: 12, scale: 2 }).notNull(),
  costPrice: numeric("cost_price", { precision: 12, scale: 2 }).notNull(), // Internal cost hidden from portal
  unit: varchar("unit", { length: 50 }).notNull().default("unit"), // unit, hour, license, month
  taxPct: numeric("tax_pct", { precision: 5, scale: 2 }).notNull().default("0"),
  isRecurring: boolean("is_recurring").notNull().default(false),
  recurringInterval: varchar("recurring_interval", { length: 50 }), // monthly, quarterly, yearly
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const productVariants = pgTable("product_variants", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  attributeName: varchar("attribute_name", { length: 100 }).notNull(), // Size, Pack, Edition
  attributeValue: varchar("attribute_value", { length: 100 }).notNull(), // Large, 10-pack, Enterprise
  extraPrice: numeric("extra_price", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const priceLists = pgTable("price_lists", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  tierId: integer("tier_id").references(() => customerTiers.id, { onDelete: "set null" }),
  currency: varchar("currency", { length: 10 }).notNull().default("USD"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const priceListItems = pgTable("price_list_items", {
  id: serial("id").primaryKey(),
  priceListId: integer("price_list_id")
    .notNull()
    .references(() => priceLists.id, { onDelete: "cascade" }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============================================================================
// 4. DISCOUNT RULES (Multi-tier Discount Matrix)
// ============================================================================

export const discountRules = pgTable("discount_rules", {
  id: serial("id").primaryKey(),
  tierId: integer("tier_id")
    .notNull()
    .references(() => customerTiers.id, { onDelete: "cascade" }),
  categoryId: integer("category_id")
    .notNull()
    .references(() => productCategories.id, { onDelete: "cascade" }),
  maxDiscountPct: numeric("max_discount_pct", { precision: 5, scale: 2 }).notNull(),
  managerThresholdPct: numeric("manager_threshold_pct", { precision: 5, scale: 2 })
    .notNull()
    .default("0"),
  financeThresholdPct: numeric("finance_threshold_pct", { precision: 5, scale: 2 })
    .notNull()
    .default("5"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============================================================================
// 5. QUOTATIONS & QUOTE LINES
// ============================================================================

export const QUOTE_STATUS = [
  "draft",
  "submitted",
  "pending_manager",
  "pending_finance",
  "approved",
  "fulfillment",
  "confirmed",
  "invoiced",
  "rejected",
  "revision",
] as const;
export type QuoteStatus = (typeof QUOTE_STATUS)[number];

export const quotes = pgTable("quotes", {
  id: serial("id").primaryKey(),
  quoteNumber: varchar("quote_number", { length: 100 }).notNull().unique(), // QT-2026-0001
  customerId: integer("customer_id")
    .notNull()
    .references(() => customers.id),
  repId: integer("rep_id")
    .notNull()
    .references(() => users.id),
  status: varchar("status", { length: 50 }).notNull().default("draft"),
  portalToken: varchar("portal_token", { length: 100 }).unique(), // UUIDv4 for magic link portal
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  totalDiscount: numeric("total_discount", { precision: 12, scale: 2 }).notNull().default("0"),
  totalTax: numeric("total_tax", { precision: 12, scale: 2 }).notNull().default("0"),
  grandTotal: numeric("grand_total", { precision: 12, scale: 2 }).notNull().default("0"),
  blendedRiskScore: numeric("blended_risk_score", { precision: 5, scale: 2 })
    .notNull()
    .default("0"),
  approvalRoute: varchar("approval_route", { length: 50 }), // auto | manager | manager_finance
  notes: text("notes"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const quoteLines = pgTable("quote_lines", {
  id: serial("id").primaryKey(),
  quoteId: integer("quote_id")
    .notNull()
    .references(() => quotes.id, { onDelete: "cascade" }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
  variantId: integer("variant_id").references(() => productVariants.id),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  costPrice: numeric("cost_price", { precision: 12, scale: 2 }).notNull(),
  discountPct: numeric("discount_pct", { precision: 5, scale: 2 }).notNull().default("0"),
  discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  lineTotal: numeric("line_total", { precision: 12, scale: 2 }).notNull(),
  marginPct: numeric("margin_pct", { precision: 5, scale: 2 }).notNull().default("0"),
  allowedDiscountPct: numeric("allowed_discount_pct", { precision: 5, scale: 2 })
    .notNull()
    .default("0"),
  excessPct: numeric("excess_pct", { precision: 5, scale: 2 }).notNull().default("0"),
  isRecurring: boolean("is_recurring").notNull().default(false),
  isUpsell: boolean("is_upsell").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============================================================================
// 6. APPROVAL LOGS & PORTAL COMMENTS
// ============================================================================

export const approvalLogs = pgTable("approval_logs", {
  id: serial("id").primaryKey(),
  quoteId: integer("quote_id")
    .notNull()
    .references(() => quotes.id, { onDelete: "cascade" }),
  reviewerId: integer("reviewer_id")
    .notNull()
    .references(() => users.id),
  action: varchar("action", { length: 50 }).notNull(), // approved | rejected | returned_for_revision
  level: varchar("level", { length: 50 }).notNull(), // manager | finance
  reason: text("reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const portalComments = pgTable("portal_comments", {
  id: serial("id").primaryKey(),
  quoteId: integer("quote_id")
    .notNull()
    .references(() => quotes.id, { onDelete: "cascade" }),
  quoteLineId: integer("quote_line_id").references(() => quoteLines.id, { onDelete: "set null" }),
  authorType: varchar("author_type", { length: 50 }).notNull(), // customer | rep
  authorName: varchar("author_name", { length: 255 }).notNull(),
  message: text("message").notNull(),
  counterDiscountPct: numeric("counter_discount_pct", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============================================================================
// 7. UPSELL & CROSS-SELL RULES
// ============================================================================

export const upsellRules = pgTable("upsell_rules", {
  id: serial("id").primaryKey(),
  sourceProductId: integer("source_product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  suggestedProductId: integer("suggested_product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  rank: integer("rank").notNull().default(1),
  isPromoted: boolean("is_promoted").notNull().default(false),
  minMarginPct: numeric("min_margin_pct", { precision: 5, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============================================================================
// 8. WAREHOUSES & OPERATIONS INVENTORY MANAGEMENT
// ============================================================================

export const warehouses = pgTable("warehouses", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 50 }).unique(), // WH-EAST, WH-WEST
  name: varchar("name", { length: 255 }).notNull().unique(), // Main Warehouse, East Depot
  location: text("location"),
  shippingCostWeight: numeric("shipping_cost_weight", { precision: 5, scale: 2 })
    .notNull()
    .default("1.0"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Multi-warehouse inventory tracking with on-hand, reserved, and reorder triggers.
 * Managed by Operations role.
 */
export const warehouseStock = pgTable(
  "warehouse_stock",
  {
    id: serial("id").primaryKey(),
    warehouseId: integer("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: integer("variant_id").references(() => productVariants.id, {
      onDelete: "cascade",
    }),
    quantity: integer("quantity").notNull().default(0),
    quantityOnHand: integer("quantity_on_hand").notNull().default(0), // Physical stock
    quantityReserved: integer("quantity_reserved").notNull().default(0), // Allocated to active orders
    reorderLevel: integer("reorder_level").notNull().default(10), // Alert threshold
    reorderQuantity: integer("reorder_quantity").notNull().default(50),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    warehouseProductVariantUnique: unique().on(t.warehouseId, t.productId, t.variantId),
  })
);

/**
 * Fulfillment Splits across multiple warehouses for single or multi-line orders.
 * Operations role can view, allocate, split, and override assignments.
 */
export const fulfillmentSplits = pgTable("fulfillment_splits", {
  id: serial("id").primaryKey(),
  quoteId: integer("quote_id")
    .notNull()
    .references(() => quotes.id, { onDelete: "cascade" }),
  quoteLineId: integer("quote_line_id")
    .notNull()
    .references(() => quoteLines.id, { onDelete: "cascade" }),
  warehouseId: integer("warehouse_id")
    .notNull()
    .references(() => warehouses.id),
  quantity: integer("quantity").notNull(),
  quantityAllocated: integer("quantity_allocated").notNull(),
  quantityFulfilled: integer("quantity_fulfilled").notNull().default(0),
  isBackordered: boolean("is_backordered").notNull().default(false),
  status: varchar("status", { length: 50 }).notNull().default("allocated"), // allocated | partially_fulfilled | fulfilled | shipped | delivered | cancelled
  allocatedBy: integer("allocated_by").references(() => users.id), // Operations user who reviewed/managed allocation
  trackingNumber: varchar("tracking_number", { length: 100 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Backorders for items with insufficient warehouse stock.
 * Managed by Operations users for restocking and delayed fulfillment.
 */
export const backorders = pgTable("backorders", {
  id: serial("id").primaryKey(),
  quoteId: integer("quote_id")
    .notNull()
    .references(() => quotes.id, { onDelete: "cascade" }),
  quoteLineId: integer("quote_line_id")
    .notNull()
    .references(() => quoteLines.id, { onDelete: "cascade" }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
  quantityBackordered: integer("quantity_backordered").notNull(),
  quantityRemaining: integer("quantity_remaining").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("open"), // open | partially_resolved | resolved | cancelled
  expectedDate: timestamp("expected_date"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Inventory movements log for audit and stock history.
 * Tracks stock additions, reservations, releases, adjustments, and fulfillments by Operations.
 */
export const stockMovements = pgTable("stock_movements", {
  id: serial("id").primaryKey(),
  warehouseId: integer("warehouse_id")
    .notNull()
    .references(() => warehouses.id, { onDelete: "cascade" }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  variantId: integer("variant_id").references(() => productVariants.id),
  quantityChange: integer("quantity_change").notNull(), // + positive for restock, - negative for dispatch
  movementType: varchar("movement_type", { length: 50 }).notNull(), // restock | allocation | fulfillment | adjustment | transfer
  referenceId: varchar("reference_id", { length: 100 }), // Quote/Order/PO number
  performedBy: integer("performed_by").references(() => users.id), // Operations user
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============================================================================
// 9. SUBSCRIPTIONS & RECURRING BILLING SCHEDULES
// ============================================================================

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  quoteId: integer("quote_id")
    .notNull()
    .references(() => quotes.id),
  quoteLineId: integer("quote_line_id")
    .notNull()
    .references(() => quoteLines.id),
  customerId: integer("customer_id")
    .notNull()
    .references(() => customers.id),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  interval: varchar("interval", { length: 50 }).notNull(), // monthly | quarterly | yearly
  status: varchar("status", { length: 50 }).notNull().default("active"), // active | paused | cancelled
  startsAt: timestamp("starts_at").notNull(),
  currentPeriodStart: timestamp("current_period_start").notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============================================================================
// 10. INVOICES & BILLING SCHEDULES
// ============================================================================

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: varchar("invoice_number", { length: 100 }).notNull().unique(), // INV-2026-0001
  quoteId: integer("quote_id")
    .notNull()
    .references(() => quotes.id),
  customerId: integer("customer_id")
    .notNull()
    .references(() => customers.id),
  type: varchar("type", { length: 50 }).notNull(), // one_time | recurring | credit_note
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  tax: numeric("tax", { precision: 12, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("draft"), // draft | sent | paid | cancelled
  dueDate: timestamp("due_date"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const billingSchedules = pgTable("billing_schedules", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id")
    .notNull()
    .references(() => subscriptions.id, { onDelete: "cascade" }),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("upcoming"), // upcoming | invoiced | paid
  invoiceId: integer("invoice_id").references(() => invoices.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============================================================================
// 11. DEAL HEALTH & ALERTS
// ============================================================================

export const dealAlerts = pgTable("deal_alerts", {
  id: serial("id").primaryKey(),
  quoteId: integer("quote_id")
    .notNull()
    .references(() => quotes.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(), // stalled | discount_anomaly | delivery_risk
  message: text("message").notNull(),
  severity: varchar("severity", { length: 50 }).notNull().default("warning"), // info | warning | critical
  isResolved: boolean("is_resolved").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============================================================================
// 12. DRIZZLE RELATIONS
// ============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  quotes: many(quotes),
  approvalLogs: many(approvalLogs),
  managedFulfillments: many(fulfillmentSplits),
  stockMovements: many(stockMovements),
  ledTeams: many(teams),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  leader: one(users, {
    fields: [teams.leaderId],
    references: [users.id],
  }),
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one }) => ({
  team: one(teams, {
    fields: [projects.teamId],
    references: [teams.id],
  }),
}));

export const customerTiersRelations = relations(customerTiers, ({ many }) => ({
  customers: many(customers),
  priceLists: many(priceLists),
  discountRules: many(discountRules),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  tier: one(customerTiers, {
    fields: [customers.tierId],
    references: [customerTiers.id],
  }),
  quotes: many(quotes),
  subscriptions: many(subscriptions),
  invoices: many(invoices),
}));

export const productCategoriesRelations = relations(productCategories, ({ many }) => ({
  products: many(products),
  discountRules: many(discountRules),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(productCategories, {
    fields: [products.categoryId],
    references: [productCategories.id],
  }),
  variants: many(productVariants),
  priceListItems: many(priceListItems),
  warehouseStock: many(warehouseStock),
  upsellSuggestions: many(upsellRules, { relationName: "sourceProduct" }),
  backorders: many(backorders),
  stockMovements: many(stockMovements),
}));

export const quotesRelations = relations(quotes, ({ one, many }) => ({
  customer: one(customers, {
    fields: [quotes.customerId],
    references: [customers.id],
  }),
  rep: one(users, {
    fields: [quotes.repId],
    references: [users.id],
  }),
  lines: many(quoteLines),
  approvalLogs: many(approvalLogs),
  portalComments: many(portalComments),
  fulfillmentSplits: many(fulfillmentSplits),
  backorders: many(backorders),
  subscriptions: many(subscriptions),
  invoices: many(invoices),
  alerts: many(dealAlerts),
}));

export const quoteLinesRelations = relations(quoteLines, ({ one, many }) => ({
  quote: one(quotes, {
    fields: [quoteLines.quoteId],
    references: [quotes.id],
  }),
  product: one(products, {
    fields: [quoteLines.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [quoteLines.variantId],
    references: [productVariants.id],
  }),
  fulfillmentSplits: many(fulfillmentSplits),
  backorders: many(backorders),
}));

export const warehousesRelations = relations(warehouses, ({ many }) => ({
  stock: many(warehouseStock),
  fulfillmentSplits: many(fulfillmentSplits),
  stockMovements: many(stockMovements),
}));

export const warehouseStockRelations = relations(warehouseStock, ({ one }) => ({
  warehouse: one(warehouses, {
    fields: [warehouseStock.warehouseId],
    references: [warehouses.id],
  }),
  product: one(products, {
    fields: [warehouseStock.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [warehouseStock.variantId],
    references: [productVariants.id],
  }),
}));

export const fulfillmentSplitsRelations = relations(fulfillmentSplits, ({ one }) => ({
  quote: one(quotes, {
    fields: [fulfillmentSplits.quoteId],
    references: [quotes.id],
  }),
  quoteLine: one(quoteLines, {
    fields: [fulfillmentSplits.quoteLineId],
    references: [quoteLines.id],
  }),
  warehouse: one(warehouses, {
    fields: [fulfillmentSplits.warehouseId],
    references: [warehouses.id],
  }),
  operator: one(users, {
    fields: [fulfillmentSplits.allocatedBy],
    references: [users.id],
  }),
}));

export const backordersRelations = relations(backorders, ({ one }) => ({
  quote: one(quotes, {
    fields: [backorders.quoteId],
    references: [quotes.id],
  }),
  quoteLine: one(quoteLines, {
    fields: [backorders.quoteLineId],
    references: [quoteLines.id],
  }),
  product: one(products, {
    fields: [backorders.productId],
    references: [products.id],
  }),
}));

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  warehouse: one(warehouses, {
    fields: [stockMovements.warehouseId],
    references: [warehouses.id],
  }),
  product: one(products, {
    fields: [stockMovements.productId],
    references: [products.id],
  }),
  operator: one(users, {
    fields: [stockMovements.performedBy],
    references: [users.id],
  }),
}));

// ============================================================================
// 13. ZOD SCHEMAS & TYPE INFERENCE
// ============================================================================

export const insertUserSchema = createInsertSchema(users, {
  email: (s) => s.email("Invalid email format"),
  password: (s) => s.min(8, "Password must be at least 8 characters").optional(),
  name: (s) => s.min(2, "Name must be at least 2 characters"),
  role: (s) => s.refine((val) => USER_ROLES.includes(val as UserRole)),
});
export const selectUserSchema = createSelectSchema(users);
export const safeUserSchema = selectUserSchema.omit({ password: true, refreshToken: true });
export type User = z.infer<typeof selectUserSchema>;
export type NewUser = z.infer<typeof insertUserSchema>;
export type SafeUser = z.infer<typeof safeUserSchema>;

export const insertCustomerSchema = createInsertSchema(customers, {
  email: (s) => s.email("Invalid email format"),
  name: (s) => s.min(2, "Name is required"),
});
export const selectCustomerSchema = createSelectSchema(customers);
export type Customer = z.infer<typeof selectCustomerSchema>;
export type NewCustomer = z.infer<typeof insertCustomerSchema>;

export const insertProductSchema = createInsertSchema(products);
export const selectProductSchema = createSelectSchema(products);
export type Product = z.infer<typeof selectProductSchema>;
export type NewProduct = z.infer<typeof insertProductSchema>;

export const insertQuoteSchema = createInsertSchema(quotes);
export const selectQuoteSchema = createSelectSchema(quotes);
export type Quote = z.infer<typeof selectQuoteSchema>;
export type NewQuote = z.infer<typeof insertQuoteSchema>;

export const insertQuoteLineSchema = createInsertSchema(quoteLines);
export const selectQuoteLineSchema = createSelectSchema(quoteLines);
export type QuoteLine = z.infer<typeof selectQuoteLineSchema>;

export const insertInvoiceSchema = createInsertSchema(invoices);
export const selectInvoiceSchema = createSelectSchema(invoices);
export type Invoice = z.infer<typeof selectInvoiceSchema>;

export const insertWarehouseSchema = createInsertSchema(warehouses);
export const selectWarehouseSchema = createSelectSchema(warehouses);
export type Warehouse = z.infer<typeof selectWarehouseSchema>;

export const insertWarehouseStockSchema = createInsertSchema(warehouseStock);
export const selectWarehouseStockSchema = createSelectSchema(warehouseStock);
export type WarehouseStock = z.infer<typeof selectWarehouseStockSchema>;

export const insertFulfillmentSplitSchema = createInsertSchema(fulfillmentSplits);
export const selectFulfillmentSplitSchema = createSelectSchema(fulfillmentSplits);
export type FulfillmentSplit = z.infer<typeof selectFulfillmentSplitSchema>;

export const insertBackorderSchema = createInsertSchema(backorders);
export const selectBackorderSchema = createSelectSchema(backorders);
export type Backorder = z.infer<typeof selectBackorderSchema>;

export const insertStockMovementSchema = createInsertSchema(stockMovements);
export const selectStockMovementSchema = createSelectSchema(stockMovements);
export type StockMovement = z.infer<typeof selectStockMovementSchema>;

export const insertTeamSchema = createInsertSchema(teams);
export const selectTeamSchema = createSelectSchema(teams);
export type Team = z.infer<typeof selectTeamSchema>;
export type NewTeam = z.infer<typeof insertTeamSchema>;

export const insertProjectSchema = createInsertSchema(projects);
export const selectProjectSchema = createSelectSchema(projects);
export type Project = z.infer<typeof selectProjectSchema>;
export type NewProject = z.infer<typeof insertProjectSchema>;
