# DealFlow360 — Frontend API Contract

> **Base URL:** `http://localhost:5000/api/v1` (or your backend tunnel/server URL)  
> **Auth Type:** `Authorization: Bearer <JWT_TOKEN>` (for internal staff: admin, manager, rep, finance)  
> **Customer Portal Auth:** Public token URL parameter (`/portal/quotes/:token`), no JWT required  
> **Content-Type:** `application/json`

---

## 1. Global Standards & Conventions

### 1.1 Success Response Wrapper
All successful responses return HTTP `200` (or `201 Created`) with the standard JSON envelope:
```json
{
  "success": true,
  "data": { ... }
}
```

For paginated lists:
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 120,
    "totalPages": 6
  }
}
```

### 1.2 Error Response Wrapper
All error responses return HTTP `4xx` or `5xx` with:
```json
{
  "success": false,
  "message": "Human-readable error message",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email address format"
    }
  ]
}
```

### 1.3 Common HTTP Status Codes
| Code | Meaning | When Used |
|------|---------|-----------|
| `200 OK` | Success | Standard GET, PATCH, and action responses |
| `201 Created` | Resource Created | Successful POST entity creation |
| `400 Bad Request` | Validation Error | Missing/invalid body fields or query params |
| `401 Unauthorized` | Unauthenticated | Missing or expired JWT token |
| `403 Forbidden` | Access Denied | User role does not have required permission |
| `404 Not Found` | Not Found | Resource ID or token does not exist |
| `409 Conflict` | Unique Violation | Duplicate email, category name, quote number |
| `500 Server Error` | Internal Error | Uncaught server exception |

---

## 2. Key Enums & Domain Types

### User Roles
```ts
type UserRole = "admin" | "manager" | "rep" | "finance";
```

### Quotation State Machine
```
draft ──► submitted ──► pending_manager ──► pending_finance ──► approved ──► fulfillment ──► confirmed ──► invoiced
                                                               └──► rejected (terminal)
                                                  ▲
                                                  └── revision (returns back to draft)
```
```ts
type QuoteStatus = 
  | "draft"
  | "submitted"
  | "pending_manager"
  | "pending_finance"
  | "approved"
  | "fulfillment"
  | "confirmed"
  | "invoiced"
  | "rejected";

type ApprovalRoute = "auto" | "manager" | "manager_finance";
type ApprovalAction = "approved" | "rejected" | "returned_for_revision";
type ApprovalLevel = "manager" | "finance";
```

### Subscriptions & Billing
```ts
type RecurringInterval = "monthly" | "quarterly" | "yearly";
type SubscriptionStatus = "active" | "paused" | "cancelled";
type InvoiceType = "one_time" | "recurring" | "credit_note";
type InvoiceStatus = "draft" | "sent" | "paid" | "cancelled";
type BillingScheduleStatus = "upcoming" | "invoiced" | "paid";
```

### Warehouse & Fulfillment
```ts
type FulfillmentStatus = "pending" | "shipped" | "delivered";
```

### Analytics & Alerts
```ts
type AlertType = "stalled" | "discount_anomaly" | "delivery_risk";
type AlertSeverity = "info" | "warning" | "critical";
```

---

## 3. Endpoints by Module

---

### 🔑 Module 1: Auth (`/api/v1/auth`)

#### 1. Register User
- **Method:** `POST /api/v1/auth/register`
- **Auth:** Public
- **Request Body:**
```json
{
  "name": "Sarah Connor",
  "email": "sarah@company.com",
  "password": "SecurePassword123!",
  "role": "rep" // Optional, defaults to "rep". Allowed: "admin" | "manager" | "rep" | "finance"
}
```
- **Response `201 Created`:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "name": "Sarah Connor",
      "email": "sarah@company.com",
      "role": "rep",
      "avatar_url": null,
      "github_url": null,
      "created_at": "2026-09-05T10:00:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

#### 2. Login
- **Method:** `POST /api/v1/auth/login`
- **Auth:** Public
- **Request Body:**
```json
{
  "email": "sarah@company.com",
  "password": "SecurePassword123!"
}
```
- **Response `200 OK`:** Same structure as Register.

#### 3. Refresh Access Token
- **Method:** `POST /api/v1/auth/refresh`
- **Auth:** Public
- **Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

#### 4. Get Current User Profile
- **Method:** `GET /api/v1/auth/me`
- **Auth:** `Bearer <JWT>` (Any role)
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Sarah Connor",
    "email": "sarah@company.com",
    "role": "rep",
    "avatar_url": "https://...",
    "created_at": "2026-09-05T10:00:00.000Z"
  }
}
```

