================================================================================
                         DEALFLOW360 DATABASE SCHEMA
================================================================================

DATABASE: PostgreSQL
PRIMARY KEY: UUID
TIME: TIMESTAMPTZ
MONEY: NUMERIC(19,4)
PERCENTAGES: NUMERIC(7,4)
QUANTITIES: NUMERIC(19,4)

================================================================================
0. GLOBAL DESIGN RULES
================================================================================

1. Every table has a UUID primary key unless explicitly stated otherwise.

2. All business records use created_at and updated_at where mutable.

3. Users NEVER receive data access merely because they know a record ID.

4. Authorization has THREE layers:

       ROLE
         |
         +--> PERMISSION = WHAT can the user do?
         |
         +--> DATA SCOPE = WHICH rows can the user access?
         |
         +--> RESOURCE STATE = Is the operation allowed in the current state?

5. Internal users and customer portal users use the same users table but have
   different user_type values and different permission sets.

6. Customer users can ONLY access records belonging to their customer.

7. Sales representatives can access quotations/orders belonging to themselves.

8. Sales managers can access quotations/orders belonging to their assigned
   sales teams.

9. Finance users can access financial records and quotations assigned to
   finance approval.

10. Operations users can access fulfillment/inventory records.

11. Administrators can access all tenant data and configuration.

12. Approved commercial values are SNAPSHOTS. Historical quotations/orders
    must not change when product prices, discount rules, tax rules, etc. change.

13. Audit logs are append-only.

14. Customer-visible negotiation history is separate from internal audit logs.

15. Application authorization MUST be enforced server-side.
    PostgreSQL RLS SHOULD additionally protect sensitive business tables.

================================================================================
1. USERS / AUTHENTICATION / AUTHORIZATION
================================================================================

TABLE: users

id                  UUID PRIMARY KEY
email               CITEXT UNIQUE NOT NULL
password_hash       TEXT NULL
first_name          VARCHAR(100) NOT NULL
last_name           VARCHAR(100) NOT NULL
user_type           VARCHAR(20) NOT NULL
                    -- INTERNAL
                    -- CUSTOMER
is_active           BOOLEAN NOT NULL DEFAULT TRUE
last_login_at       TIMESTAMPTZ NULL
created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()


TABLE: roles

id                  UUID PRIMARY KEY
code                VARCHAR(50) UNIQUE NOT NULL
name                VARCHAR(100) NOT NULL
role_type           VARCHAR(20) NOT NULL
                    -- INTERNAL
                    -- CUSTOMER
is_active           BOOLEAN NOT NULL DEFAULT TRUE
created_at          TIMESTAMPTZ NOT NULL DEFAULT now()


INITIAL ROLES:

ADMIN
SALES_REP
SALES_MANAGER
FINANCE
OPERATIONS
CUSTOMER_USER


TABLE: permissions

id                  UUID PRIMARY KEY
code                VARCHAR(100) UNIQUE NOT NULL
resource            VARCHAR(50) NOT NULL
action              VARCHAR(50) NOT NULL
description         TEXT NULL
created_at          TIMESTAMPTZ NOT NULL DEFAULT now()


IMPORTANT PERMISSIONS:

user.read
user.create
user.update
user.disable

role.read
role.create
role.update

customer.read
customer.create
customer.update

product.read
product.create
product.update
product.delete

product_variant.read
product_variant.create
product_variant.update

price_list.read
price_list.create
price_list.update

discount_rule.read
discount_rule.create
discount_rule.update

approval_rule.read
approval_rule.create
approval_rule.update

warehouse.read
warehouse.create
warehouse.update

inventory.read
inventory.update

subscription_plan.read
subscription_plan.create
subscription_plan.update

recommendation_rule.read
recommendation_rule.create
recommendation_rule.update

quotation.read
quotation.create
quotation.update
quotation.submit
quotation.send
quotation.confirm
quotation.cancel

quotation.approve
quotation.reject
quotation.return

quotation.comment
quotation.negotiate

order.read
order.create
order.update
order.cancel

fulfillment.read
fulfillment.allocate
fulfillment.override
fulfillment.complete

backorder.read
backorder.update
backorder.resolve

subscription.read
subscription.create
subscription.modify
subscription.cancel

billing_schedule.read
billing_schedule.update

invoice.read
invoice.create
invoice.update
invoice.void

payment.read
payment.record
payment.refund

credit_note.read
credit_note.create
credit_note.approve

deal_alert.read
deal_alert.resolve

report.read
report.export

audit.read


TABLE: user_roles

user_id             UUID NOT NULL REFERENCES users(id)
role_id             UUID NOT NULL REFERENCES roles(id)
assigned_by         UUID NULL REFERENCES users(id)
created_at          TIMESTAMPTZ NOT NULL DEFAULT now()

PRIMARY KEY (user_id, role_id)


TABLE: role_permissions

role_id             UUID NOT NULL REFERENCES roles(id)
permission_id       UUID NOT NULL REFERENCES permissions(id)
created_at          TIMESTAMPTZ NOT NULL DEFAULT now()

PRIMARY KEY (role_id, permission_id)


================================================================================
2. SALES ORGANIZATION
================================================================================

TABLE: sales_teams

id                  UUID PRIMARY KEY
name                VARCHAR(150) UNIQUE NOT NULL
manager_user_id     UUID NOT NULL REFERENCES users(id)
is_active           BOOLEAN NOT NULL DEFAULT TRUE
created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()


TABLE: sales_team_members

team_id             UUID NOT NULL REFERENCES sales_teams(id)
user_id             UUID NOT NULL REFERENCES users(id)
joined_at           TIMESTAMPTZ NOT NULL DEFAULT now()
left_at             TIMESTAMPTZ NULL

PRIMARY KEY (team_id, user_id)


RELATION:

sales_teams.manager_user_id
        |
        +----> users.id

sales_team_members.team_id
        |
        +----> sales_teams.id

sales_team_members.user_id
        |
        +----> users.id


RULE:

A SALES_REP may belong to one or more sales teams.

A SALES_MANAGER manages one or more teams.

A quotation stores sales_team_id AND sales_rep_id so historical ownership
does not depend on future team membership.


================================================================================
3. CUSTOMERS
================================================================================

TABLE: customer_tiers

id                  UUID PRIMARY KEY
code                VARCHAR(50) UNIQUE NOT NULL
name                VARCHAR(100) NOT NULL
default_discount_limit NUMERIC(7,4) NOT NULL DEFAULT 0
is_active           BOOLEAN NOT NULL DEFAULT TRUE
created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()


TABLE: customers

id                  UUID PRIMARY KEY
customer_code       VARCHAR(100) UNIQUE NOT NULL
name                VARCHAR(200) NOT NULL
customer_tier_id    UUID NOT NULL REFERENCES customer_tiers(id)
currency             CHAR(3) NOT NULL
billing_email        CITEXT NULL
phone               VARCHAR(50) NULL

billing_address     JSONB NULL
shipping_address    JSONB NULL

is_active           BOOLEAN NOT NULL DEFAULT TRUE
created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()


TABLE: customer_users

customer_id         UUID NOT NULL REFERENCES customers(id)
user_id             UUID NOT NULL REFERENCES users(id)
is_primary          BOOLEAN NOT NULL DEFAULT FALSE
created_at          TIMESTAMPTZ NOT NULL DEFAULT now()

PRIMARY KEY (customer_id, user_id)

UNIQUE(customer_id, user_id)


RELATION:

customers
    |
    +----< customer_users >---- users

ONE customer
    -> MANY customer portal users

ONE customer user
    -> MUST belong to at least one customer


CUSTOMER ACCESS RULE:

customer_users.user_id = current_user.id
AND
customer_users.customer_id = target_record.customer_id


