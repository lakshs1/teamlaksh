# DealFlow360 — Backend Architecture, Requirements & Clarifications

> **Project:** DealFlow360 — Intelligent, Self-Governing Sales Operations Platform  
> **Target:** Robust Hackathon Backend Engine  
> **Tech Stack:** Node.js / Bun + Express + TypeScript + Drizzle ORM + PostgreSQL + Zod + Swagger

---

## 1. Product Requirements Breakdown (REQ Matrix)

| Req ID | Module | Feature | Key Acceptance Criteria |
|---|---|---|---|
| **REQ-101** | Auth & RBAC | Multi-Role Authentication | Roles: `admin`, `manager`, `rep`, `finance`, `portal_user`. JWT access/refresh tokens. |
| **REQ-102** | Master Catalog | Products, Variants & Price Lists | Hardware, Services, Subscriptions. Tier-based pricing rules (Bronze, Silver, Gold). |
| **REQ-103** | Governance | Blended Discount Risk Engine | Enforce min(TierLimit, CategoryLimit). Calculate blended risk score across all lines. |
| **REQ-104** | Approvals | Automated Approval Routing | Auto-approve if score = 0; route to Manager if low/medium risk; route to Manager + Finance if high risk. |
| **REQ-105** | Quotes & Cart | Quotation Builder & Live Margins | Cart management, real-time margin computation, state machine transitions. |
| **REQ-106** | Recommendations| Upsell / Cross-sell Engine | Suggest ranked co-purchase products, compute margin delta if added, promo boosts. |
| **REQ-107** | Inventory | Multi-Warehouse Auto-Split | Heuristic warehouse stock assignment to minimize shipments; backorder handling. |
| **REQ-108** | Billing | Hybrid Billing & Proration | Reconcile one-time invoice generation with recurring subscription schedules + mid-cycle proration. |
| **REQ-109** | Portal | Customer Negotiation Screen | Secure token-based portal: line comments, counter-discount proposals, one-click confirmation (triggers re-approval if over thresholds). |
| **REQ-110** | Analytics | Deal Health & Anomaly Alerts | Stalled quote detection, rep discount anomaly alerts (> historical avg), delivery risk indicators. |

---

## 2. Architecture & Business Logic Blueprint

```
DealFlow360 Core Backend Modules
 ├── Auth & RBAC (/api/v1/auth)
 ├── Master Configuration & Catalog (/api/v1/catalog)
 ├── Quotation & Pricing Engine (/api/v1/quotes)
 ├── Approval Workflow (/api/v1/approvals)
 ├── Recommendations (/api/v1/recommendations)
 ├── Fulfillment & Warehouse (/api/v1/fulfillment)
 ├── Subscriptions & Invoicing (/api/v1/billing)
 ├── Customer Portal (/api/v1/portal)
 └── Deal Health Analytics (/api/v1/analytics)
```

---

## 3. Architecture Clarifications & Proposed Decisions

Here are the 5 architectural decisions designed for optimal hackathon performance and clean code separation:

### Decision 1: Database Setup & Remote Tunnel
- **Target:** Connect to the verified PostgreSQL instance over the active tunnel.
- **Approach:** Create dedicated DealFlow360 tables in the public schema (`products`, `price_lists`, `discount_rules`, `quotes`, `quote_lines`, `approval_chains`, `approval_logs`, `warehouses`, `warehouse_stock`, `orders`, `fulfillment_splits`, `subscriptions`, `invoices`, `deal_alerts`).

### Decision 2: Blended Discount Risk Algorithm
- **Formula:**
  1. For each line $i$: $\text{Allowed}_i = \min(\text{CustomerTierLimit}, \text{CategoryLimit}_i)$
  2. $\text{Excess}_i = \max(0, \text{DiscountGiven}_i - \text{Allowed}_i)$
  3. $\text{LineRisk}_i = \text{Excess}_i \times \text{LineTotalBeforeDiscount}_i$
  4. $\text{BlendedScore} = \frac{\sum \text{LineRisk}_i}{\text{QuoteTotalBeforeDiscount}} \times 100$
- **Routing Rules:**
  - `BlendedScore == 0` $\rightarrow$ **Auto-Approved**
  - `0 < BlendedScore <= 5%` (or any single line excess $\le 5\%$) $\rightarrow$ **Requires Sales Manager**
  - `BlendedScore > 5%` (or any single line excess $> 5\%$) $\rightarrow$ **Requires Sales Manager + Finance**

### Decision 3: Customer Negotiation Portal Security
- Each quotation has a cryptographically secure `portal_token` (UUIDv4).
- The portal route `/api/v1/portal/quotes/:token` strips internal margins, costs, and internal approval logs.
- Customers can add line-level comments, counter a discount, and confirm the deal.
- Proposing a counter-discount re-evaluates the Blended Risk Score and re-routes to Manager/Finance if thresholds are breached.

### Decision 4: Multi-Warehouse Auto-Split Heuristic
1. Check if any single warehouse can fulfill 100% of physical items (prioritize lowest shipping weight/cost).
2. If split required: fulfill greedily from the warehouse with the highest available inventory, and allocate remainder to secondary depots.
3. If total stock < requested quantity: allocate available units and mark the balance as `backordered`.
4. Provide an API endpoint for Sales Ops to perform manual overrides.

### Decision 5: Hybrid Billing & Proration Calculation
- **One-time Lines:** Immediate invoice generated upon quote confirmation.
- **Subscription Lines:** Generates recurring billing schedule (monthly / quarterly / yearly).
- **Mid-cycle Changes:** $\text{ProrationAdjustment} = (\text{NewQty} - \text{OldQty}) \times \frac{\text{UnitPrice}}{\text{DaysInCycle}} \times \text{DaysRemaining}$.

---

## 4. Phase Plan for Implementation

```
Phase 1: DB Schema & Drizzle Models (all tables & relationships)
Phase 2: Core Domain Logic & Unit Tests (Blended Risk, Warehouse Split, Billing Proration)
Phase 3: Route Handlers, Zod Schemas & Swagger API Specs
Phase 4: Customer Portal & RBAC Security Layer
Phase 5: Deal Health Analytics Engine & Seed Data Script
```