#### 5. Logout
- **Method:** `POST /api/v1/auth/logout`
- **Auth:** `Bearer <JWT>`
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### 👥 Module 2: Customers & Tiers (`/api/v1/customers`)

#### 1. List Customer Tiers
- **Method:** `GET /api/v1/customers/tiers`
- **Auth:** `Bearer <JWT>`
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Bronze",
      "max_discount_pct": 5.0,
      "created_at": "2026-09-01T00:00:00.000Z"
    },
    {
      "id": 2,
      "name": "Silver",
      "max_discount_pct": 10.0,
      "created_at": "2026-09-01T00:00:00.000Z"
    },
    {
      "id": 3,
      "name": "Gold",
      "max_discount_pct": 15.0,
      "created_at": "2026-09-01T00:00:00.000Z"
    }
  ]
}
```

#### 2. Create Customer Tier
- **Method:** `POST /api/v1/customers/tiers`
- **Auth:** `Bearer <JWT>` (Role: `admin`)
- **Request Body:**
```json
{
  "name": "Platinum",
  "max_discount_pct": 20.0
}
```

#### 3. List Customers
- **Method:** `GET /api/v1/customers`
- **Auth:** `Bearer <JWT>`
- **Query Params:**
  - `search` *(string, optional)* — filters by name or email
  - `tier_id` *(number, optional)*
  - `page` *(number, default 1)*
  - `limit` *(number, default 20)*
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "id": 10,
      "name": "Acme Corp",
      "email": "procurement@acme.com",
      "tier_id": 3,
      "tier": {
        "id": 3,
        "name": "Gold",
        "max_discount_pct": 15.0
      },
      "created_at": "2026-09-01T00:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

#### 4. Create Customer
- **Method:** `POST /api/v1/customers`
- **Auth:** `Bearer <JWT>`
- **Request Body:**
```json
{
  "name": "Initech Systems",
  "email": "orders@initech.com",
  "tier_id": 2
}
```

#### 5. Get Customer by ID
- **Method:** `GET /api/v1/customers/:id`
- **Auth:** `Bearer <JWT>`

#### 6. Update Customer
- **Method:** `PATCH /api/v1/customers/:id`
- **Auth:** `Bearer <JWT>`
- **Request Body:**
```json
{
  "name": "Initech Systems Inc.",
  "tier_id": 3
}
```

---

### 📦 Module 3: Catalog & Pricing (`/api/v1/catalog`)

#### 1. List Product Categories
- **Method:** `GET /api/v1/catalog/categories`
- **Auth:** `Bearer <JWT>`
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "Hardware", "max_discount_pct": 15.0 },
    { "id": 2, "name": "Software", "max_discount_pct": 20.0 },
    { "id": 3, "name": "Services", "max_discount_pct": 10.0 },
    { "id": 4, "name": "Subscriptions", "max_discount_pct": 15.0 }
  ]
}
```

#### 2. Create Category
- **Method:** `POST /api/v1/catalog/categories`
- **Auth:** `Bearer <JWT>` (Role: `admin`)
- **Request Body:**
```json
{
  "name": "Networking",
  "max_discount_pct": 12.5
}
```