================================================================================
4. PRODUCT CATALOG
================================================================================

TABLE: product_categories

id                  UUID PRIMARY KEY
name                VARCHAR(150) UNIQUE NOT NULL
description         TEXT NULL
is_active           BOOLEAN NOT NULL DEFAULT TRUE
created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()


TABLE: products

id                  UUID PRIMARY KEY
sku                 VARCHAR(100) UNIQUE NOT NULL
name                VARCHAR(200) NOT NULL
category_id         UUID NOT NULL REFERENCES product_categories(id)

description         TEXT NULL
unit                VARCHAR(50) NOT NULL

base_price          NUMERIC(19,4) NOT NULL
cost_price          NUMERIC(19,4) NOT NULL
tax_rate            NUMERIC(7,4) NOT NULL DEFAULT 0

product_type        VARCHAR(30) NOT NULL
                    -- ONE_TIME
                    -- SERVICE
                    -- SUBSCRIPTION
                    -- HYBRID

is_active           BOOLEAN NOT NULL DEFAULT TRUE
created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()


TABLE: product_variants

id                  UUID PRIMARY KEY
product_id          UUID NOT NULL REFERENCES products(id)
sku                 VARCHAR(100) UNIQUE NOT NULL
name                VARCHAR(200) NOT NULL

price_delta         NUMERIC(19,4) NOT NULL DEFAULT 0
cost_delta          NUMERIC(19,4) NOT NULL DEFAULT 0

is_active           BOOLEAN NOT NULL DEFAULT TRUE
created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()


TABLE: product_variant_attributes

id                  UUID PRIMARY KEY
variant_id          UUID NOT NULL REFERENCES product_variants(id)
attribute_name      VARCHAR(100) NOT NULL
attribute_value     VARCHAR(200) NOT NULL

UNIQUE(variant_id, attribute_name)


RELATION:

product_categories
        |
        +----< products
                  |
                  +----< product_variants
                              |
                              +----< product_variant_attributes


RULE:

product.cost_price is INTERNAL ONLY.

Customer APIs MUST NEVER expose cost_price.


================================================================================
5. PRICE LISTS
================================================================================

TABLE: price_lists

id                  UUID PRIMARY KEY
code                VARCHAR(100) UNIQUE NOT NULL
name                VARCHAR(150) NOT NULL
currency             CHAR(3) NOT NULL
customer_tier_id    UUID NULL REFERENCES customer_tiers(id)

is_active           BOOLEAN NOT NULL DEFAULT TRUE
valid_from          TIMESTAMPTZ NULL
valid_until         TIMESTAMPTZ NULL

created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()


TABLE: price_list_items

id                  UUID PRIMARY KEY
price_list_id       UUID NOT NULL REFERENCES price_lists(id)
product_id          UUID NOT NULL REFERENCES products(id)
variant_id          UUID NULL REFERENCES product_variants(id)

unit_price          NUMERIC(19,4) NOT NULL
currency             CHAR(3) NOT NULL

valid_from          TIMESTAMPTZ NULL
valid_until         TIMESTAMPTZ NULL

created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()


RELATION:

price_lists
    |
    +----< price_list_items >---- products
                                  |
                                  +---- product_variants


RULE:

quotation_lines MUST snapshot the selected price.

Changing price_list_items MUST NOT alter an existing quotation.


================================================================================
6. DISCOUNT GOVERNANCE
================================================================================

TABLE: discount_tiers

id                  UUID PRIMARY KEY
customer_tier_id    UUID NOT NULL REFERENCES customer_tiers(id)

name                VARCHAR(100) NOT NULL

min_discount        NUMERIC(7,4) NOT NULL
max_discount        NUMERIC(7,4) NOT NULL

risk_level          INTEGER NOT NULL DEFAULT 0

is_active           BOOLEAN NOT NULL DEFAULT TRUE

created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()


TABLE: category_discount_limits

id                  UUID PRIMARY KEY
customer_tier_id    UUID NOT NULL REFERENCES customer_tiers(id)
category_id         UUID NOT NULL REFERENCES product_categories(id)

max_discount        NUMERIC(7,4) NOT NULL

created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()

UNIQUE(customer_tier_id, category_id)


TABLE: approval_rules

id                  UUID PRIMARY KEY
name                VARCHAR(150) NOT NULL

min_risk_score      NUMERIC(10,4) NOT NULL
max_risk_score      NUMERIC(10,4) NOT NULL

required_role_id    UUID NOT NULL REFERENCES roles(id)

sequence_no         INTEGER NOT NULL

is_active           BOOLEAN NOT NULL DEFAULT TRUE

created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()


EXAMPLE:

risk 0-10
    -> no approval

risk 10-30
    -> SALES_MANAGER

risk 30-100
    -> SALES_MANAGER
    -> FINANCE


RELATION:

customer_tiers
      |
      +----< discount_tiers

customer_tiers
      |
      +----< category_discount_limits >---- product_categories

approval_rules
      |
      +---- roles


IMPORTANT:

The discount limit used by a quotation line is determined when the quotation
is calculated and is then SNAPSHOTTED into quotation_lines.allowed_discount.


================================================================================
7. QUOTATIONS
================================================================================

TABLE: quotations

id                  UUID PRIMARY KEY
quotation_number    VARCHAR(100) UNIQUE NOT NULL

customer_id         UUID NOT NULL REFERENCES customers(id)
sales_rep_id        UUID NOT NULL REFERENCES users(id)
sales_team_id       UUID NOT NULL REFERENCES sales_teams(id)

price_list_id       UUID NULL REFERENCES price_lists(id)

currency             CHAR(3) NOT NULL

status              VARCHAR(40) NOT NULL
                    -- DRAFT
                    -- PENDING_APPROVAL
                    -- APPROVED
                    -- REJECTED
                    -- RETURNED_FOR_REVISION
                    -- SENT
                    -- UNDER_NEGOTIATION
                    -- CONFIRMED
                    -- EXPIRED
                    -- CANCELLED

subtotal            NUMERIC(19,4) NOT NULL DEFAULT 0
discount_total      NUMERIC(19,4) NOT NULL DEFAULT 0
tax_total           NUMERIC(19,4) NOT NULL DEFAULT 0
total               NUMERIC(19,4) NOT NULL DEFAULT 0

margin_amount       NUMERIC(19,4) NOT NULL DEFAULT 0
margin_percent      NUMERIC(7,4) NOT NULL DEFAULT 0

risk_score          NUMERIC(10,4) NOT NULL DEFAULT 0

version             INTEGER NOT NULL DEFAULT 1

valid_until         TIMESTAMPTZ NULL

created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
submitted_at        TIMESTAMPTZ NULL
approved_at         TIMESTAMPTZ NULL
sent_at             TIMESTAMPTZ NULL
confirmed_at        TIMESTAMPTZ NULL
cancelled_at        TIMESTAMPTZ NULL


TABLE: quotation_lines

id                  UUID PRIMARY KEY

quotation_id        UUID NOT NULL REFERENCES quotations(id)
product_id          UUID NOT NULL REFERENCES products(id)
variant_id          UUID NULL REFERENCES product_variants(id)

line_number         INTEGER NOT NULL

description         TEXT NULL

quantity            NUMERIC(19,4) NOT NULL

unit_price          NUMERIC(19,4) NOT NULL
cost_price          NUMERIC(19,4) NOT NULL

gross_amount        NUMERIC(19,4) NOT NULL

discount_percent    NUMERIC(7,4) NOT NULL DEFAULT 0
discount_amount     NUMERIC(19,4) NOT NULL DEFAULT 0

