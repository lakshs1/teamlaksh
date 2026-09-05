# Hackathon Backend — Module Scaffolding Guide

> **Stack:** Bun + Express + TypeScript + Drizzle ORM + Zod + Swagger  
> **Architecture:** Module-based (routes → controller → service → schema)  
> **Auth:** JWT (access + refresh tokens) with RBAC

---

## 🏗️ Architecture Overview

```
src/
├── config/          ← App-wide configuration (env, db, swagger)
├── db/schema/       ← Drizzle table definitions + Zod schemas
├── lib/             ← Shared utilities (jwt, password, errors)
├── middleware/       ← Express middleware (auth, validate, error)
├── modules/         ← Feature modules (each has routes/controller/service/schemas)
│   └── auth/        ← Reference implementation
├── types/           ← TypeScript type augmentations
├── app.ts           ← Express app assembly
└── index.ts         ← Server entry point
```

### Module Pattern

Every feature follows this 4-file pattern inside `src/modules/<name>/`:

| File | Responsibility |
|------|---------------|
| `<name>.schemas.ts` | Zod request/response schemas + OpenAPI registry |
| `<name>.service.ts` | Business logic (DB queries, transformations) |
| `<name>.controller.ts` | Thin HTTP handler (calls service, sends response) |
| `<name>.routes.ts` | Express Router with middleware composition |

---

## 📋 How to Add a New Module

### Step 1: Define the Database Schema

Create `src/db/schema/<name>.ts`:

```typescript
import { pgTable, uuid, varchar, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users.js";

export const items = pgTable("items", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: varchar("description", { length: 1000 }),
  ownerId: uuid("owner_id").notNull().references(() => users.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertItemSchema = createInsertSchema(items, {
  name: (schema) => schema.min(2, "Name must be at least 2 characters"),
});

export const selectItemSchema = createSelectSchema(items);

export type Item = z.infer<typeof selectItemSchema>;
export type NewItem = z.infer<typeof insertItemSchema>;
```

Then add to `src/db/schema/index.ts`:
```typescript
export * from "./items.js";
```

### Step 2: Create the Zod Schemas + Swagger Registration

Create `src/modules/<name>/<name>.schemas.ts`:

```typescript
import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { registry } from "../../config/swagger.js";

extendZodWithOpenApi(z);

// ── Request schemas ────────────────────────────────────────
export const createItemSchema = z.object({
  name: z.string().min(2).openapi({ example: "My Item" }),
  description: z.string().optional().openapi({ example: "A description" }),
}).openapi("CreateItemRequest");

export const updateItemSchema = createItemSchema.partial().openapi("UpdateItemRequest");

// ── Response schemas ───────────────────────────────────────
export const itemResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  ownerId: z.string().uuid(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
}).openapi("Item");

// ── Register routes in Swagger ─────────────────────────────
registry.registerPath({
  method: "get",
  path: "/items",
  tags: ["Items"],
  summary: "List all items",
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "List of items",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.array(itemResponseSchema),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/items",
  tags: ["Items"],
  summary: "Create a new item",
  security: [{ BearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: createItemSchema } } } },
  responses: {
    201: {
      description: "Item created",
      content: { "application/json": { schema: z.object({ success: z.literal(true), data: itemResponseSchema }) } },
    },
  },
});

// ... register GET /:id, PATCH /:id, DELETE /:id similarly
```

### Step 3: Create the Service

Create `src/modules/<name>/<name>.service.ts`:

```typescript
import { eq } from "drizzle-orm";
import { db } from "../../config/db.js";
import { items } from "../../db/schema/index.js";
import { ApiError } from "../../lib/api-error.js";

export async function listItems(ownerId: string) {
  return db.select().from(items).where(eq(items.ownerId, ownerId));
}

export async function getItemById(id: string) {
  const [item] = await db.select().from(items).where(eq(items.id, id)).limit(1);
  if (!item) throw ApiError.notFound("Item not found");
  return item;
}

export async function createItem(data: { name: string; description?: string; ownerId: string }) {
  const [item] = await db.insert(items).values(data).returning();
  return item;
}

export async function updateItem(id: string, data: Partial<{ name: string; description: string }>) {
  const [item] = await db
    .update(items)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(items.id, id))
    .returning();
  if (!item) throw ApiError.notFound("Item not found");
  return item;
}

export async function deleteItem(id: string) {
  const [item] = await db.delete(items).where(eq(items.id, id)).returning();
  if (!item) throw ApiError.notFound("Item not found");
  return item;
}
```