#### 3. List Products
- **Method:** `GET /api/v1/catalog/products`
- **Auth:** `Bearer <JWT>`
- **Query Params:**
  - `category_id` *(number, optional)*
  - `search` *(string, optional)*
  - `is_active` *(boolean, optional, default true)*
  - `page` *(number, default 1)*
  - `limit` *(number, default 50)*
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "id": 101,
      "name": "Enterprise Server Rack X1",
      "description": "42U standard high-density server rack",
      "category_id": 1,
      "category": { "id": 1, "name": "Hardware", "max_discount_pct": 15.0 },
      "base_price": 2500.00,
      "cost_price": 1600.00,
      "unit": "unit",
      "tax_pct": 8.5,
      "is_recurring": false,
      "recurring_interval": null,
      "is_active": true,
      "variants": [
        { "id": 1, "attribute_name": "Power", "attribute_value": "Dual PSU", "extra_price": 300.00 }
      ]
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 1, "totalPages": 1 }
}
```

#### 4. Create Product
- **Method:** `POST /api/v1/catalog/products`
- **Auth:** `Bearer <JWT>` (Role: `admin`)
- **Request Body:**
```json
{
  "name": "Cloud Security Suite SaaS",
  "description": "Per-seat annual security license",
  "category_id": 4,
  "base_price": 49.00,
  "cost_price": 12.00,
  "unit": "license",
  "tax_pct": 0,
  "is_recurring": true,
  "recurring_interval": "monthly" // "monthly" | "quarterly" | "yearly"
}
```

#### 5. Get Product Detail with Variants
- **Method:** `GET /api/v1/catalog/products/:id`
- **Auth:** `Bearer <JWT>`

#### 6. Update Product
- **Method:** `PATCH /api/v1/catalog/products/:id`
- **Auth:** `Bearer <JWT>` (Role: `admin`)

#### 7. Add Product Variant
- **Method:** `POST /api/v1/catalog/products/:id/variants`
- **Auth:** `Bearer <JWT>` (Role: `admin`)
- **Request Body:**
```json
{
  "attribute_name": "Support Tier",
  "attribute_value": "24/7 Dedicated Support",
  "extra_price": 150.00
}
```

#### 8. Price Lists & Overrides
- `GET /api/v1/catalog/price-lists` — Get all price lists
- `POST /api/v1/catalog/price-lists` *(admin)* — Body: `{ name, tier_id?, currency }`
- `POST /api/v1/catalog/price-lists/:id/items` *(admin)* — Body: `{ product_id, unit_price }`

---

### ⚙️ Module 4: Discount Rules (`/api/v1/discount-rules`)

#### 1. List Discount Rules
- **Method:** `GET /api/v1/discount-rules`
- **Auth:** `Bearer <JWT>`
- **Query Params:** `?tier_id=3&category_id=1`
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "tier_id": 3,
      "tier_name": "Gold",
      "category_id": 1,
      "category_name": "Hardware",
      "max_discount_pct": 15.0,
      "manager_threshold_pct": 10.0, // Discount > 10% requires Manager approval
      "finance_threshold_pct": 15.0  // Discount > 15% requires Finance approval
    }
  ]
}
```

#### 2. Create Discount Rule
- **Method:** `POST /api/v1/discount-rules`
- **Auth:** `Bearer <JWT>` (Role: `admin`)
- **Request Body:**
```json
{
  "tier_id": 3,
  "category_id": 1,
  "max_discount_pct": 15.0,
  "manager_threshold_pct": 8.0,
  "finance_threshold_pct": 12.0
}
```

#### 3. Update Discount Rule
- **Method:** `PATCH /api/v1/discount-rules/:id`
- **Auth:** `Bearer <JWT>` (Role: `admin`)

---

### 📋 Module 5: Quotes & Line Items (`/api/v1/quotes`)