tax_rate            NUMERIC(7,4) NOT NULL DEFAULT 0
tax_amount          NUMERIC(19,4) NOT NULL DEFAULT 0

net_amount          NUMERIC(19,4) NOT NULL

allowed_discount    NUMERIC(7,4) NOT NULL
excess_discount     NUMERIC(7,4) NOT NULL DEFAULT 0

risk_score          NUMERIC(10,4) NOT NULL DEFAULT 0

line_type           VARCHAR(20) NOT NULL
                    -- ONE_TIME
                    -- RECURRING

subscription_plan_id UUID NULL
                    REFERENCES subscription_plans(id)

created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()

UNIQUE(quotation_id, line_number)


RULE:

quotation_lines.cost_price is INTERNAL ONLY.

Customer-facing quotation APIs MUST return unit_price/net_amount but NOT
cost_price, margin, allowed_discount, excess_discount or risk_score.


================================================================================
8. QUOTATION APPROVAL WORKFLOW
================================================================================

TABLE: quotation_approvals

id                  UUID PRIMARY KEY

quotation_id        UUID NOT NULL REFERENCES quotations(id)

sequence_no         INTEGER NOT NULL

required_role_id    UUID NOT NULL REFERENCES roles(id)

assigned_user_id    UUID NULL REFERENCES users(id)

status              VARCHAR(30) NOT NULL
                    -- PENDING
                    -- APPROVED
                    -- REJECTED
                    -- RETURNED
                    -- SKIPPED

risk_score          NUMERIC(10,4) NOT NULL

decision            VARCHAR(30) NULL
                    -- APPROVE
                    -- REJECT
                    -- RETURN

reason              TEXT NULL

created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
acted_at            TIMESTAMPTZ NULL

UNIQUE(quotation_id, sequence_no)


APPROVAL RULE:

sequence 2 CANNOT be acted upon until sequence 1 is APPROVED/SKIPPED.

A user may act only if:

    user has quotation.approve/reject/return permission
    AND
    user role matches required_role_id
    AND
    assigned_user_id IS NULL OR assigned_user_id = current_user
    AND
    approval status = PENDING
    AND
    all previous sequences are completed


================================================================================
9. QUOTATION EVENTS / INTERNAL AUDIT
================================================================================

TABLE: quotation_events

id                  UUID PRIMARY KEY

quotation_id        UUID NOT NULL REFERENCES quotations(id)

actor_user_id       UUID NULL REFERENCES users(id)

event_type          VARCHAR(60) NOT NULL
                    -- CREATED
                    -- UPDATED
                    -- LINE_ADDED
                    -- LINE_REMOVED
                    -- DISCOUNT_CHANGED
                    -- SUBMITTED
                    -- APPROVAL_REQUESTED
                    -- APPROVED
                    -- REJECTED
                    -- RETURNED
                    -- SENT
                    -- NEGOTIATION_STARTED
                    -- CUSTOMER_CHANGE_REQUESTED
                    -- TERMS_CHANGED
                    -- REENTERED_APPROVAL
                    -- CONFIRMED
                    -- CANCELLED

old_data            JSONB NULL
new_data            JSONB NULL

reason              TEXT NULL

created_at          TIMESTAMPTZ NOT NULL DEFAULT now()


RULE:

quotation_events is append-only.


================================================================================
10. CUSTOMER NEGOTIATION
================================================================================

TABLE: quotation_change_requests

id                  UUID PRIMARY KEY

quotation_id        UUID NOT NULL REFERENCES quotations(id)

customer_user_id    UUID NOT NULL REFERENCES users(id)

quotation_line_id   UUID NULL REFERENCES quotation_lines(id)

request_type        VARCHAR(40) NOT NULL
                    -- DISCOUNT
                    -- QUANTITY
                    -- PRODUCT
                    -- PRICE
                    -- OTHER

requested_discount  NUMERIC(7,4) NULL

requested_quantity  NUMERIC(19,4) NULL

requested_price     NUMERIC(19,4) NULL

reason              TEXT NULL

status              VARCHAR(30) NOT NULL
                    -- OPEN
                    -- ACCEPTED
                    -- REJECTED
                    -- SUPERSEDED
                    -- WITHDRAWN

created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
resolved_at         TIMESTAMPTZ NULL
resolved_by         UUID NULL REFERENCES users(id)


TABLE: quotation_line_comments

id                  UUID PRIMARY KEY

quotation_id        UUID NOT NULL REFERENCES quotations(id)
quotation_line_id   UUID NOT NULL REFERENCES quotation_lines(id)

user_id             UUID NOT NULL REFERENCES users(id)

comment             TEXT NOT NULL

is_customer_visible BOOLEAN NOT NULL DEFAULT TRUE

created_at          TIMESTAMPTZ NOT NULL DEFAULT now()


TABLE: quotation_public_events

id                  UUID PRIMARY KEY

quotation_id        UUID NOT NULL REFERENCES quotations(id)

event_type          VARCHAR(50) NOT NULL

message             TEXT NOT NULL

created_at          TIMESTAMPTZ NOT NULL DEFAULT now()


CUSTOMER NEGOTIATION RULE:

Customer may only create a change request if:

    customer_users.user_id = current_user
    AND
    customer_users.customer_id = quotation.customer_id
    AND
    quotation.status IN (SENT, UNDER_NEGOTIATION)

Customer confirmation is allowed only if:

    current_user belongs to quotation.customer_id
    AND
    quotation.status IN (SENT, UNDER_NEGOTIATION)


================================================================================
11. ORDERS
================================================================================

TABLE: orders

id                  UUID PRIMARY KEY
order_number        VARCHAR(100) UNIQUE NOT NULL

quotation_id        UUID UNIQUE NOT NULL REFERENCES quotations(id)

customer_id         UUID NOT NULL REFERENCES customers(id)
sales_rep_id        UUID NOT NULL REFERENCES users(id)
sales_team_id       UUID NOT NULL REFERENCES sales_teams(id)

currency             CHAR(3) NOT NULL

status              VARCHAR(40) NOT NULL
                    -- CONFIRMED
                    -- FULFILLING
                    -- PARTIALLY_FULFILLED
                    -- FULFILLED
                    -- CANCELLED

subtotal            NUMERIC(19,4) NOT NULL
discount_total      NUMERIC(19,4) NOT NULL
tax_total           NUMERIC(19,4) NOT NULL
total               NUMERIC(19,4) NOT NULL

created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
confirmed_at        TIMESTAMPTZ NOT NULL


TABLE: order_lines

id                  UUID PRIMARY KEY

order_id            UUID NOT NULL REFERENCES orders(id)
quotation_line_id   UUID NOT NULL REFERENCES quotation_lines(id)

line_number         INTEGER NOT NULL

product_id          UUID NOT NULL REFERENCES products(id)
variant_id          UUID NULL REFERENCES product_variants(id)

description         TEXT NULL

quantity            NUMERIC(19,4) NOT NULL
unit_price          NUMERIC(19,4) NOT NULL
cost_price          NUMERIC(19,4) NOT NULL

discount_amount     NUMERIC(19,4) NOT NULL
tax_amount          NUMERIC(19,4) NOT NULL
net_amount          NUMERIC(19,4) NOT NULL

line_type           VARCHAR(20) NOT NULL
                    -- ONE_TIME
                    -- RECURRING

subscription_plan_id UUID NULL
                    REFERENCES subscription_plans(id)

created_at          TIMESTAMPTZ NOT NULL DEFAULT now()

UNIQUE(order_id, line_number)


RULE:

orders are created ONLY from CONFIRMED quotations.

order_lines are snapshots of quotation_lines.

Later changes to products/prices do not alter orders.


================================================================================
12. WAREHOUSES
================================================================================

TABLE: warehouses

