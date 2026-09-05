
# QuickCourt — Product Requirements Document

## 1. Product Overview

QuickCourt is a sports facility discovery and court-booking platform that connects players with local sports facilities.

The platform has three user roles:

1. **Customer/User** — discovers facilities, checks court availability, and books courts.
2. **Facility Owner** — registers facilities, manages courts, prices, availability, and bookings.
3. **Admin** — manages users, approves facilities, monitors bookings, and views platform analytics.

The primary product goal is to make sports-court booking as simple as:

**Discover → Select → Book → Pay → Play**

---

# 2. Hackathon MVP Goal

The MVP must demonstrate a complete working booking ecosystem rather than attempting to implement every possible feature.

The most important end-to-end flow is:

**User → Venue → Court → Date → Time Slot → Booking → Payment → Confirmation**

The secondary flows are:

**Facility Owner → Facility → Courts → Availability → Bookings → Revenue**

**Admin → Users → Facilities → Approvals → Bookings → Analytics**

---

# 3. Target Users

## 3.1 Customer

A person looking for a sports facility and available court.

Typical goals:

* Find a nearby facility.
* Search by sport.
* Compare facilities.
* Check availability.
* Book a court.
* Pay.
* View booking confirmation.
* Cancel eligible bookings.

---

## 3.2 Facility Owner

A person or organization operating one or more sports facilities.

Typical goals:

* Register a facility.
* Add courts.
* Configure pricing.
* Configure operating hours.
* Block courts for maintenance.
* Monitor bookings.
* Monitor revenue.
* Manage facility information.

---

## 3.3 Admin

Platform administrator.

Typical goals:

* Approve facilities.
* Reject inappropriate facilities.
* Manage users.
* Ban/unban users.
* Monitor bookings.
* View platform statistics.
* Monitor platform activity.

---

# 4. Core Features

## 4.1 Authentication

Users can:

* Register.
* Login.
* Logout.
* Verify account through OTP.
* Access functionality based on their role.

Registration fields:

* Name.
* Email.
* Password.
* Role.
* Optional profile image.

Supported roles:

* USER.
* FACILITY_OWNER.
* ADMIN.

Passwords must be hashed.

Protected API routes require authentication.

Role-based authorization must be enforced on the backend.

---

# 5. Customer Experience

## 5.1 Home Page

The home page should provide:

* Quick introduction to QuickCourt.
* Popular sports.
* Featured facilities.
* Search.
* Quick access to venues.
* Clear "Book Now" actions.

The primary objective is to get the user from the homepage to a bookable facility quickly.

---

# 5.2 Venue Discovery

Users can browse approved facilities.

Each facility card should display:

* Facility image.
* Facility name.
* Location.
* Supported sports.
* Starting price.
* Rating if reviews are implemented.

Users can search by:

* Facility name.
* City/location.
* Sport.

Users can filter by:

* Sport.
* Price.
* Rating.
* Location.

Only facilities with `APPROVED` status are publicly visible.

---

# 5.3 Facility Details

The facility details page displays:

* Facility name.
* Images.
* Description.
* Address.
* Location.
* Sports.
* Amenities.
* Available courts.
* Price.
* Rating/reviews if implemented.

Primary CTA:

**Book Now**

---

# 6. Booking System

The booking engine is the most important component of QuickCourt.

The user must be able to:

1. Select facility.
2. Select sport.
3. Select court.
4. Select date.
5. View available time slots.
6. Select a time slot.
7. See calculated price.
8. Confirm booking.
9. Complete simulated payment.
10. Receive booking confirmation.

Example:

**Badminton → Court 1 → Aug 27 → 6:00 PM–7:00 PM → ₹500**

---

# 7. Time Slot Availability

Court availability is calculated from:

* Court operating hours.
* Existing bookings.
* Maintenance blocks.
* Court status.

Example:

**Court 1**

06:00 PM — Available
07:00 PM — Booked
08:00 PM — Available
09:00 PM — Maintenance

Available slots can be booked.

Booked slots cannot be booked again.

Blocked slots cannot be booked.

For the hackathon MVP, use fixed one-hour booking slots.

---

# 8. Double Booking Prevention

Double booking must be prevented at the backend/database level.

The frontend availability display is not sufficient.

The booking system should use a database constraint/transaction so that two users cannot successfully reserve the same:

**Court + Date + Start Time**

Example:

User A attempts to book:

**Court 1 — Aug 27 — 7:00 PM**

User B simultaneously attempts:

**Court 1 — Aug 27 — 7:00 PM**

Expected result:

User A → Booking confirmed.

User B → Slot unavailable.

The database must remain consistent.

---

# 9. Smart Slot Recommendation

To make QuickCourt more competitive in the hackathon, implement a lightweight "Smart Pick" feature.

When a user selects a sport and date, the application can recommend slots based on:

* Availability.
* Price.
* Popularity.

Example:

**Smart Picks**

6:00 PM — Best availability
7:00 PM — Most popular
3:00 PM — Cheapest

This does not require machine learning for the MVP.

A rule-based recommendation engine is sufficient.

---

# 10. Payment

For the hackathon MVP, payment can be simulated.

The payment screen displays:

* Facility.
* Court.
* Sport.
* Date.
* Time.
* Price.
* Total amount.

The user clicks:

**Proceed to Payment**

The system simulates a successful payment.

After successful payment:

* Payment status becomes `PAID`.
* Booking status becomes `CONFIRMED`.
* Booking reference is generated.
* User receives confirmation.

The final booking amount must always be calculated by the backend.

---

# 11. My Bookings

Users can view their bookings.

Each booking displays:

* Booking reference.
* Facility.
* Court.
* Sport.
* Date.
* Start time.
* End time.
* Amount.
* Payment status.
* Booking status.

Booking statuses:

* CONFIRMED.
* CANCELLED.
* COMPLETED.

Users can cancel eligible bookings.

After cancellation:

* Booking status becomes `CANCELLED`.
* Cancellation timestamp is stored.
* Slot becomes available again according to the application's booking rules.

---

# 12. User Profile

Users can view and edit:

* Name.
* Email.
* Profile image.

The profile page also provides access to:

* My Bookings.
* Logout.

---

# 13. Facility Owner Dashboard

The owner dashboard provides an overview of facility performance.

KPIs:

* Total bookings.
* Active courts.
* Total revenue.
* Upcoming bookings.

Example:

**Total Bookings:** 245
**Active Courts:** 12
**Revenue:** ₹125,000

---

# 14. Facility Management

Facility owners can:

* Create facilities.
* Edit facilities.
* View facilities.
* Update facility information.
* Submit facilities for approval.

Facility fields:

* Name.
* Description.
* Address.
* City.
* State.
* Postal code.
* Location.
* Phone.
* Sports.
* Amenities.
* Images.

Facility statuses:

* PENDING.
* APPROVED.
* REJECTED.

A newly created facility starts as:

**PENDING**

It becomes publicly bookable only after admin approval.

---

# 15. Court Management

Facility owners can:

* Add courts.
* Edit courts.
* Deactivate courts.
* Set court pricing.
* Set operating hours.
* Set court status.

Court fields:

* Facility.
* Court name.
* Sport.
* Price per hour.
* Opening time.
* Closing time.
* Status.

Court statuses:

* ACTIVE.
* INACTIVE.
* MAINTENANCE.

---

# 16. Court Blocking

Facility owners can block court availability for:

* Maintenance.
* Private events.
* Temporary closure.

Block fields:

* Court.
* Date.
* Start time.
* End time.
* Reason.
* Created by.

Blocked slots cannot be booked by customers.

---

# 17. Owner Booking Management

Facility owners can view bookings associated with their facilities.

Each booking shows:

* Customer.
* Facility.
* Court.
* Sport.
* Date.
* Time.
* Amount.
* Status.

Owners can view:

* Upcoming bookings.
* Past bookings.
* Cancelled bookings.

Owners cannot access or modify facilities belonging to another owner.

---

# 18. Owner Analytics

The owner dashboard should provide:

### Booking Trends

Show bookings over:

* Day.
* Week.
* Month.

### Revenue

Show revenue over:

* Day.
* Week.
* Month.

### Popular Hours

Show the most frequently booked time periods.

### Popular Sports

Show which sports receive the most bookings.

The analytics do not need to be extremely sophisticated for the hackathon. The goal is to provide useful visual evidence that the platform generates business insights.

---

# 19. Admin Dashboard

The admin dashboard provides platform-wide statistics.

KPIs:

* Total users.
* Total facility owners.
* Total facilities.
* Total bookings.
* Total active courts.
* Total booking value.

Example:

**Users:** 1,248
**Facilities:** 86
**Bookings:** 4,532
**Active Courts:** 214

---

# 20. Facility Approval

Admin can view pending facilities.

Facility approval information includes:

* Facility name.
* Owner.
* Address.
* Sports.
* Description.
* Images.
* Submission date.
* Status.

Admin actions:

* Approve.
* Reject.

If rejected, an optional rejection reason can be stored.

Only approved facilities become publicly visible.

---

# 21. User Management

Admin can:

* Search users.
* Filter users by role.
* Filter users by status.
* View user details.
* View booking history.
* Ban users.
* Unban users.

User statuses:

* ACTIVE.
* BANNED.
* SUSPENDED.

Banned users cannot create new bookings.

---

# 22. Database Model

The MVP database should contain:

* users
* otp_verifications
* facilities
* facility_sports
* courts
* court_blocks
* bookings
* payments
* reviews

Roles should not have separate tables.

Use:

**users.role**

with:

* USER
* FACILITY_OWNER
* ADMIN

A separate slots table is not required for the MVP.

Slots should be derived from:

**Court operating hours + bookings + blocks**

This avoids unnecessary synchronization problems.

---

# 23. Main Relationships

The core relationship is:

**User → Facility → Court → Booking**

More specifically:

* A user can create many bookings.
* A facility owner can own many facilities.
* A facility has many courts.
* A facility supports many sports.
* A court belongs to one facility.
* A court can have many blocks.
* A court can have many bookings.
* A booking belongs to one customer.
* A booking belongs to one facility.
* A booking belongs to one court.
* A booking can have one payment.
* A completed booking can have one review.

---

# 24. Business Rules

### BR-01

Only verified users can access protected functionality.

### BR-02

Only approved facilities are publicly visible.

### BR-03

Only facility owners can manage their own facilities.

### BR-04

Only facility owners can manage courts belonging to their facilities.

### BR-05

Blocked courts cannot be booked during blocked periods.

### BR-06

A court/time slot cannot be booked twice.

### BR-07

The backend calculates the final booking price.

### BR-08

Users can only access their own bookings.

### BR-09

Facility owners can only view bookings associated with their facilities.

### BR-10

Admins can access platform-wide information.

### BR-11

Banned users cannot create new bookings.

### BR-12

A facility must be approved before customers can book it.

---

# 25. API Structure

Authentication:

POST `/api/auth/register`

POST `/api/auth/login`

POST `/api/auth/verify-otp`

POST `/api/auth/logout`

Users:

GET `/api/users/me`

PATCH `/api/users/me`

Facilities:

GET `/api/venues`

GET `/api/venues/:id`

POST `/api/facilities`

GET `/api/facilities/my`

PATCH `/api/facilities/:id`

Courts:

GET `/api/facilities/:facilityId/courts`

POST `/api/facilities/:facilityId/courts`

PATCH `/api/courts/:courtId`

DELETE `/api/courts/:courtId`

Availability:

GET `/api/courts/:courtId/availability`

POST `/api/courts/:courtId/blocks`

DELETE `/api/court-blocks/:blockId`

Bookings:

POST `/api/bookings`

GET `/api/bookings`

GET `/api/bookings/:id`

PATCH `/api/bookings/:id/cancel`

Payments:

POST `/api/payments`

GET `/api/payments/:id`

Admin:

GET `/api/admin/dashboard`

GET `/api/admin/facilities/pending`

PATCH `/api/admin/facilities/:id/approve`

PATCH `/api/admin/facilities/:id/reject`

GET `/api/admin/users`

PATCH `/api/admin/users/:id/ban`

PATCH `/api/admin/users/:id/unban`

---

# 26. Frontend Navigation

## Customer

Home

Venues

Venue Details

Booking

Payment

Booking Confirmation

My Bookings

Profile

Logout

---

## Facility Owner

Dashboard

Facilities

Courts

Availability

Bookings

Analytics

Profile

Logout

---

## Admin

Dashboard

Facility Approvals

Users

Bookings

Analytics

Logout

---

# 27. UI Requirements

The application must be:

* Responsive.
* Mobile-friendly.
* Desktop-friendly.
* Fast.
* Visually consistent.
* Easy to navigate.

The primary customer flow should be extremely simple:

**Discover → Select → Book → Pay → Confirm**

Important CTAs:

* Search.
* Book Now.
* Select Court.
* Select Time.
* Proceed to Payment.
* Confirm Booking.
* Cancel Booking.

---

# 28. Loading and Error States

Every API-driven page must support:

* Loading state.
* Empty state.
* Error state.
* Success feedback.

Example empty state:

**No bookings yet.**

Example error:

**Unable to load available slots. Please try again.**