#### 1. List Quotes
- **Method:** `GET /api/v1/quotes`
- **Auth:** `Bearer <JWT>`
- **Query Params:**
  - `status` *(string, optional)* — `draft`, `pending_manager`, `pending_finance`, `approved`, etc.
  - `customer_id` *(number, optional)*
  - `rep_id` *(number, optional)*
  - `page` *(number, default 1)*
  - `limit` *(number, default 20)*
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "id": 42,
      "quote_number": "QT-2026-0042",
      "customer_id": 10,
      "customer_name": "Acme Corp",
      "rep_id": 1,
      "rep_name": "Sarah Connor",
      "status": "draft",
      "portal_token": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "subtotal": 5000.00,
      "total_discount": 500.00,
      "total_tax": 382.50,
      "grand_total": 4882.50,
      "blended_risk_score": 12.5,
      "approval_route": "manager",
      "notes": "End of Q3 promotional offer",
      "expires_at": "2026-10-01T00:00:00.000Z",
      "created_at": "2026-09-05T11:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

#### 2. Create Draft Quote
- **Method:** `POST /api/v1/quotes`
- **Auth:** `Bearer <JWT>` (Role: `rep` or `admin`)
- **Request Body:**
```json
{
  "customer_id": 10,
  "notes": "Standard renewal package",
  "expires_at": "2026-10-15T23:59:59.000Z" // Optional
}
```
- **Response `201 Created`:** Returns created quote with generated `quote_number`, `portal_token`, and initial status `draft`.

#### 3. Get Full Quote Details (with computed lines & margins)
- **Method:** `GET /api/v1/quotes/:id`
- **Auth:** `Bearer <JWT>`
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "id": 42,
    "quote_number": "QT-2026-0042",
    "customer": {
      "id": 10,
      "name": "Acme Corp",
      "email": "procurement@acme.com",
      "tier": { "id": 3, "name": "Gold", "max_discount_pct": 15.0 }
    },
    "rep": {
      "id": 1,
      "name": "Sarah Connor",
      "email": "sarah@company.com"
    },
    "status": "draft",
    "portal_token": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "subtotal": 5000.00,
    "total_discount": 500.00,
    "total_tax": 382.50,
    "grand_total": 4882.50,
    "blended_risk_score": 12.5,
    "approval_route": "manager",
    "notes": "Standard renewal package",
    "expires_at": "2026-10-15T23:59:59.000Z",
    "lines": [
      {
        "id": 101,
        "product_id": 101,
        "product_name": "Enterprise Server Rack X1",
        "variant_id": 1,
        "variant_name": "Dual PSU",
        "quantity": 2,
        "unit_price": 2800.00,
        "cost_price": 1600.00,
        "discount_pct": 10.0,
        "discount_amount": 560.00,
        "line_total": 5040.00,
        "margin_pct": 36.5,
        "allowed_discount_pct": 15.0,
        "excess_pct": 0.0,
        "is_recurring": false,
        "is_upsell": false
      }
    ],
    "approval_logs": []
  }
}
```

#### 4. Add Line Item to Quote
- **Method:** `POST /api/v1/quotes/:id/lines`
- **Auth:** `Bearer <JWT>` (Role: `rep`, `admin`)
- **Request Body:**
```json
{
  "product_id": 101,
  "variant_id": 1,        // Optional
  "quantity": 2,
  "discount_pct": 12.5,   // Optional, defaults to 0
  "is_upsell": false      // Optional, true if accepted from upsell suggestion
}
```
- **Response `201 Created`:** Returns updated line and recomputed quote summary.

#### 5. Update Line Item
- **Method:** `PATCH /api/v1/quotes/:id/lines/:lineId`
- **Auth:** `Bearer <JWT>`
- **Request Body:**
```json
{
  "quantity": 3,
  "discount_pct": 14.0
}
```

#### 6. Delete Line Item
- **Method:** `DELETE /api/v1/quotes/:id/lines/:lineId`
- **Auth:** `Bearer <JWT>`

#### 7. Submit Quote for Approval / Auto-Route
- **Method:** `POST /api/v1/quotes/:id/submit`
- **Auth:** `Bearer <JWT>` (Role: `rep`, `admin`)
- **Description:** Runs Blended Risk engine on all line items.
  - If score < manager threshold → status becomes `approved` (route `auto`)
  - If score >= manager threshold but < finance threshold → status becomes `pending_manager` (route `manager`)
  - If score >= finance threshold → status becomes `pending_manager` (route `manager_finance`)
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "quote_id": 42,
    "status": "pending_manager",
    "blended_risk_score": 14.25,
    "approval_route": "manager_finance",
    "message": "Quote submitted and routed to Manager approval."
  }
}
```