id                  UUID PRIMARY KEY

code                VARCHAR(50) UNIQUE NOT NULL
name                VARCHAR(150) NOT NULL

address             JSONB NULL

shipping_cost_weight NUMERIC(19,4) NOT NULL DEFAULT 1

is_active           BOOLEAN NOT NULL DEFAULT TRUE

created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()


TABLE: warehouse_inventory

id                  UUID PRIMARY KEY

warehouse_id        UUID NOT NULL REFERENCES warehouses(id)

product_id          UUID NOT NULL REFERENCES products(id)

variant_id          UUID NULL REFERENCES product_variants(id)

quantity_on_hand    NUMERIC(19,4) NOT NULL DEFAULT 0
quantity_reserved   NUMERIC(19,4) NOT NULL DEFAULT 0

reorder_level       NUMERIC(19,4) NOT NULL DEFAULT 0
reorder_quantity    NUMERIC(19,4) NOT NULL DEFAULT 0

updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()

UNIQUE(warehouse_id, product_id, variant_id)


AVAILABLE QUANTITY:

quantity_available =
    quantity_on_hand - quantity_reserved


IMPORTANT:

quantity_available SHOULD NOT be independently edited by users.


================================================================================
13. FULFILLMENT
================================================================================

TABLE: fulfillment_orders

id                  UUID PRIMARY KEY

order_id            UUID NOT NULL REFERENCES orders(id)

status              VARCHAR(40) NOT NULL
                    -- PLANNED
                    -- PARTIALLY_FULFILLED
                    -- FULFILLED
                    -- CANCELLED

is_system_generated BOOLEAN NOT NULL DEFAULT TRUE

estimated_shipment_count INTEGER NOT NULL DEFAULT 0

estimated_shipping_cost NUMERIC(19,4) NOT NULL DEFAULT 0

created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()


TABLE: fulfillment_lines

id                  UUID PRIMARY KEY

fulfillment_order_id UUID NOT NULL
                    REFERENCES fulfillment_orders(id)

order_line_id       UUID NOT NULL REFERENCES order_lines(id)

warehouse_id        UUID NOT NULL REFERENCES warehouses(id)

quantity_allocated  NUMERIC(19,4) NOT NULL
quantity_fulfilled  NUMERIC(19,4) NOT NULL DEFAULT 0

status              VARCHAR(30) NOT NULL
                    -- ALLOCATED
                    -- PARTIALLY_FULFILLED
                    -- FULFILLED
                    -- CANCELLED

created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()


RULE:

SUM(fulfillment_lines.quantity_allocated)
for an order_line
MUST NOT exceed order_lines.quantity.

Operations users can change allocation.

Sales reps can VIEW fulfillment but cannot modify allocation unless explicitly
given fulfillment.override.


================================================================================
14. BACKORDERS
================================================================================

TABLE: backorders

id                  UUID PRIMARY KEY

order_line_id       UUID NOT NULL REFERENCES order_lines(id)

quantity_backordered NUMERIC(19,4) NOT NULL
quantity_remaining  NUMERIC(19,4) NOT NULL

status              VARCHAR(40) NOT NULL
                    -- OPEN
                    -- PARTIALLY_RESOLVED
                    -- RESOLVED
                    -- CANCELLED

expected_date       DATE NULL

created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
resolved_at         TIMESTAMPTZ NULL


RULE:

quantity_remaining <= quantity_backordered

quantity_remaining reaches 0
    -> status = RESOLVED


================================================================================
15. SUBSCRIPTION PLANS
================================================================================

TABLE: subscription_plans

id                  UUID PRIMARY KEY

code                VARCHAR(100) UNIQUE NOT NULL
name                VARCHAR(150) NOT NULL

billing_interval    VARCHAR(20) NOT NULL
                    -- MONTH
                    -- QUARTER
                    -- YEAR

interval_count      INTEGER NOT NULL DEFAULT 1

proration_enabled   BOOLEAN NOT NULL DEFAULT TRUE

cancellation_policy JSONB NOT NULL DEFAULT '{}'
refund_policy       JSONB NOT NULL DEFAULT '{}'

is_active           BOOLEAN NOT NULL DEFAULT TRUE

created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()


TABLE: product_subscription_plans

product_id          UUID NOT NULL REFERENCES products(id)
plan_id             UUID NOT NULL REFERENCES subscription_plans(id)

is_default          BOOLEAN NOT NULL DEFAULT FALSE

PRIMARY KEY(product_id, plan_id)


RELATION:

products
    |
    +----< product_subscription_plans >---- subscription_plans


RULE:

Only products with an associated subscription plan may be used as
RECURRING quotation/order lines.


================================================================================
16. CUSTOMER SUBSCRIPTIONS
================================================================================

TABLE: subscriptions

id                  UUID PRIMARY KEY

subscription_number VARCHAR(100) UNIQUE NOT NULL

order_id            UUID NOT NULL REFERENCES orders(id)
customer_id         UUID NOT NULL REFERENCES customers(id)

status              VARCHAR(30) NOT NULL
                    -- ACTIVE
                    -- PAUSED
                    -- CANCELLED
                    -- EXPIRED

start_date          DATE NOT NULL
end_date            DATE NULL

next_billing_date   DATE NULL

currency             CHAR(3) NOT NULL

created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
cancelled_at        TIMESTAMPTZ NULL


TABLE: subscription_lines

id                  UUID PRIMARY KEY

subscription_id     UUID NOT NULL REFERENCES subscriptions(id)

order_line_id       UUID NOT NULL REFERENCES order_lines(id)

product_id          UUID NOT NULL REFERENCES products(id)

plan_id             UUID NOT NULL REFERENCES subscription_plans(id)

quantity            NUMERIC(19,4) NOT NULL

unit_price          NUMERIC(19,4) NOT NULL

current_period_start DATE NOT NULL
current_period_end   DATE NOT NULL

status              VARCHAR(30) NOT NULL
                    -- ACTIVE
                    -- PAUSED
                    -- CANCELLED

created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()


RELATION:

order
  |
  +----< order_lines
              |
              +---- subscription
                      |
                      +----< subscription_lines
                                  |
                                  +---- subscription_plan


================================================================================
17. BILLING
================================================================================

TABLE: billing_schedules

id                  UUID PRIMARY KEY

subscription_id     UUID NOT NULL REFERENCES subscriptions(id)
subscription_line_id UUID NOT NULL REFERENCES subscription_lines(id)

billing_date        DATE NOT NULL

period_start        DATE NOT NULL
period_end          DATE NOT NULL

quantity            NUMERIC(19,4) NOT NULL

base_amount         NUMERIC(19,4) NOT NULL

proration_amount    NUMERIC(19,4) NOT NULL DEFAULT 0

tax_amount          NUMERIC(19,4) NOT NULL DEFAULT 0

total_amount        NUMERIC(19,4) NOT NULL

status              VARCHAR(30) NOT NULL
                    -- PENDING
                    -- INVOICED
                    -- PAID
                    -- FAILED
                    -- CANCELLED

invoice_id          UUID NULL REFERENCES invoices(id)

created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()


RULE:

A billing schedule row represents ONE billing event.

A schedule row is immutable after invoicing except for accounting correction
through credit/debit documents.


================================================================================
18. INVOICES
================================================================================

TABLE: invoices

id                  UUID PRIMARY KEY

invoice_number      VARCHAR(100) UNIQUE NOT NULL

order_id            UUID NOT NULL REFERENCES orders(id)
customer_id         UUID NOT NULL REFERENCES customers(id)

invoice_type        VARCHAR(30) NOT NULL
                    -- ONE_TIME
                    -- RECURRING
                    -- MIXED

