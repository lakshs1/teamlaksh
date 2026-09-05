# DealFlow360 — Backend Technical Spec

> **Stack:** Express + TypeScript + Drizzle ORM + PostgreSQL + Zod + Swagger  
> **Pattern:** Module-based (`routes → controller → service → schema`) as per [`agents.md`](file:///c:/Users/Mawiya/Desktop/template_odoo/quickcourt/backend/agents.md)  
> **Remote DB:** `postgresql://postgres:postgres@bore.pub:3950/postgres`  
> **Focus:** Make it functional. Ship the business logic, not perfect UI.

---

## Table of Contents

1. [System Design Options & Tradeoffs](#1-system-design-options--tradeoffs)
2. [Database Schema (Drizzle)](#2-database-schema-drizzle)
3. [API Contracts](#3-api-contracts)

---

## 1. System Design Options & Tradeoffs

### ADR-001: Quotation State Machine

How does a quotation move from draft to fulfilled?

#### Option A — Linear Status Column (Recommended for hackathon)

A single `status` enum column on the `quotes` table drives the entire lifecycle:

```
draft → submitted → pending_manager → pending_finance → approved → fulfillment → confirmed → invoiced
                                                      ↘ rejected (terminal)
                                         ↗ revision (loops back to draft)
```

| Pros | Cons |
|------|------|
| Dead simple to query (`WHERE status = 'pending_manager'`) | Can't represent parallel approvals |
| One column, one index, zero joins for state checks | Adding new states later = migration |
| Easy to audit: log every status change in `approval_logs` | No fork/merge flows |

#### Option B — Separate State + Workflow Table

A `quote_workflows` table tracks each step independently. Quotation has a generic `status` but the real state lives in the workflow rows.

| Pros | Cons |
|------|------|
| Supports parallel approval (manager AND finance at once) | Extra joins on every read |
| Can add arbitrary workflow steps without migration | More complex queries |
| Production-grade pattern (like Odoo/Salesforce) | Overkill for a hackathon demo |

**Decision:** Go with **Option A**. Single enum column, all state transitions enforced in the service layer. Log every transition in `approval_logs` for the audit trail.

---

### ADR-002: Blended Risk Score — Where to Compute?

#### Option A — Compute in Application Layer (Recommended)

Service function `computeBlendedRisk(quoteLines)` runs the formula in TypeScript. Returns `{ score, lineBreakdown[], routeTo }`.

| Pros | Cons |
|------|------|
| Easy to unit test the formula independently | Extra round-trip if lines are large |
| Business logic visible in code, not buried in SQL | Must fetch all lines before computing |
| Matches the hackathon requirement: "must be implemented in application logic, not hardcoded" | — |

#### Option B — Compute in a PostgreSQL Function

A `plpgsql` function `calculate_blended_risk(quote_id)` runs the math in the DB.

| Pros | Cons |
|------|------|
| Single query, no round-trip | Hard to unit test |
| Atomic with the insert/update | Violates problem statement ("implement in app logic") |

**Decision:** **Option A**. Pure TypeScript function, unit-testable, meets the rules.

---

### ADR-003: Customer Portal Authentication

#### Option A — Magic Link / Portal Token per Quote (Recommended)

Each quote generates a `portal_token` (UUIDv4). Customer accesses `/api/v1/portal/quotes/:token`. No password, no signup.

| Pros | Cons |
|------|------|
| Zero friction for customer | Token can be shared/leaked |
| No customer account management needed | No customer-level session/history |
| Fast to build | — |

#### Option B — Customer Email + Password Auth

Customers register/login like internal users, with a `portal_user` role.

| Pros | Cons |
|------|------|
| Secure, session-based | Need full signup/login/password-reset for customers |
| Customer can see all their quotes | More code to write |
| Production-grade | Slower to ship |

**Decision:** **Option A** for hackathon speed. Expose a `portal_token` per quote. Internal API strips margins/costs from the response. Customer can comment, counter-discount, and confirm via that token.

---

### ADR-004: Warehouse Split Algorithm

#### Option A — Greedy Single-Pass (Recommended)

1. Sort warehouses by priority (stock availability desc, shipping cost asc).
2. For each line item: pull from top warehouse until it runs out, move to next.
3. If total stock < quantity → mark remainder as `backordered`.

| Pros | Cons |
|------|------|
| O(lines × warehouses), very fast | May not minimize total shipments globally |
| Easy to implement and demo | Not optimal for complex multi-item orders |
| Deterministic, testable | — |

#### Option B — Cost-Optimized LP Solver

Use a linear programming library to minimize total shipping cost across warehouses.

| Pros | Cons |
|------|------|
| Globally optimal | Heavy dependency, slow to build |
| Impressive for judges | Overkill for a demo |

**Decision:** **Option A**. Ship the greedy algorithm. Manual override endpoint covers edge cases.

---

### ADR-005: Subscription Billing — Eager vs Lazy

#### Option A — Generate Schedule on Quote Confirm (Recommended)

When a quote with subscription lines is confirmed, immediately generate all future `billing_schedule` rows (e.g., next 12 months).

| Pros | Cons |
|------|------|
| All billing dates visible in the dashboard instantly | Generates rows that may never be used |
| Easy to query "upcoming invoices" | Mid-cycle changes need to update/delete rows |

#### Option B — Generate Next Invoice On-Demand

A cron-like endpoint generates the next billing row only when the current period ends.

| Pros | Cons |
|------|------|
| No wasted rows | Need a scheduler/cron job |
| Cleaner for production | Can't show future schedule in dashboard |

**Decision:** **Option A**. Pre-generate the schedule. Proration edits update existing rows.

---

### ADR-006: Roles — Extend Existing Enum or New Table?

The current backend has `pgEnum("user_role", ["user", "admin"])`.

#### Option A — Expand the Enum (Recommended)

Change to `pgEnum("user_role", ["admin", "manager", "rep", "finance"])`. Customer portal doesn't use internal auth.

| Pros | Cons |
|------|------|
| One migration, done | Can't add roles without migration |
| `authorize("manager", "finance")` middleware already works | — |

#### Option B — Roles Junction Table

`user_roles` table with `userId + role` rows. A user can have multiple roles.

| Pros | Cons |
|------|------|
| Flexible, no migration for new roles | More complex auth middleware |
| User can be both manager and finance | Overkill for 4 fixed roles |

**Decision:** **Option A**. Expand the enum to `["admin", "manager", "rep", "finance"]`.

---

## 2. Database Schema (Drizzle)

### Entity Relationship Diagram

```mermaid
erDiagram
    users ||--o{ quotes : creates
    users ||--o{ approval_logs : reviews
    customers ||--o{ quotes : receives
    customers }o--|| customer_tiers : belongs_to
    
    quotes ||--|{ quote_lines : contains
    quotes ||--o{ approval_logs : has
    quotes ||--o{ fulfillment_splits : generates
    quotes ||--o{ invoices : produces
    
    quote_lines }o--|| products : references
    
    products }o--|| product_categories : belongs_to
    products ||--o{ product_variants : has
    products ||--o{ price_list_items : priced_in
    products ||--o{ upsell_rules : suggested_by
    
    price_lists ||--|{ price_list_items : contains
    
    discount_rules }o--|| customer_tiers : applies_to
    discount_rules }o--|| product_categories : applies_to
    
    warehouses ||--|{ warehouse_stock : stores
    warehouse_stock }o--|| products : tracks
    fulfillment_splits }o--|| warehouses : assigned_to
    
    subscriptions }o--|| quotes : originates_from
    subscriptions ||--|{ billing_schedules : generates
    billing_schedules ||--o| invoices : produces
```

### Table Definitions

Below is the complete schema. Each table maps to a Drizzle file under `src/db/schema/`.

---

#### `users` (modify existing)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | `serial` | PK | Auto-increment integer (matches remote DB) |
| name | `text` | NOT NULL | |
| email | `text` | NOT NULL, UNIQUE | |
| password | `text` | NOT NULL | bcrypt hash (add this column) |
| role | `text` | NOT NULL, DEFAULT `'rep'` | One of: `admin`, `manager`, `rep`, `finance` |
| avatar_url | `text` | nullable | |
| github_url | `text` | nullable | |
| created_at | `timestamp` | NOT NULL, DEFAULT NOW | |

> **Note:** The remote DB already has a `users` table with `id (int), name, email, role, avatar_url, github_url, created_at`. We need to **ADD** a `password` column for auth. The existing seeded rows won't have passwords — that's fine, we'll seed new ones.

---

#### `customers`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | `serial` | PK | |
| name | `text` | NOT NULL | Company name (e.g., "Acme Corp") |
| email | `text` | NOT NULL, UNIQUE | Primary contact email |
| tier_id | `integer` | FK → customer_tiers.id | Discount tier |
| created_at | `timestamp` | NOT NULL, DEFAULT NOW | |

---

#### `customer_tiers`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | `serial` | PK | |
| name | `text` | NOT NULL, UNIQUE | e.g., "Bronze", "Silver", "Gold" |
| max_discount_pct | `numeric(5,2)` | NOT NULL | e.g., 5.00, 10.00, 15.00 |
| created_at | `timestamp` | NOT NULL, DEFAULT NOW | |

---

#### `product_categories`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | `serial` | PK | |
| name | `text` | NOT NULL, UNIQUE | e.g., "Hardware", "Services", "Subscriptions" |
| max_discount_pct | `numeric(5,2)` | NOT NULL | Category ceiling (e.g., 15% for Hardware, 10% for Services) |
| created_at | `timestamp` | NOT NULL, DEFAULT NOW | |

---

#### `products`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | `serial` | PK | |
| name | `text` | NOT NULL | |
| description | `text` | nullable | |
| category_id | `integer` | FK → product_categories.id, NOT NULL | |
| base_price | `numeric(12,2)` | NOT NULL | Default unit price |
| cost_price | `numeric(12,2)` | NOT NULL | Internal cost (hidden from portal) |
| unit | `text` | NOT NULL, DEFAULT `'unit'` | e.g., "unit", "hour", "license" |
| tax_pct | `numeric(5,2)` | DEFAULT 0 | Tax percentage |
| is_recurring | `boolean` | DEFAULT false | True for subscription products |
| recurring_interval | `text` | nullable | `'monthly'`, `'quarterly'`, `'yearly'` |
| is_active | `boolean` | DEFAULT true | |
| created_at | `timestamp` | NOT NULL, DEFAULT NOW | |

---

#### `product_variants`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | `serial` | PK | |
| product_id | `integer` | FK → products.id, NOT NULL | |
| attribute_name | `text` | NOT NULL | e.g., "Size", "Pack" |
| attribute_value | `text` | NOT NULL | e.g., "Large", "10-pack" |
| extra_price | `numeric(12,2)` | DEFAULT 0 | Added to base price |
| created_at | `timestamp` | NOT NULL, DEFAULT NOW | |

---

#### `price_lists`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | `serial` | PK | |
| name | `text` | NOT NULL | e.g., "Gold Tier Pricing", "USD Standard" |
| tier_id | `integer` | FK → customer_tiers.id, nullable | If tier-specific |
| currency | `text` | DEFAULT `'USD'` | |
| is_active | `boolean` | DEFAULT true | |
| created_at | `timestamp` | NOT NULL, DEFAULT NOW | |

---

#### `price_list_items`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | `serial` | PK | |
| price_list_id | `integer` | FK → price_lists.id, NOT NULL | |
| product_id | `integer` | FK → products.id, NOT NULL | |
| unit_price | `numeric(12,2)` | NOT NULL | Override price for this list |
| created_at | `timestamp` | NOT NULL, DEFAULT NOW | |

---

#### `discount_rules`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | `serial` | PK | |
| tier_id | `integer` | FK → customer_tiers.id, NOT NULL | |
| category_id | `integer` | FK → product_categories.id, NOT NULL | |
| max_discount_pct | `numeric(5,2)` | NOT NULL | Effective ceiling = `min(tier.max, category.max, this)` |
| manager_threshold_pct | `numeric(5,2)` | NOT NULL, DEFAULT 0 | Above this → needs manager |
| finance_threshold_pct | `numeric(5,2)` | NOT NULL, DEFAULT 5 | Above this → needs manager + finance |
| created_at | `timestamp` | NOT NULL, DEFAULT NOW | |

---

#### `quotes`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | `serial` | PK | |
| quote_number | `text` | NOT NULL, UNIQUE | e.g., "QT-2026-0001" |
| customer_id | `integer` | FK → customers.id, NOT NULL | |
| rep_id | `integer` | FK → users.id, NOT NULL | Sales rep who created it |
| status | `text` | NOT NULL, DEFAULT `'draft'` | Enum: see state machine above |
| portal_token | `text` | UNIQUE | UUIDv4 for customer portal access |
| subtotal | `numeric(12,2)` | DEFAULT 0 | Sum of line totals before discount |
| total_discount | `numeric(12,2)` | DEFAULT 0 | Total discount amount |
| total_tax | `numeric(12,2)` | DEFAULT 0 | |
| grand_total | `numeric(12,2)` | DEFAULT 0 | Final amount |
| blended_risk_score | `numeric(5,2)` | DEFAULT 0 | Computed on submit |
| approval_route | `text` | nullable | `'auto'`, `'manager'`, `'manager_finance'` |
| notes | `text` | nullable | Internal notes |
| expires_at | `timestamp` | nullable | Quotation expiry |
| created_at | `timestamp` | NOT NULL, DEFAULT NOW | |
| updated_at | `timestamp` | NOT NULL, DEFAULT NOW | |

---

#### `quote_lines`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | `serial` | PK | |
| quote_id | `integer` | FK → quotes.id, NOT NULL | CASCADE DELETE |
| product_id | `integer` | FK → products.id, NOT NULL | |
| variant_id | `integer` | FK → product_variants.id, nullable | |
| quantity | `integer` | NOT NULL, DEFAULT 1 | |
| unit_price | `numeric(12,2)` | NOT NULL | Price at time of quote |
| cost_price | `numeric(12,2)` | NOT NULL | Internal cost (for margin calc) |
| discount_pct | `numeric(5,2)` | DEFAULT 0 | Line-level discount |
| discount_amount | `numeric(12,2)` | DEFAULT 0 | Computed: `unit_price * qty * discount_pct / 100` |
| line_total | `numeric(12,2)` | NOT NULL | After discount |
| margin_pct | `numeric(5,2)` | DEFAULT 0 | `(line_total - cost_price*qty) / line_total * 100` |
| allowed_discount_pct | `numeric(5,2)` | DEFAULT 0 | `min(tier_limit, category_limit)` |
| excess_pct | `numeric(5,2)` | DEFAULT 0 | `max(0, discount_pct - allowed_discount_pct)` |
| is_recurring | `boolean` | DEFAULT false | |
| is_upsell | `boolean` | DEFAULT false | True if added from suggestion panel |
| created_at | `timestamp` | NOT NULL, DEFAULT NOW | |

---

#### `approval_logs`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | `serial` | PK | |
| quote_id | `integer` | FK → quotes.id, NOT NULL | |
| reviewer_id | `integer` | FK → users.id, NOT NULL | |
| action | `text` | NOT NULL | `'approved'`, `'rejected'`, `'returned_for_revision'` |
| level | `text` | NOT NULL | `'manager'`, `'finance'` |
| reason | `text` | nullable | |
| created_at | `timestamp` | NOT NULL, DEFAULT NOW | |

---

#### `portal_comments`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | `serial` | PK | |
| quote_id | `integer` | FK → quotes.id, NOT NULL | |
| quote_line_id | `integer` | FK → quote_lines.id, nullable | Line-level comment |
| author_type | `text` | NOT NULL | `'customer'` or `'rep'` |
| author_name | `text` | NOT NULL | |
| message | `text` | NOT NULL | |
| counter_discount_pct | `numeric(5,2)` | nullable | Customer's proposed discount |
| created_at | `timestamp` | NOT NULL, DEFAULT NOW | |

---

#### `upsell_rules`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | `serial` | PK | |
| source_product_id | `integer` | FK → products.id, NOT NULL | When this product is in the cart… |
| suggested_product_id | `integer` | FK → products.id, NOT NULL | …suggest this one |
| rank | `integer` | DEFAULT 1 | Higher = shown first |
| is_promoted | `boolean` | DEFAULT false | Boosted in suggestions |
| min_margin_pct | `numeric(5,2)` | DEFAULT 0 | Only suggest if margin stays above this |
| created_at | `timestamp` | NOT NULL, DEFAULT NOW | |

---

#### `warehouses`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | `serial` | PK | |
| name | `text` | NOT NULL, UNIQUE | e.g., "Main Warehouse", "East Depot" |
| location | `text` | nullable | |
| shipping_cost_weight | `numeric(5,2)` | DEFAULT 1.0 | Lower = preferred for fulfillment |
| is_active | `boolean` | DEFAULT true | |
| created_at | `timestamp` | NOT NULL, DEFAULT NOW | |

---

#### `warehouse_stock`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | `serial` | PK | |
| warehouse_id | `integer` | FK → warehouses.id, NOT NULL | |
| product_id | `integer` | FK → products.id, NOT NULL | |
| quantity | `integer` | NOT NULL, DEFAULT 0 | Current stock |
| reorder_level | `integer` | DEFAULT 10 | Alert threshold |
| created_at | `timestamp` | NOT NULL, DEFAULT NOW | |
| updated_at | `timestamp` | NOT NULL, DEFAULT NOW | |

> UNIQUE constraint on `(warehouse_id, product_id)`.

---

#### `fulfillment_splits`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | `serial` | PK | |
| quote_id | `integer` | FK → quotes.id, NOT NULL | |
| quote_line_id | `integer` | FK → quote_lines.id, NOT NULL | |
| warehouse_id | `integer` | FK → warehouses.id, NOT NULL | |
| quantity | `integer` | NOT NULL | Qty fulfilled from this warehouse |
| is_backordered | `boolean` | DEFAULT false | |
| status | `text` | DEFAULT `'pending'` | `'pending'`, `'shipped'`, `'delivered'` |
| created_at | `timestamp` | NOT NULL, DEFAULT NOW | |

---

#### `subscriptions`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | `serial` | PK | |
| quote_id | `integer` | FK → quotes.id, NOT NULL | |
| quote_line_id | `integer` | FK → quote_lines.id, NOT NULL | |
| customer_id | `integer` | FK → customers.id, NOT NULL | |
| product_id | `integer` | FK → products.id, NOT NULL | |
| quantity | `integer` | NOT NULL | |
| unit_price | `numeric(12,2)` | NOT NULL | |
| interval | `text` | NOT NULL | `'monthly'`, `'quarterly'`, `'yearly'` |
| status | `text` | DEFAULT `'active'` | `'active'`, `'paused'`, `'cancelled'` |
| starts_at | `timestamp` | NOT NULL | |
| current_period_start | `timestamp` | NOT NULL | |
| current_period_end | `timestamp` | NOT NULL | |
| created_at | `timestamp` | NOT NULL, DEFAULT NOW | |

---

#### `billing_schedules`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | `serial` | PK | |
| subscription_id | `integer` | FK → subscriptions.id, NOT NULL | |
| period_start | `timestamp` | NOT NULL | |
| period_end | `timestamp` | NOT NULL | |
| amount | `numeric(12,2)` | NOT NULL | |
| status | `text` | DEFAULT `'upcoming'` | `'upcoming'`, `'invoiced'`, `'paid'` |
| invoice_id | `integer` | FK → invoices.id, nullable | Linked when invoice is generated |
| created_at | `timestamp` | NOT NULL, DEFAULT NOW | |

---

#### `invoices`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | `serial` | PK | |
| invoice_number | `text` | NOT NULL, UNIQUE | e.g., "INV-2026-0001" |
| quote_id | `integer` | FK → quotes.id, NOT NULL | |
| customer_id | `integer` | FK → customers.id, NOT NULL | |
| type | `text` | NOT NULL | `'one_time'`, `'recurring'`, `'credit_note'` |
| subtotal | `numeric(12,2)` | NOT NULL | |
| tax | `numeric(12,2)` | DEFAULT 0 | |
| total | `numeric(12,2)` | NOT NULL | |
| status | `text` | DEFAULT `'draft'` | `'draft'`, `'sent'`, `'paid'`, `'cancelled'` |
| due_date | `timestamp` | nullable | |
| paid_at | `timestamp` | nullable | |
| created_at | `timestamp` | NOT NULL, DEFAULT NOW | |

---

#### `deal_alerts`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | `serial` | PK | |
| quote_id | `integer` | FK → quotes.id, NOT NULL | |
| type | `text` | NOT NULL | `'stalled'`, `'discount_anomaly'`, `'delivery_risk'` |
| message | `text` | NOT NULL | Human-readable alert |
| severity | `text` | DEFAULT `'warning'` | `'info'`, `'warning'`, `'critical'` |
| is_resolved | `boolean` | DEFAULT false | |
| created_at | `timestamp` | NOT NULL, DEFAULT NOW | |

---

## 3. API Contracts

All endpoints follow the existing response convention:
```json
{ "success": true, "data": { ... } }
{ "success": false, "message": "Error description" }
```

### Module Map → File Structure

```
src/modules/
├── auth/            ← Already exists (register, login, refresh, logout, me)
├── catalog/         ← Products, variants, categories, price lists
├── customers/       ← Customer CRUD + tier assignment
├── quotes/          ← Quote builder, line management, risk scoring, state transitions
├── approvals/       ← Approval review endpoints
├── recommendations/ ← Upsell/cross-sell suggestions
├── fulfillment/     ← Warehouse split, backorder
├── billing/         ← Subscriptions, invoices, proration
├── portal/          ← Customer-facing (token-based, no JWT)
└── analytics/       ← Deal health, alerts, reporting
```

---

### AUTH (`/api/v1/auth`) — Already Built

| Method | Endpoint | Auth | Body / Params |
|--------|----------|------|---------------|
| POST | `/register` | Public | `{ name, email, password }` |
| POST | `/login` | Public | `{ email, password }` |
| POST | `/refresh` | Public | `{ refreshToken }` |
| POST | `/logout` | Bearer | — |
| GET | `/me` | Bearer | — |

---

### CATALOG (`/api/v1/catalog`)

| Method | Endpoint | Auth | Body / Params | Response |
|--------|----------|------|---------------|----------|
| GET | `/categories` | Bearer | — | List of product categories |
| POST | `/categories` | Bearer + admin | `{ name, max_discount_pct }` | Created category |
| GET | `/products` | Bearer | `?category_id&search&page&limit` | Paginated products |
| POST | `/products` | Bearer + admin | `{ name, description, category_id, base_price, cost_price, unit, tax_pct, is_recurring, recurring_interval }` | Created product |
| GET | `/products/:id` | Bearer | — | Product with variants |
| PATCH | `/products/:id` | Bearer + admin | Partial product fields | Updated product |
| POST | `/products/:id/variants` | Bearer + admin | `{ attribute_name, attribute_value, extra_price }` | Created variant |
| GET | `/price-lists` | Bearer | — | All price lists |
| POST | `/price-lists` | Bearer + admin | `{ name, tier_id?, currency }` | Created price list |
| POST | `/price-lists/:id/items` | Bearer + admin | `{ product_id, unit_price }` | Added item to list |

---

### CUSTOMERS (`/api/v1/customers`)

| Method | Endpoint | Auth | Body / Params | Response |
|--------|----------|------|---------------|----------|
| GET | `/` | Bearer | `?search&tier_id&page&limit` | Paginated customers |
| POST | `/` | Bearer | `{ name, email, tier_id }` | Created customer |
| GET | `/:id` | Bearer | — | Customer detail with tier info |
| PATCH | `/:id` | Bearer | Partial fields | Updated customer |
| GET | `/tiers` | Bearer | — | List all tiers |
| POST | `/tiers` | Bearer + admin | `{ name, max_discount_pct }` | Created tier |

---

### DISCOUNT RULES (`/api/v1/discount-rules`)

| Method | Endpoint | Auth | Body / Params | Response |
|--------|----------|------|---------------|----------|
| GET | `/` | Bearer | `?tier_id&category_id` | All discount rules |
| POST | `/` | Bearer + admin | `{ tier_id, category_id, max_discount_pct, manager_threshold_pct, finance_threshold_pct }` | Created rule |
| PATCH | `/:id` | Bearer + admin | Partial fields | Updated rule |

---

### QUOTES (`/api/v1/quotes`)

| Method | Endpoint | Auth | Body / Params | Response |
|--------|----------|------|---------------|----------|
| GET | `/` | Bearer | `?status&customer_id&rep_id&page&limit` | Paginated quotes |
| POST | `/` | Bearer (rep) | `{ customer_id, notes?, expires_at? }` | Created draft quote with portal_token |
| GET | `/:id` | Bearer | — | Full quote with lines, margins, risk score |
| PATCH | `/:id` | Bearer (rep) | `{ notes?, expires_at? }` | Updated quote |
| **Lines** | | | | |
| POST | `/:id/lines` | Bearer (rep) | `{ product_id, variant_id?, quantity, discount_pct? }` | Added line with computed margin + allowed discount |
| PATCH | `/:id/lines/:lineId` | Bearer (rep) | `{ quantity?, discount_pct? }` | Updated line, recomputed totals |
| DELETE | `/:id/lines/:lineId` | Bearer (rep) | — | Removed line |
| **Actions** | | | | |
| POST | `/:id/submit` | Bearer (rep) | — | Computes blended risk → routes to approval or auto-approves. Returns `{ risk_score, approval_route }` |
| POST | `/:id/confirm` | Bearer (rep) | — | Moves approved quote to `fulfillment` stage |

---

### APPROVALS (`/api/v1/approvals`)

| Method | Endpoint | Auth | Body / Params | Response |
|--------|----------|------|---------------|----------|
| GET | `/pending` | Bearer (manager/finance) | — | Quotes pending your approval level |
| GET | `/quotes/:quoteId/logs` | Bearer | — | Full audit trail for a quote |
| POST | `/quotes/:quoteId/approve` | Bearer (manager/finance) | `{ reason? }` | Advances state, logs entry |
| POST | `/quotes/:quoteId/reject` | Bearer (manager/finance) | `{ reason }` | Sets status → `rejected`, logs entry |
| POST | `/quotes/:quoteId/revise` | Bearer (manager/finance) | `{ reason }` | Sets status → `draft`, logs entry |

---

### RECOMMENDATIONS (`/api/v1/recommendations`)

| Method | Endpoint | Auth | Body / Params | Response |
|--------|----------|------|---------------|----------|
| GET | `/quotes/:quoteId/suggestions` | Bearer (rep) | — | Ranked list: `{ product, margin_delta, is_promoted, rank }[]` |
| **Admin: Manage Rules** | | | | |
| GET | `/rules` | Bearer + admin | — | All upsell rules |
| POST | `/rules` | Bearer + admin | `{ source_product_id, suggested_product_id, rank, is_promoted, min_margin_pct }` | Created rule |
| DELETE | `/rules/:id` | Bearer + admin | — | Deleted rule |

---

### FULFILLMENT (`/api/v1/fulfillment`)

| Method | Endpoint | Auth | Body / Params | Response |
|--------|----------|------|---------------|----------|
| GET | `/quotes/:quoteId/split` | Bearer | — | Computed warehouse split recommendation: `{ splits[], total_shipments, backordered[] }` |
| POST | `/quotes/:quoteId/split/accept` | Bearer (rep/finance) | — | Accepts computed split, creates fulfillment records, decrements stock |
| POST | `/quotes/:quoteId/split/override` | Bearer (rep/finance) | `{ splits: [{ quote_line_id, warehouse_id, quantity }] }` | Manual override |
| **Warehouses (Admin)** | | | | |
| GET | `/warehouses` | Bearer | — | All warehouses |
| POST | `/warehouses` | Bearer + admin | `{ name, location?, shipping_cost_weight? }` | Created warehouse |
| GET | `/warehouses/:id/stock` | Bearer | — | Stock levels for warehouse |
| POST | `/warehouses/:id/stock` | Bearer + admin | `{ product_id, quantity, reorder_level? }` | Set/update stock |

---

### BILLING (`/api/v1/billing`)

| Method | Endpoint | Auth | Body / Params | Response |
|--------|----------|------|---------------|----------|
| **Subscriptions** | | | | |
| GET | `/subscriptions` | Bearer | `?customer_id&status` | Active subscriptions |
| GET | `/subscriptions/:id` | Bearer | — | Subscription detail + billing schedule |
| PATCH | `/subscriptions/:id` | Bearer (finance) | `{ quantity?, status? }` | Mid-cycle update, triggers proration calc |
| POST | `/subscriptions/:id/cancel` | Bearer (finance) | — | Cancels with prorated credit note |
| **Invoices** | | | | |
| GET | `/invoices` | Bearer | `?customer_id&status&type&page&limit` | Paginated invoices |
| GET | `/invoices/:id` | Bearer | — | Invoice detail |
| POST | `/invoices/:id/pay` | Bearer (finance) | — | Mark as paid, update billing schedule |

---

### PORTAL (`/api/v1/portal`) — No JWT Required

| Method | Endpoint | Auth | Body / Params | Response |
|--------|----------|------|---------------|----------|
| GET | `/quotes/:token` | Portal token | — | Sanitized quote (no cost_price, no margin, no internal notes, no approval logs) |
| POST | `/quotes/:token/comments` | Portal token | `{ quote_line_id?, message, counter_discount_pct? }` | Added comment/counter |
| POST | `/quotes/:token/confirm` | Portal token | — | Customer confirms. If counter-discount exceeds threshold → re-enters approval. Otherwise → fulfillment |

---

### ANALYTICS (`/api/v1/analytics`)

| Method | Endpoint | Auth | Body / Params | Response |
|--------|----------|------|---------------|----------|
| GET | `/deal-health` | Bearer (manager/admin) | `?stalled_days=7` | `{ stalled_quotes[], discount_anomalies[], delivery_risks[] }` |
| GET | `/alerts` | Bearer (manager/admin) | `?type&is_resolved&page&limit` | Paginated alerts |
| POST | `/alerts/:id/resolve` | Bearer (manager/admin) | — | Mark alert resolved |
| POST | `/alerts/:id/escalate` | Bearer (manager/admin) | `{ message? }` | Nudge rep / escalate the quote |
| GET | `/reports/sales` | Bearer (manager/admin) | `?period&rep_id&category_id&status` | `{ total_quotes, total_revenue, avg_discount, avg_margin, by_rep[], by_category[] }` |

---

## Summary: Module Build Order

Build in this order to unblock downstream dependencies:

| Phase | Modules | Why First |
|-------|---------|-----------|
| 1 | `catalog` (categories + products) + `customers` (tiers + customers) + `discount-rules` | Everything references these |
| 2 | `quotes` (builder + lines + risk engine + state machine) | Core domain |
| 3 | `approvals` (review + audit trail) | Depends on quote state machine |
| 4 | `recommendations` (upsell rules + suggestion endpoint) | Depends on products + quote lines |
| 5 | `fulfillment` (warehouses + stock + split algorithm) | Depends on confirmed quotes |
| 6 | `billing` (subscriptions + invoices + proration) | Depends on confirmed quotes |
| 7 | `portal` (customer-facing token access) | Depends on quotes + comments |
| 8 | `analytics` (deal health + alerts + reports) | Depends on everything |