#### 8. Confirm Quote (After Approval)
- **Method:** `POST /api/v1/quotes/:id/confirm`
- **Auth:** `Bearer <JWT>` (Role: `rep`, `admin`)
- **Description:** Moves quote from `approved` to `fulfillment` stage. Pre-generates subscription schedules and invoices if recurring lines exist.
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "quote_id": 42,
    "status": "fulfillment"
  }
}
```

---

### 🛡️ Module 6: Approvals (`/api/v1/approvals`)

#### 1. Get Quotes Pending Approval
- **Method:** `GET /api/v1/approvals/pending`
- **Auth:** `Bearer <JWT>` (Role: `manager` or `finance`)
- **Response `200 OK`:** Returns all quotes where `status == "pending_manager"` (for managers) or `status == "pending_finance"` (for finance).

#### 2. Get Quote Approval Audit Logs
- **Method:** `GET /api/v1/approvals/quotes/:quoteId/logs`
- **Auth:** `Bearer <JWT>`
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "quote_id": 42,
      "reviewer": { "id": 2, "name": "Manager Mike", "role": "manager" },
      "action": "approved",
      "level": "manager",
      "reason": "Discount approved due to enterprise commitment.",
      "created_at": "2026-09-05T12:00:00.000Z"
    }
  ]
}
```

#### 3. Approve Quote
- **Method:** `POST /api/v1/approvals/quotes/:quoteId/approve`
- **Auth:** `Bearer <JWT>` (Role: `manager` or `finance`)
- **Request Body:**
```json
{
  "reason": "Looks good, margin acceptable." // Optional
}
```
- **State Transition:**
  - If at `pending_manager` and route is `manager_finance` ➔ moves to `pending_finance`
  - If at `pending_manager` and route is `manager` ➔ moves to `approved`
  - If at `pending_finance` ➔ moves to `approved`

#### 4. Reject Quote
- **Method:** `POST /api/v1/approvals/quotes/:quoteId/reject`
- **Auth:** `Bearer <JWT>` (Role: `manager` or `finance`)
- **Request Body:**
```json
{
  "reason": "Margin below minimum policy of 20%."
}
```
- **State Transition:** Status becomes `rejected` (terminal state).

#### 5. Return for Revision
- **Method:** `POST /api/v1/approvals/quotes/:quoteId/revise`
- **Auth:** `Bearer <JWT>` (Role: `manager` or `finance`)
- **Request Body:**
```json
{
  "reason": "Please lower discount on Hardware line item to max 8%."
}
```
- **State Transition:** Status reverts to `draft` so rep can edit lines and re-submit.

---

### 💡 Module 7: Upsell & Recommendations (`/api/v1/recommendations`)