subtotal            NUMERIC(19,4) NOT NULL
tax_total           NUMERIC(19,4) NOT NULL
total               NUMERIC(19,4) NOT NULL

amount_paid         NUMERIC(19,4) NOT NULL DEFAULT 0
amount_due          NUMERIC(19,4) NOT NULL

status              VARCHAR(30) NOT NULL
                    -- DRAFT
                    -- ISSUED
                    -- PARTIALLY_PAID
                    -- PAID
                    -- VOID
                    -- OVERDUE

issued_at           TIMESTAMPTZ NULL
due_date            DATE NULL
paid_at             TIMESTAMPTZ NULL

created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()


TABLE: invoice_lines

id                  UUID PRIMARY KEY

invoice_id          UUID NOT NULL REFERENCES invoices(id)

order_line_id       UUID NULL REFERENCES order_lines(id)

billing_schedule_id UUID NULL REFERENCES billing_schedules(id)

description         TEXT NOT NULL

quantity            NUMERIC(19,4) NOT NULL

unit_price          NUMERIC(19,4) NOT NULL

amount              NUMERIC(19,4) NOT NULL

tax_amount          NUMERIC(19,4) NOT NULL DEFAULT 0

total_amount        NUMERIC(19,4) NOT NULL

created_at          TIMESTAMPTZ NOT NULL DEFAULT now()


RELATION:

invoice
   |
   +----< invoice_lines
             |
             +---- order_line
             OR
             +---- billing_schedule


================================================================================
19. PAYMENTS
================================================================================

TABLE: payments

id                  UUID PRIMARY KEY

invoice_id          UUID NOT NULL REFERENCES invoices(id)

amount              NUMERIC(19,4) NOT NULL
currency             CHAR(3) NOT NULL

payment_method      VARCHAR(40) NOT NULL
                    -- CASH
                    -- CARD
                    -- BANK_TRANSFER
                    -- UPI
                    -- OTHER

transaction_reference VARCHAR(200) NULL

status              VARCHAR(30) NOT NULL
                    -- PENDING
                    -- SUCCESS
                    -- FAILED
                    -- REFUNDED

paid_at             TIMESTAMPTZ NULL

created_by          UUID NOT NULL REFERENCES users(id)
created_at          TIMESTAMPTZ NOT NULL DEFAULT now()


RULE:

amount_paid on invoice is derived from successful payments.

Payment recording requires:

    payment.record


================================================================================
20. CREDIT NOTES
================================================================================

TABLE: credit_notes

id                  UUID PRIMARY KEY

credit_note_number  VARCHAR(100) UNIQUE NOT NULL

invoice_id          UUID NOT NULL REFERENCES invoices(id)
customer_id         UUID NOT NULL REFERENCES customers(id)

subscription_id     UUID NULL REFERENCES subscriptions(id)

amount              NUMERIC(19,4) NOT NULL

reason              TEXT NOT NULL

status              VARCHAR(30) NOT NULL
                    -- DRAFT
                    -- ISSUED
                    -- APPLIED
                    -- VOID

created_by          UUID NOT NULL REFERENCES users(id)
approved_by         UUID NULL REFERENCES users(id)

created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()


RULE:

Finance owns creation/approval of credit notes.

Customer can SEE applicable credit notes but cannot create/approve them.


================================================================================
21. UPSELL / CROSS-SELL
================================================================================

TABLE: recommendation_rules

id                  UUID PRIMARY KEY

source_product_id   UUID NOT NULL REFERENCES products(id)

suggested_product_id UUID NOT NULL REFERENCES products(id)

rule_type            VARCHAR(30) NOT NULL
                     -- UPSELL
                     -- CROSS_SELL

score                NUMERIC(12,6) NOT NULL DEFAULT 0

min_margin_percent   NUMERIC(7,4) NOT NULL DEFAULT 0

is_promoted          BOOLEAN NOT NULL DEFAULT FALSE

priority             INTEGER NOT NULL DEFAULT 0

is_active            BOOLEAN NOT NULL DEFAULT TRUE

created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()


TABLE: recommendation_events

id                  UUID PRIMARY KEY

quotation_id        UUID NOT NULL REFERENCES quotations(id)

quotation_line_id   UUID NULL REFERENCES quotation_lines(id)

suggested_product_id UUID NOT NULL REFERENCES products(id)

action              VARCHAR(30) NOT NULL
                    -- SHOWN
                    -- ADDED
                    -- DISMISSED

margin_delta        NUMERIC(19,4) NULL

created_at          TIMESTAMPTZ NOT NULL DEFAULT now()


RELATION:

source product
     |
     +---- recommendation_rules ----> suggested product

quotation
     |
     +---- recommendation_events


RULE:

Recommendation engine MUST NOT suggest a product if its resulting margin is
below recommendation_rules.min_margin_percent.


================================================================================
22. DEAL HEALTH
================================================================================

TABLE: deal_alerts

id                  UUID PRIMARY KEY

quotation_id        UUID NOT NULL REFERENCES quotations(id)

alert_type          VARCHAR(40) NOT NULL
                    -- STALLED
                    -- DISCOUNT_ANOMALY
                    -- DELIVERY_SLIPPAGE
                    -- HIGH_RISK

severity            VARCHAR(20) NOT NULL
                    -- LOW
                    -- MEDIUM
                    -- HIGH
                    -- CRITICAL

message             TEXT NOT NULL

detected_value      NUMERIC(19,4) NULL
threshold_value     NUMERIC(19,4) NULL

status              VARCHAR(30) NOT NULL
                    -- OPEN
                    -- ACKNOWLEDGED
                    -- RESOLVED

created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
resolved_at         TIMESTAMPTZ NULL
resolved_by         UUID NULL REFERENCES users(id)


TABLE: sales_rep_discount_history

id                  UUID PRIMARY KEY

sales_rep_id        UUID NOT NULL REFERENCES users(id)
quotation_id        UUID NOT NULL REFERENCES quotations(id)

discount_percent    NUMERIC(7,4) NOT NULL
discount_amount     NUMERIC(19,4) NOT NULL
quotation_total     NUMERIC(19,4) NOT NULL

created_at          TIMESTAMPTZ NOT NULL DEFAULT now()


RULE:

Historical discount data is used to calculate rep-specific anomaly baselines.

A deal_alert does NOT grant access to the quotation.

The user must still pass normal quotation authorization.


================================================================================
23. GLOBAL AUDIT
================================================================================

TABLE: audit_logs

id                  UUID PRIMARY KEY

actor_user_id       UUID NULL REFERENCES users(id)

entity_type         VARCHAR(100) NOT NULL
entity_id           UUID NOT NULL

action              VARCHAR(100) NOT NULL

old_data            JSONB NULL
new_data            JSONB NULL

reason              TEXT NULL

ip_address          INET NULL

created_at          TIMESTAMPTZ NOT NULL DEFAULT now()


RULE:

audit_logs is APPEND ONLY.

NO UPDATE.

NO DELETE through application APIs.

Admin can READ.

Normal users can only read audit information explicitly within their
authorization scope.


================================================================================
24. USER ROLE PERMISSION MATRIX
================================================================================

ADMIN
-----

USERS:
    create/read/update/disable users
    assign/remove roles

ROLES:
    create/read/update roles
    assign permissions

CUSTOMERS:
    full CRUD

PRODUCTS:
    full CRUD

PRICE LISTS:
    full CRUD

DISCOUNT RULES:
    full CRUD

APPROVAL RULES:
    full CRUD

WAREHOUSES:
    full CRUD

INVENTORY:
    full access

SUBSCRIPTION PLANS:
    full CRUD

RECOMMENDATION RULES:
    full CRUD

QUOTATIONS:
    full access

ORDERS:
    full access