Raw backend/database errors must never be shown to customers.

---

# 29. Security Requirements

The backend must implement:

* Password hashing.
* JWT/session authentication.
* Role-based authorization.
* Request validation.
* OTP expiration.
* OTP attempt limits.
* Authentication rate limiting.
* Ownership checks.
* Server-side price calculation.
* Database-level booking protection.

Never store plain-text passwords.

Never trust price values sent by the frontend.

---

# 30. Recommended Technology Stack

Frontend:

* React.
* TypeScript.
* Tailwind CSS.
* Recharts.

Backend:

* Express.
* TypeScript.
* Zod.
* Drizzle ORM.

Database:

* PostgreSQL.

Authentication:

* JWT.
* bcrypt/argon2.

Payment:

* Simulated payment for MVP.

Deployment:

* Frontend: Vercel.
* Backend: Render/Railway.
* Database: PostgreSQL hosting.

---

# 31. 24-Hour Hackathon Scope

## Must Build

Authentication.

Role-based authorization.

Venue discovery.

Search and filters.

Facility details.

Court management.

Court availability.

Booking system.

Double-booking prevention.

Simulated payment.

Booking confirmation.

My Bookings.

Owner dashboard.

Facility management.

Admin facility approval.

Admin user management.

Basic analytics.

Responsive UI.

---

# 32. Features to Cut if Time Runs Out

Do not sacrifice the booking flow to implement secondary features.

Cut in this order:

1. Advanced reviews.
2. Real payment gateway.
3. Email/SMS notifications.
4. Maps.
5. Advanced recommendation engine.
6. Complex analytics.
7. Favorites.
8. Coupons.
9. Recurring bookings.

The booking flow must remain complete.

---

# 33. Demo Flow

The final hackathon demonstration should use three roles.

## Step 1 — Customer

Search:

**Badminton**

Select facility.

Select court.

Select date.

Select available time.

Show:

**Smart Pick — 6:00 PM**

Book the slot.

Complete simulated payment.

Show:

**Booking Confirmed**

---

## Step 2 — Facility Owner

Switch to owner account.

Show:

**New Booking**

Show:

* Court.
* Customer.
* Time.
* Revenue.

Show dashboard analytics.

---

## Step 3 — Admin

Switch to admin.

Show:

* Platform users.
* Facilities.
* Bookings.
* Revenue.

Open pending facility.

Approve facility.

Return to customer view and show that the facility is now publicly available.

---

# 34. Success Metrics

The MVP should measure:

### Customer

* Registered users.
* Active users.
* Number of bookings.
* Booking conversion rate.
* Repeat bookings.

### Facilities

* Registered facilities.
* Approved facilities.
* Active courts.
* Court utilization.

### Booking

* Total bookings.
* Confirmed bookings.
* Cancelled bookings.
* Total booking value.
* Average booking value.
* Peak booking hours.

### Platform

* Total users.
* Total facility owners.
* Total facilities.
* Total courts.
* Total bookings.
* Total revenue.

---

# 35. Definition of Done

A feature is complete when:

* Backend API exists.
* Database operation exists.
* Validation exists.
* Authorization exists.
* Frontend is connected.
* Loading state exists.
* Error state exists.
* Empty state exists where necessary.
* Responsive UI exists.
* Happy path works.
* Unauthorized access is rejected.
* Important edge cases are handled.

---

# 36. Final MVP Architecture

```text
                         QUICKCOURT
                             |
             +---------------+---------------+
             |               |               |
           USER         FACILITY OWNER      ADMIN
             |               |               |
             v               v               v
        Discover         Manage Facility   Manage Users
             |               |               |
             v               v               v
        Select Court     Manage Courts    Approvals
             |               |               |
             v               v               v
        Select Slot      Manage Slots     Analytics
             |               |               |
             v               v               v
          Booking          Bookings        Platform
             |
             v
          Payment
             |
             v
        Confirmation
                             |
                             v
                    Express + TypeScript
                             |
                       Business Logic
                             |
                         Drizzle ORM
                             |
                        PostgreSQL
```

# 37. Core Product Principle

QuickCourt should not be treated as a generic sports website.

The product is fundamentally a **real-time sports-court booking engine with three connected experiences**:

**Customer:** Find → Book → Pay → Play

**Facility Owner:** Manage → Fill Courts → Earn

**Admin:** Approve → Monitor → Control

The highest priority is making the booking engine reliable, fast, and visually polished. Everything else supports that core flow.