#### 1. Get Upsell Suggestions for Active Quote
- **Method:** `GET /api/v1/recommendations/quotes/:quoteId/suggestions`
- **Auth:** `Bearer <JWT>`
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "product_id": 105,
      "product_name": "1-Year Extended Warranty Support",
      "base_price": 300.00,
      "cost_price": 50.00,
      "margin_pct": 83.3,
      "is_promoted": true,
      "rank": 10,
      "reason": "Frequently bought together with Enterprise Server Rack X1"
    }
  ]
}
```

#### 2. Manage Upsell Rules (Admin)
- `GET /api/v1/recommendations/rules` — List all configured rules
- `POST /api/v1/recommendations/rules` — Create rule:
```json
{
  "source_product_id": 101,
  "suggested_product_id": 105,
  "rank": 10,
  "is_promoted": true,
  "min_margin_pct": 25.0
}
```
- `DELETE /api/v1/recommendations/rules/:id` — Delete rule

---

### 🏭 Module 8: Fulfillment & Multi-Warehouse Split (`/api/v1/fulfillment`)

#### 1. Get Automated Warehouse Split Recommendation
- **Method:** `GET /api/v1/fulfillment/quotes/:quoteId/split`
- **Auth:** `Bearer <JWT>`
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "quote_id": 42,
    "splits": [
      {
        "quote_line_id": 101,
        "product_id": 101,
        "product_name": "Enterprise Server Rack X1",
        "warehouse_id": 1,
        "warehouse_name": "Main East Hub",
        "quantity": 2,
        "is_backordered": false
      }
    ],
    "backordered": [],
    "total_shipments": 1,
    "can_fulfill_completely": true
  }
}
```

#### 2. Accept Automated Split
- **Method:** `POST /api/v1/fulfillment/quotes/:quoteId/split/accept`
- **Auth:** `Bearer <JWT>` (Role: `rep`, `finance`, `admin`)
- **Description:** Commits splits, creates `fulfillment_splits` records, and decrements stock in warehouse.

#### 3. Manual Split Override
- **Method:** `POST /api/v1/fulfillment/quotes/:quoteId/split/override`
- **Auth:** `Bearer <JWT>`
- **Request Body:**
```json
{
  "splits": [
    { "quote_line_id": 101, "warehouse_id": 1, "quantity": 1 },
    { "quote_line_id": 101, "warehouse_id": 2, "quantity": 1 }
  ]
}
```

#### 4. Warehouse & Stock Management (Admin)
- `GET /api/v1/fulfillment/warehouses` — List all warehouses
- `POST /api/v1/fulfillment/warehouses` — Create warehouse `{ name, location, shipping_cost_weight }`
- `GET /api/v1/fulfillment/warehouses/:id/stock` — Get warehouse inventory
- `POST /api/v1/fulfillment/warehouses/:id/stock` — Update inventory `{ product_id, quantity, reorder_level }`

---

### 💳 Module 9: Subscriptions & Invoicing (`/api/v1/billing`)

#### 1. List Subscriptions
- **Method:** `GET /api/v1/billing/subscriptions`
- **Auth:** `Bearer <JWT>`
- **Query Params:** `?customer_id=10&status=active`