FULFILLMENT:
    full access

BACKORDERS:
    full access

SUBSCRIPTIONS:
    full access

BILLING:
    full access

PAYMENTS:
    full access

CREDIT NOTES:
    full access

REPORTS:
    full access

AUDIT:
    full read


================================================================================
SALES_REP
================================================================================

USERS:
    read own user record

CUSTOMERS:
    read customers relevant to sales activity

PRODUCTS:
    read

PRICE LISTS:
    read

DISCOUNT RULES:
    read
    NEVER modify

APPROVAL RULES:
    read applicable rules
    NEVER modify

WAREHOUSES:
    read availability
    NEVER modify inventory

QUOTATIONS:
    create
    read own
    update own editable quotations
    submit
    send
    cancel own eligible quotations
    negotiate own quotations

APPROVAL:
    CANNOT approve own quotations
    CANNOT approve quotations merely because they belong to the same team

ORDERS:
    read own orders
    create only through confirmed quotation

FULFILLMENT:
    read own order fulfillment
    CANNOT allocate/override

BACKORDERS:
    read own order backorders

SUBSCRIPTIONS:
    read own customer subscriptions
    cannot perform financial cancellation unless authorized

INVOICES:
    read invoices related to own orders
    cannot modify

PAYMENTS:
    read payment status
    cannot record/refund

CREDIT NOTES:
    read related notes
    cannot create/approve

REPORTS:
    own performance
    permitted team-level reports if configured

AUDIT:
    own actions / own quotations where allowed


================================================================================
SALES_MANAGER
================================================================================

USERS:
    read users in managed teams

CUSTOMERS:
    read

PRODUCTS:
    read

PRICE LISTS:
    read

DISCOUNT RULES:
    read
    create/update if assigned configuration permission

APPROVAL RULES:
    read
    create/update if assigned configuration permission

QUOTATIONS:
    read quotations belonging to managed teams
    create if needed
    update only if authorized and quotation state permits
    submit
    approve
    reject
    return
    send
    confirm where workflow permits

IMPORTANT:
    Manager cannot approve a quotation unless the approval step requires
    SALES_MANAGER and the manager is authorized for that quotation.

ORDERS:
    read managed-team orders

FULFILLMENT:
    read

SUBSCRIPTIONS:
    read

BILLING:
    read

PAYMENTS:
    read

CREDIT NOTES:
    read

REPORTS:
    managed-team reports

AUDIT:
    managed-team scope


================================================================================
FINANCE
================================================================================

USERS:
    read own user record

CUSTOMERS:
    read

PRODUCTS:
    read

PRICE LISTS:
    read

DISCOUNT RULES:
    read

APPROVAL RULES:
    read

QUOTATIONS:
    read quotations requiring finance approval
    approve finance approval steps
    reject finance approval steps
    return for revision

ORDERS:
    read

FULFILLMENT:
    read
    no allocation modification unless also assigned OPERATIONS

BACKORDERS:
    read

SUBSCRIPTIONS:
    read

BILLING SCHEDULES:
    read/update where billing permission exists

INVOICES:
    read/create/update/void according to permission

PAYMENTS:
    read/record/refund according to permission

CREDIT NOTES:
    create/approve according to permission

REPORTS:
    financial reports

AUDIT:
    financial/approval scope


================================================================================
OPERATIONS
================================================================================

USERS:
    read own user record

CUSTOMERS:
    read required fulfillment information

PRODUCTS:
    read

PRICE LISTS:
    no write access

DISCOUNT RULES:
    read if operationally necessary

APPROVAL:
    NO approval permission by default

QUOTATIONS:
    read only when required for fulfillment

ORDERS:
    read confirmed orders

WAREHOUSES:
    read/update

INVENTORY:
    read/update

FULFILLMENT:
    read
    allocate
    manual override
    complete

BACKORDERS:
    read/update/resolve

SUBSCRIPTIONS:
    read

BILLING:
    read fulfillment-relevant billing state

PAYMENTS:
    no access by default

CREDIT NOTES:
    no access by default

REPORTS:
    operational reports

AUDIT:
    operational scope


================================================================================
CUSTOMER_USER
================================================================================

USERS:
    read/update own portal profile

CUSTOMERS:
    read ONLY own customer

PRODUCTS:
    read customer-safe product information

PRICE LISTS:
    NO direct access to price-list configuration
    Only quotation-approved prices are exposed

DISCOUNT RULES:
    NO ACCESS

APPROVAL RULES:
    NO ACCESS

WAREHOUSES:
    NO ACCESS

INVENTORY:
    NO ACCESS

QUOTATIONS:
    read own customer quotations
    comment on own customer quotations
    request changes
    counter discount
    confirm quotation

ORDERS:
    read own customer orders

FULFILLMENT:
    read customer-safe shipment/fulfillment status

BACKORDERS:
    read customer-safe backorder status

SUBSCRIPTIONS:
    read own subscriptions
    request modification/cancellation where supported

BILLING:
    read own invoices
    read own billing schedules

PAYMENTS:
    read own payment status

CREDIT NOTES:
    read own credit notes

REPORTS:
    NO INTERNAL REPORT ACCESS

AUDIT:
    NO INTERNAL AUDIT ACCESS

CUSTOMER MUST NEVER RECEIVE:
    cost_price
    margin_amount
    margin_percent
    risk_score
    allowed_discount
    excess_discount
    approval chain internals
    internal comments
    internal audit records
    sales-rep historical performance
    warehouse stock quantities
    internal anomaly thresholds


================================================================================
25. DATA-SCOPE MATRIX
================================================================================

TABLE                    SALES REP       MANAGER       FINANCE       OPS
----------------------------------------------------------------------------
users                    OWN             TEAM          OWN           OWN
customers                SALES SCOPE     TEAM          READ          READ
products                 ALL READ        ALL READ      ALL READ      ALL READ
price_lists              ALL READ        ALL READ      ALL READ      ALL READ
discount_rules           READ            READ/WRITE*   READ          READ
approval_rules           READ            READ/WRITE*   READ          NONE
quotations               OWN             TEAM          APPROVAL      FULFILLMENT
quotation_lines          OWN             TEAM          APPROVAL      FULFILLMENT
orders                   OWN             TEAM          READ          FULFILLMENT
order_lines              OWN             TEAM          READ          FULFILLMENT
warehouses               READ            READ          READ          MANAGE
inventory                READ            READ          READ          MANAGE
fulfillment              READ            READ          READ          MANAGE
backorders               READ            READ          READ          MANAGE
subscriptions            OWN/RELATED     TEAM          ALL SCOPE     READ
billing_schedules        RELATED         TEAM          MANAGE        READ
invoices                 RELATED         TEAM          MANAGE        READ
payments                 READ            READ          MANAGE        NONE
credit_notes             READ            READ          MANAGE        NONE
deal_alerts              OWN             TEAM          FINANCE       OPS
audit_logs               OWN/SCOPE       TEAM          FINANCE       OPS

* only if the corresponding configuration permission is explicitly assigned


TABLE                    CUSTOMER
----------------------------------------------------------------------------
users                    OWN USER
customers                OWN CUSTOMER
products                 CUSTOMER-SAFE READ
price_lists              NO DIRECT ACCESS
discount_rules           NONE
approval_rules           NONE
quotations               OWN CUSTOMER
quotation_lines          OWN CUSTOMER
orders                   OWN CUSTOMER
order_lines              OWN CUSTOMER
warehouses               NONE
inventory                NONE
fulfillment              OWN CUSTOMER / SAFE STATUS
backorders               OWN CUSTOMER / SAFE STATUS
subscriptions            OWN CUSTOMER
billing_schedules        OWN CUSTOMER
invoices                 OWN CUSTOMER
payments                 OWN CUSTOMER
credit_notes             OWN CUSTOMER
deal_alerts              NONE
audit_logs               NONE