### Step 4: Create the Controller

Create `src/modules/<name>/<name>.controller.ts`:

```typescript
import { type Request, type Response, type NextFunction } from "express";
import * as itemService from "./<name>.service.js";

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const items = await itemService.listItems(req.user!.id);
    res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const item = await itemService.getItemById(req.params.id);
    res.json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const item = await itemService.createItem({ ...req.body, ownerId: req.user!.id });
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const item = await itemService.updateItem(req.params.id, req.body);
    res.json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await itemService.deleteItem(req.params.id);
    res.json({ success: true, message: "Item deleted" });
  } catch (error) {
    next(error);
  }
}
```

### Step 5: Create the Routes

Create `src/modules/<name>/<name>.routes.ts`:

```typescript
import { Router } from "express";
import * as controller from "./<name>.controller.js";
import { validate } from "../../middleware/validate.middleware.js";
import { authenticate, authorize } from "../../middleware/auth.middleware.js";
import { createItemSchema, updateItemSchema } from "./<name>.schemas.js";
import { z } from "zod";

const router = Router();

const idParam = z.object({ id: z.string().uuid() });

// All routes require authentication
router.use(authenticate);

router.get("/", controller.list);
router.get("/:id", validate({ params: idParam }), controller.getById);
router.post("/", validate({ body: createItemSchema }), controller.create);
router.patch("/:id", validate({ params: idParam, body: updateItemSchema }), controller.update);
router.delete("/:id", validate({ params: idParam }), controller.remove);

// Admin-only route example:
// router.get("/admin/all", authorize("admin"), controller.listAll);

export default router;
```

### Step 6: Register in app.ts

Add to `src/app.ts`:

```typescript
import itemRoutes from "./modules/items/items.routes.js";

// In the ROUTE MODULES section:
app.use("/api/items", itemRoutes);
```

### Step 7: Generate Migration

```bash
bun run db:generate
bun run db:migrate
# OR for quick prototyping:
bun run db:push
```

---

## 🔧 Available Middleware

| Middleware | Import | Usage |
|-----------|--------|-------|
| `validate({ body, query, params })` | `../../middleware/validate.middleware.js` | Zod validation on request |
| `authenticate` | `../../middleware/auth.middleware.js` | Requires valid JWT, sets `req.user` |
| `authorize("admin", "owner")` | `../../middleware/auth.middleware.js` | Role-based access (use AFTER authenticate) |

---

## 📐 Response Format Convention

All API responses follow this structure:

```typescript
// Success
{ success: true, data: { ... } }
{ success: true, message: "Action completed" }
{ success: true, data: { ... }, message: "Created successfully" }

// Error
{ success: false, message: "What went wrong" }
{ success: false, message: "Validation failed", errors: [{ field: "email", message: "Invalid email" }] }
```

---

## 🔑 Auth Endpoints (Pre-built)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | Public | Register new user |
| POST | `/api/auth/login` | Public | Login, get tokens |
| POST | `/api/auth/logout` | Bearer | Invalidate refresh token |
| POST | `/api/auth/refresh` | Public | Rotate token pair |
| POST | `/api/auth/forgot-password` | Public | Generate reset token (logged to console) |
| POST | `/api/auth/reset-password` | Public | Reset password with token |
| POST | `/api/auth/verify-email` | Public | Verify email with token |
| GET | `/api/auth/me` | Bearer | Get current user |

---

## 🤖 Agent Prompts

Use these prompts with AI coding assistants to scaffold new features quickly.

---

### Prompt: Scaffold a New CRUD Module

```
I need you to scaffold a new module called "<MODULE_NAME>" in my Express + TypeScript + Drizzle + Zod backend.

Follow the module pattern in `backend/src/modules/auth/` as a reference.

The module needs these fields:
<LIST YOUR FIELDS HERE, e.g.:>
- name (string, required, min 2 chars)
- description (string, optional)
- price (number, required, >= 0)
- category (enum: "A" | "B" | "C")
- isActive (boolean, default true)

Create these files:
1. `src/db/schema/<name>.ts` — Drizzle table + drizzle-zod schemas
2. `src/modules/<name>/<name>.schemas.ts` — Zod request/response schemas + Swagger registration
3. `src/modules/<name>/<name>.service.ts` — CRUD business logic using Drizzle
4. `src/modules/<name>/<name>.controller.ts` — Thin HTTP handlers
5. `src/modules/<name>/<name>.routes.ts` — Express Router with validate + authenticate middleware

Also:
- Export the schema from `src/db/schema/index.ts`
- Register the route in `src/app.ts` as `app.use("/api/<name>", <name>Routes)`
- All routes should require authentication
- Use the existing patterns: ApiError for errors, validate() for Zod, authenticate/authorize for auth

Relations:
<DESCRIBE RELATIONS, e.g.:>
- Belongs to user (ownerId → users.id)
- Has many <other_table>
```