#### 2. Get Subscription Detail & Full Schedule
- **Method:** `GET /api/v1/billing/subscriptions/:id`
- **Auth:** `Bearer <JWT>`
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "id": 5,
    "quote_id": 42,
    "customer_id": 10,
    "product_id": 201,
    "product_name": "Cloud Security Suite SaaS",
    "quantity": 10,
    "unit_price": 49.00,
    "interval": "monthly",
    "status": "active",
    "starts_at": "2026-09-01T00:00:00.000Z",
    "current_period_start": "2026-09-01T00:00:00.000Z",
    "current_period_end": "2026-10-01T00:00:00.000Z",
    "schedules": [
      {
        "id": 501,
        "period_start": "2026-09-01T00:00:00.000Z",
        "period_end": "2026-10-01T00:00:00.000Z",
        "amount": 490.00,
        "status": "invoiced",
        "invoice_id": 12
      },
      {
        "id": 502,
        "period_start": "2026-10-01T00:00:00.000Z",
        "period_end": "2026-11-01T00:00:00.000Z",
        "amount": 490.00,
        "status": "upcoming",
        "invoice_id": null
      }
    ]
  }
}
```

#### 3. Update Subscription (Mid-cycle seat change / Proration)
- **Method:** `PATCH /api/v1/billing/subscriptions/:id`
- **Auth:** `Bearer <JWT>` (Role: `finance`, `admin`)
- **Request Body:**
```json
{
  "quantity": 15 // Scale seats up from 10 to 15
}
```

#### 4. Cancel Subscription (Generates Prorated Credit Note)
- **Method:** `POST /api/v1/billing/subscriptions/:id/cancel`
- **Auth:** `Bearer <JWT>` (Role: `finance`, `admin`)

#### 5. List Invoices
- **Method:** `GET /api/v1/billing/invoices`
- **Auth:** `Bearer <JWT>`
- **Query Params:** `?customer_id&status&type&page&limit`

#### 6. Get Invoice Detail
- **Method:** `GET /api/v1/billing/invoices/:id`
- **Auth:** `Bearer <JWT>`

#### 7. Mark Invoice as Paid
- **Method:** `POST /api/v1/billing/invoices/:id/pay`
- **Auth:** `Bearer <JWT>` (Role: `finance`, `admin`)
- **Response `200 OK`:** Updates invoice `status` to `paid` and sets `paid_at` timestamp.

---

### 🌐 Module 10: Customer Portal (`/api/v1/portal`) — *Public Magic Link*

> ⚠️ **No JWT Authentication required for this module!**  
> All access is guarded by the unique `token` in the URL parameter.  
> Internal metrics like `cost_price`, `margin_pct`, `blended_risk_score`, and internal `notes` are completely stripped from responses.

#### 1. View Customer Quotation
- **Method:** `GET /api/v1/portal/quotes/:token`
- **Auth:** None (Portal Token)
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "quote_number": "QT-2026-0042",
    "customer_name": "Acme Corp",
    "status": "draft",
    "subtotal": 5000.00,
    "total_discount": 500.00,
    "total_tax": 382.50,
    "grand_total": 4882.50,
    "expires_at": "2026-10-15T23:59:59.000Z",
    "lines": [
      {
        "id": 101,
        "product_name": "Enterprise Server Rack X1",
        "variant_name": "Dual PSU",
        "quantity": 2,
        "unit_price": 2800.00,
        "discount_pct": 10.0,
        "discount_amount": 560.00,
        "line_total": 5040.00,
        "is_recurring": false
      }
    ],
    "comments": [
      {
        "id": 1,
        "author_type": "rep",
        "author_name": "Sarah Connor",
        "message": "Here is the discounted offer for the Q3 refresh.",
        "created_at": "2026-09-05T11:05:00.000Z"
      }
    ]
  }
}
```

#### 2. Post Customer Comment / Counter-Discount
- **Method:** `POST /api/v1/portal/quotes/:token/comments`
- **Auth:** None (Portal Token)
- **Request Body:**
```json
{
  "quote_line_id": 101,             // Optional (line-level or overall)
  "message": "Can we get 15% discount on the server rack?",
  "counter_discount_pct": 15.0      // Optional
}
```
- **Response `201 Created`:** Appends comment and alerts sales rep.

#### 3. Customer Accept & Confirm Quote
- **Method:** `POST /api/v1/portal/quotes/:token/confirm`
- **Auth:** None (Portal Token)
- **Description:** Customer accepts the quote.
  - If counter-discount is within allowed limits ➔ transitions to `fulfillment`.
  - If counter-discount exceeds allowed threshold ➔ triggers approval workflow (`pending_manager` / `pending_finance`).
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "status": "confirmed",
    "message": "Thank you! Your quotation has been confirmed and submitted for processing."
  }
}
```

---

### 📊 Module 11: Deal Health & Analytics (`/api/v1/analytics`)

#### 1. Deal Health & Risk Overview
- **Method:** `GET /api/v1/analytics/deal-health`
- **Auth:** `Bearer <JWT>` (Role: `manager` or `admin`)
- **Query Params:** `?stalled_days=7`
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "stalled_quotes": [
      {
        "id": 38,
        "quote_number": "QT-2026-0038",
        "customer_name": "Wayne Enterprises",
        "days_inactive": 12,
        "grand_total": 14200.00,
        "rep_name": "Sarah Connor"
      }
    ],
    "discount_anomalies": [
      {
        "id": 41,
        "quote_number": "QT-2026-0041",
        "rep_name": "Bob Vance",
        "excess_pct": 8.5,
        "blended_risk_score": 24.0
      }
    ],
    "delivery_risks": [
      {
        "quote_id": 39,
        "product_name": "Blade Server X5",
        "shortage_quantity": 4
      }
    ]
  }
}
```