================================================================================
26. QUOTATION AUTHORIZATION RULES
================================================================================

CREATE:

    user has quotation.create
    AND user is INTERNAL
    AND user has SALES_REP or higher sales role


READ BY SALES REP:

    quotation.sales_rep_id = current_user.id


READ BY SALES MANAGER:

    quotation.sales_team_id IN teams_managed_by(current_user.id)


READ BY FINANCE:

    quotation.id IN quotations_with_pending_finance_approval


READ BY OPERATIONS:

    quotation.id IN quotations_with_confirmed_orders


READ BY CUSTOMER:

    quotation.customer_id IN customers_of(current_user.id)


UPDATE:

    quotation.status IN (
        DRAFT,
        RETURNED_FOR_REVISION,
        UNDER_NEGOTIATION
    )

    AND
    user has quotation.update

    AND
    user owns/manages the quotation according to scope


SUBMIT:

    quotation.status IN (DRAFT, RETURNED_FOR_REVISION)

    AND
    user has quotation.submit


CONFIRM:

    INTERNAL:
        quotation has completed required approvals

    CUSTOMER:
        current user belongs to quotation.customer_id
        AND quotation.status IN (SENT, UNDER_NEGOTIATION)


IMPORTANT:

Any commercial modification after APPROVED:

    1. increments quotation.version
    2. recalculates pricing
    3. recalculates margin
    4. recalculates risk
    5. invalidates previous approval
    6. creates new quotation approval records
    7. changes status to PENDING_APPROVAL

This is mandatory for customer counter-discount negotiations.


================================================================================
27. ORDER AUTHORIZATION
================================================================================

Order creation:

    ONLY from a CONFIRMED quotation.

    quotation.id -> orders.quotation_id

Sales rep:

    can read orders where
        order.sales_rep_id = current_user.id

Manager:

    can read orders where
        order.sales_team_id IN managed teams

Finance:

    can read orders for financial processing

Operations:

    can read confirmed orders for fulfillment

Customer:

    can read orders where
        order.customer_id belongs to current_user


================================================================================
28. FULFILLMENT AUTHORIZATION
================================================================================

Operations is the default owner of fulfillment mutations.

ALLOCATE:

    permission = fulfillment.allocate
    AND order.status IN (CONFIRMED, FULFILLING, PARTIALLY_FULFILLED)

OVERRIDE:

    permission = fulfillment.override

    AND audit reason is mandatory

COMPLETE:

    permission = fulfillment.complete

    AND quantity_fulfilled <= quantity_allocated


================================================================================
29. BILLING AUTHORIZATION
================================================================================

Finance owns billing mutations.

CREATE INVOICE:

    permission = invoice.create

RECORD PAYMENT:

    permission = payment.record

REFUND:

    permission = payment.refund

CREATE CREDIT NOTE:

    permission = credit_note.create

APPROVE CREDIT NOTE:

    permission = credit_note.approve


Customer:

    READ ONLY their own invoices/payments/credit notes.


================================================================================
30. RLS / DATABASE SECURITY
================================================================================

The application must set:

    app.user_id
    app.user_type
    app.role_ids

at the start of every database transaction.

Sensitive tables SHOULD have PostgreSQL Row-Level Security.

MINIMUM RLS TABLES:

    customers
    customer_users
    quotations
    quotation_lines
    quotation_approvals
    quotation_change_requests
    orders
    order_lines
    subscriptions
    invoices
    invoice_lines
    payments
    credit_notes


EXAMPLE CUSTOMER QUOTATION POLICY:

A customer can SELECT quotation ONLY when:

    quotation.customer_id IN (
        SELECT customer_id
        FROM customer_users
        WHERE user_id = current_app_user()
    )


EXAMPLE SALES REP POLICY:

A sales representative can SELECT quotation ONLY when:

    quotation.sales_rep_id = current_app_user()


EXAMPLE MANAGER POLICY:

A sales manager can SELECT quotation ONLY when:

    quotation.sales_team_id IN (
        SELECT team_id
        FROM sales_team_members
        WHERE user_id = current_app_user()
    )


IMPORTANT:

RLS is the SECONDARY enforcement layer.

The application authorization service remains responsible for business
permission checks.


================================================================================
31. COMPLETE ENTITY RELATIONSHIP MAP
================================================================================

users
 |
 +----< user_roles >---- roles
 |                         |
 |                         +----< role_permissions >---- permissions
 |
 +----< sales_team_members >---- sales_teams
 |                                  |
 |                                  +---- manager_user_id -> users
 |
 +----< customer_users >---- customers
                               |
                               +---- customer_tier_id -> customer_tiers
                               |
                               +----< quotations
                               |
                               +----< orders
                               |
                               +----< subscriptions
                               |
                               +----< invoices
                               |
                               +----< payments
                               |
                               +----< credit_notes


product_categories
 |
 +----< products
         |
         +----< product_variants
         |       |
         |       +----< product_variant_attributes
         |
         +----< product_subscription_plans >---- subscription_plans
         |
         +----< price_list_items >---- price_lists
         |
         +----< recommendation_rules >---- products


customer_tiers
 |
 +----< discount_tiers
 |
 +----< category_discount_limits >---- product_categories
 |
 +----< price_lists


approval_rules
 |
 +---- required_role_id -> roles
 |
 +----< quotation_approvals


quotations
 |
 +---- customer_id -> customers
 |
 +---- sales_rep_id -> users
 |
 +---- sales_team_id -> sales_teams
 |
 +---- price_list_id -> price_lists
 |
 +----< quotation_lines
 |        |
 |        +---- product_id -> products
 |        +---- variant_id -> product_variants
 |        +---- subscription_plan_id -> subscription_plans
 |
 +----< quotation_approvals
 |
 +----< quotation_events
 |
 +----< quotation_change_requests
 |
 +----< quotation_line_comments
 |
 +----< quotation_public_events
 |
 +----< recommendation_events
 |
 +----< deal_alerts
 |
 +----< orders


orders
 |
 +---- quotation_id -> quotations
 |
 +---- customer_id -> customers
 |
 +---- sales_rep_id -> users
 |
 +---- sales_team_id -> sales_teams
 |
 +----< order_lines
 |        |
 |        +---- quotation_line_id -> quotation_lines
 |        +---- product_id -> products
 |        +---- subscription_plan_id -> subscription_plans
 |
 +----< fulfillment_orders
 |        |
 |        +----< fulfillment_lines
 |                 |
 |                 +---- order_line_id -> order_lines
 |                 +---- warehouse_id -> warehouses
 |
 +----< subscriptions
 |
 +----< invoices


warehouses
 |
 +----< warehouse_inventory
 |        |
 |        +---- product_id -> products
 |        +---- variant_id -> product_variants
 |
 +----< fulfillment_lines


subscriptions
 |
 +---- customer_id -> customers
 +---- order_id -> orders
 |
 +----< subscription_lines
 |        |
 |        +---- order_line_id -> order_lines
 |        +---- product_id -> products
 |        +---- plan_id -> subscription_plans
 |
 +----< billing_schedules


billing_schedules
 |
 +---- invoice_id -> invoices


invoices
 |
 +---- customer_id -> customers
 +---- order_id -> orders
 |
 +----< invoice_lines
 |
 +----< payments
 |
 +----< credit_notes


================================================================================
32. CARDINALITY SUMMARY
================================================================================

users              M:N roles
users              M:N sales_teams
users              M:N customers

sales_teams         1:N quotations
sales_teams         1:N orders