---

### Prompt: Add a Relation Between Two Modules

```
I need to add a relationship between "<MODULE_A>" and "<MODULE_B>" in my Drizzle + Express backend.

Relationship: <DESCRIBE, e.g.: "A user has many posts, a post belongs to one user">

Update:
1. The Drizzle schema to add the foreign key reference
2. The service layer to include the relation in queries (use Drizzle's `with` or joins)
3. The Zod response schema to include nested data
4. The Swagger docs to reflect the nested response

Follow the existing patterns in `src/modules/auth/` and `src/db/schema/users.ts`.
```

---

### Prompt: Add a Custom Endpoint to an Existing Module

```
I need to add a custom endpoint to the "<MODULE_NAME>" module:

Endpoint: <METHOD> /api/<path>
Auth: <Public | Bearer | Bearer + admin only>
Description: <What it does>

Request body/params/query:
<DESCRIBE THE INPUT>

Response:
<DESCRIBE THE OUTPUT>

Business logic:
<DESCRIBE WHAT THE SERVICE SHOULD DO>

Follow the existing module pattern:
1. Add Zod schema + Swagger registration in `<name>.schemas.ts`
2. Add business logic in `<name>.service.ts`
3. Add handler in `<name>.controller.ts`
4. Add route in `<name>.routes.ts` with appropriate middleware
```

---

### Prompt: Add Real-time / WebSocket Support

```
I need to add WebSocket support to my Express + Bun backend for real-time features.

Feature: <DESCRIBE, e.g.: "Real-time notifications when a booking is created">

Requirements:
- Use Bun's built-in WebSocket server (or socket.io if you prefer)
- Authenticate WebSocket connections using JWT
- Broadcast events to specific users/rooms
- Integrate with the existing module pattern

Create:
1. `src/config/websocket.ts` — WebSocket server setup
2. `src/lib/ws-events.ts` — Event type definitions
3. Update `src/index.ts` to attach WebSocket server
4. Update the relevant service to emit events after mutations
```

---

### Prompt: Add File Upload to a Module

```
I need to add file upload capability to the "<MODULE_NAME>" module.

Requirements:
- Accept image uploads (JPEG, PNG, WebP)
- Max file size: <SIZE, e.g.: 5MB>
- Store files in: <local ./uploads/ | S3 | Cloudinary>
- Associate uploaded files with the <TABLE_NAME> record
- Return file URL in the response

Create:
1. `src/middleware/upload.middleware.ts` — Multer config
2. `src/lib/storage.ts` — File storage abstraction (local or cloud)
3. Update `src/db/schema/<name>.ts` — Add imageUrl/fileUrl column
4. Update the controller to handle multipart/form-data
5. Update Swagger docs for file upload endpoint
```

---

### Prompt: Add Pagination + Filtering to a List Endpoint

```
I need to add pagination and filtering to the GET /api/<name> endpoint.

Query parameters:
- page (number, default 1)
- limit (number, default 10, max 100)
- sortBy (string, default "createdAt")
- sortOrder ("asc" | "desc", default "desc")
- search (string, optional — search by <field>)
- <CUSTOM FILTERS, e.g.: status, category, dateRange>

Response format:
{
  success: true,
  data: [...],
  pagination: {
    page: 1,
    limit: 10,
    total: 100,
    totalPages: 10,
    hasNext: true,
    hasPrev: false
  }
}

Update:
1. `<name>.schemas.ts` — Add query param Zod schema + Swagger
2. `<name>.service.ts` — Add Drizzle query with offset/limit, filters, and count
3. `<name>.controller.ts` — Pass query params to service
4. `<name>.routes.ts` — Add validate({ query: ... }) middleware
```

---

## 🚀 Quick Start

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Install dependencies
bun install

# 3. Copy env
cp .env.example .env

# 4. Push schema to DB (quick, no migration files)
bun run db:push

# 5. Seed test data
bun run db:seed

# 6. Start dev server
bun run dev

# 7. Open Swagger UI
open http://localhost:3000/api-docs
```

---

*Built for speed. Customize and ship. 🚀*