#### 2. List Deal Alerts
- **Method:** `GET /api/v1/analytics/alerts`
- **Auth:** `Bearer <JWT>` (Role: `manager`, `admin`)
- **Query Params:** `?type=stalled&is_resolved=false&page=1&limit=20`
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "quote_id": 38,
      "type": "stalled",
      "severity": "warning",
      "message": "Quote QT-2026-0038 has had no customer activity for 12 days.",
      "is_resolved": false,
      "created_at": "2026-09-04T08:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

#### 3. Resolve Alert
- **Method:** `POST /api/v1/analytics/alerts/:id/resolve`
- **Auth:** `Bearer <JWT>` (Role: `manager`, `admin`)

#### 4. Escalate Alert
- **Method:** `POST /api/v1/analytics/alerts/:id/escalate`
- **Auth:** `Bearer <JWT>` (Role: `manager`, `admin`)
- **Request Body:**
```json
{
  "message": "Please follow up with customer by EOD."
}
```

#### 5. Sales & Margin Report
- **Method:** `GET /api/v1/analytics/reports/sales`
- **Auth:** `Bearer <JWT>` (Role: `manager`, `admin`)
- **Query Params:** `?period=monthly&rep_id=1&category_id=1`
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "total_quotes": 45,
    "total_revenue": 248500.00,
    "avg_discount_pct": 7.4,
    "avg_margin_pct": 32.8,
    "by_rep": [
      { "rep_id": 1, "rep_name": "Sarah Connor", "quotes": 22, "revenue": 140000.00 }
    ],
    "by_category": [
      { "category_id": 1, "category_name": "Hardware", "revenue": 160000.00 }
    ]
  }
}
```

---

## 4. Quick Reference Cheatsheet for Frontend Devs

| Feature / Screen | Endpoints to Call |
|------------------|-------------------|
| **Login / Session** | `POST /auth/login`, `GET /auth/me`, `POST /auth/refresh` |
| **Catalog Browsing / Cart** | `GET /catalog/products`, `GET /catalog/categories`, `GET /catalog/products/:id` |
| **Customer Selector** | `GET /customers`, `GET /customers/tiers` |
| **Quote Builder (Draft)** | `POST /quotes`, `POST /quotes/:id/lines`, `PATCH /quotes/:id/lines/:lineId`, `DELETE /quotes/:id/lines/:lineId` |
| **Upsell Suggestions Widget** | `GET /recommendations/quotes/:quoteId/suggestions` |
| **Submit / Route for Approval**| `POST /quotes/:id/submit` |
| **Approvals Inbox (Managers)**| `GET /approvals/pending`, `POST /approvals/quotes/:id/approve`, `POST /approvals/quotes/:id/reject`, `POST /approvals/quotes/:id/revise` |
| **Audit Trail Component** | `GET /approvals/quotes/:quoteId/logs` |
| **Warehouse Split Matrix** | `GET /fulfillment/quotes/:quoteId/split`, `POST /fulfillment/quotes/:quoteId/split/accept` |
| **Customer Magic Link Portal**| `GET /portal/quotes/:token`, `POST /portal/quotes/:token/comments`, `POST /portal/quotes/:token/confirm` |
| **Subscriptions & Invoices** | `GET /billing/subscriptions/:id`, `GET /billing/invoices`, `POST /billing/invoices/:id/pay` |
| **Deal Health & Alerts** | `GET /analytics/deal-health`, `GET /analytics/alerts`, `POST /analytics/alerts/:id/resolve` |