customer_tiers      1:N customers
customers           1:N quotations
customers           1:N orders
customers           1:N subscriptions
customers           1:N invoices

product_categories  1:N products
products            1:N product_variants
products            M:N subscription_plans
products            M:N price_lists
products            M:N recommendation_rules

quotations          1:N quotation_lines
quotations          1:N quotation_approvals
quotations          1:N quotation_events
quotations          1:N quotation_change_requests
quotations          1:N quotation_line_comments
quotations          1:N quotation_public_events
quotations          1:N recommendation_events
quotations          1:N deal_alerts
quotations          1:1 order

orders              1:N order_lines
orders              1:N fulfillment_orders
orders              1:N subscriptions
orders              1:N invoices

order_lines         1:N fulfillment_lines
order_lines         0:N backorders
order_lines         0:1 subscription_line
order_lines         1:N invoice_lines

warehouses          1:N warehouse_inventory
warehouses          1:N fulfillment_lines

subscriptions       1:N subscription_lines
subscriptions       1:N billing_schedules

subscription_lines  1:N billing_schedules

invoices            1:N invoice_lines
invoices            1:N payments
invoices            1:N credit_notes

users               1:N audit_logs
users               1:N quotation_events
users               1:N payments


================================================================================
33. STATE MACHINES
================================================================================

QUOTATION:

DRAFT
  |
  +--> PENDING_APPROVAL
  |       |
  |       +--> APPROVED
  |       |      |
  |       |      +--> SENT
  |       |
  |       +--> RETURNED_FOR_REVISION
  |              |
  |              +--> PENDING_APPROVAL
  |
  +--> SENT
          |
          +--> UNDER_NEGOTIATION
          |       |
          |       +--> PENDING_APPROVAL
          |
          +--> CONFIRMED

CONFIRMED
  |
  +--> ORDER


ORDER:

CONFIRMED
    |
    +--> FULFILLING
            |
            +--> PARTIALLY_FULFILLED
            |       |
            |       +--> FULFILLING
            |
            +--> FULFILLED


SUBSCRIPTION:

ACTIVE
  |
  +--> PAUSED
  |       |
  |       +--> ACTIVE
  |
  +--> CANCELLED

INVOICE:

DRAFT
  |
  +--> ISSUED
          |
          +--> PARTIALLY_PAID
          |       |
          |       +--> PAID
          |
          +--> PAID
          |
          +--> OVERDUE


================================================================================
34. CRITICAL BUSINESS INVARIANTS
================================================================================

INVARIANT 1:

quotation.customer_id MUST equal order.customer_id.

INVARIANT 2:

quotation.sales_rep_id MUST equal order.sales_rep_id.

INVARIANT 3:

quotation.sales_team_id MUST equal order.sales_team_id.

INVARIANT 4:

order MUST reference exactly one confirmed quotation.

INVARIANT 5:

quotation_line.quantity > 0.

INVARIANT 6:

order_line.quantity > 0.

INVARIANT 7:

fulfillment allocated quantity MUST NOT exceed order quantity.

INVARIANT 8:

fulfilled quantity MUST NOT exceed allocated quantity.

INVARIANT 9:

reserved inventory MUST NOT exceed on-hand inventory.

INVARIANT 10:

customer users MUST NEVER access another customer's data.

INVARIANT 11:

sales representatives MUST NEVER approve their own quotation.

INVARIANT 12:

approval sequence N cannot execute before sequence N-1 completes.

INVARIANT 13:

approved commercial terms become invalid when material pricing/discount
changes occur.

INVARIANT 14:

customer counter-discount above applicable thresholds automatically causes
re-approval.

INVARIANT 15:

cost price is never exposed through customer APIs.

INVARIANT 16:

margin is never exposed through customer APIs.

INVARIANT 17:

risk score is never exposed through customer APIs.

INVARIANT 18:

internal approval comments are never exposed through customer APIs.

INVARIANT 19:

audit_logs are append-only.

INVARIANT 20:

historical quotation/order prices are immutable snapshots.

INVARIANT 21:

invoice amount_due =
    invoice.total - SUM(successful payment amounts) - applied credits.

INVARIANT 22:

subscription billing schedules belong to exactly one subscription line.

INVARIANT 23:

a recurring order line MUST reference a subscription plan.

INVARIANT 24:

a one-time order line MUST NOT create a subscription.

INVARIANT 25:

deal alerts do not bypass authorization.

INVARIANT 26:

recommendation visibility does not grant product/order permissions.


================================================================================
35. FINAL SECURITY BOUNDARY
================================================================================

                         INTERNET
                            |
                 +----------+----------+
                 |                     |
                 v                     v
          INTERNAL API            CUSTOMER API
                 |                     |
                 v                     v
          INTERNAL AUTH          CUSTOMER AUTH
                 |                     |
                 v                     v
             RBAC + SCOPE        CUSTOMER SCOPE
                 |                     |
                 +----------+----------+
                            |
                            v
                    AUTHORIZATION
                       SERVICE
                            |
                            v
                     BUSINESS LOGIC
                            |
                            v
                    POSTGRESQL RLS
                            |
                            v
                         DATA


CUSTOMER API CAN NEVER DIRECTLY RETURN:

    products.cost_price
    quotation_lines.cost_price
    quotation.margin_amount
    quotation.margin_percent
    quotation.risk_score
    quotation_lines.allowed_discount
    quotation_lines.excess_discount
    quotation_approvals.internal_reason
    internal quotation_events
    audit_logs
    warehouse_inventory
    sales_rep_discount_history
    internal deal_alert thresholds


================================================================================
36. THE MOST IMPORTANT RELATIONSHIPS
================================================================================

USER
 |
 +-- USER_ROLE --> ROLE --> ROLE_PERMISSION --> PERMISSION
 |
 +-- SALES_TEAM_MEMBER --> SALES_TEAM
 |
 +-- CUSTOMER_USER --> CUSTOMER


CUSTOMER
 |
 +-- CUSTOMER_TIER
 |
 +-- QUOTATION
      |
      +-- QUOTATION_LINE
      |      |
      |      +-- PRODUCT
      |      +-- PRODUCT_VARIANT
      |      +-- SUBSCRIPTION_PLAN
      |
      +-- QUOTATION_APPROVAL
      |      |
      |      +-- REQUIRED_ROLE
      |      +-- ASSIGNED_USER
      |
      +-- NEGOTIATION
      |
      +-- ORDER
             |
             +-- ORDER_LINE
             |
             +-- FULFILLMENT
             |      |
             |      +-- WAREHOUSE
             |      +-- INVENTORY
             |      +-- BACKORDER
             |
             +-- SUBSCRIPTION
             |      |
             |      +-- SUBSCRIPTION_LINE
             |      +-- BILLING_SCHEDULE
             |
             +-- INVOICE
                    |
                    +-- PAYMENT
                    +-- CREDIT_NOTE


================================================================================
37. IMPLEMENTATION PRIORITY
================================================================================

MUST HAVE:

users
roles
permissions
user_roles
role_permissions

customers
customer_tiers
customer_users

sales_teams
sales_team_members

product_categories
products
product_variants

price_lists
price_list_items

discount_tiers
category_discount_limits
approval_rules

quotations
quotation_lines
quotation_approvals
quotation_events

quotation_change_requests
quotation_line_comments
quotation_public_events

orders
order_lines

warehouses
warehouse_inventory
fulfillment_orders
fulfillment_lines
backorders

subscription_plans
product_subscription_plans
subscriptions
subscription_lines
billing_schedules

invoices
invoice_lines
payments
credit_notes

recommendation_rules
recommendation_events

deal_alerts
sales_rep_discount_history

audit_logs


================================================================================
END OF CANONICAL DEALFLOW360 SCHEMA
================================================================================