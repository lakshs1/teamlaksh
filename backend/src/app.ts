import express from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import pino from "pino";
import { env } from "./config/env.js";
import { setupSwagger } from "./config/swagger.js";
import { errorHandler } from "./middleware/error.middleware.js";

// ── Import route modules ──────────────────────────────────
import authRoutes from "./modules/auth/auth.routes.js";
import customersRoutes from "./modules/customers/customers.routes.js";
import catalogRoutes from "./modules/catalog/catalog.routes.js";
import discountRulesRoutes from "./modules/discount-rules/discount-rules.routes.js";
import quotesRoutes from "./modules/quotes/quotes.routes.js";
import approvalsRoutes from "./modules/approvals/approvals.routes.js";
import recommendationsRoutes from "./modules/recommendations/recommendations.routes.js";
import fulfillmentRoutes from "./modules/fulfillment/fulfillment.routes.js";
import billingRoutes from "./modules/billing/billing.routes.js";
import portalRoutes from "./modules/portal/portal.routes.js";
import analyticsRoutes from "./modules/analytics/analytics.routes.js";

// ── Logger ────────────────────────────────────────────────
const logger = pino({
  transport:
    env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});

// ── Express app ───────────────────────────────────────────
const app = express();

// ── Global middleware ─────────────────────────────────────
app.use(
  cors({
    origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN || true,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(pinoHttp({ logger }));

// ── Swagger ───────────────────────────────────────────────
setupSwagger(app);

// ── Health check ──────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ═══════════════════════════════════════════════════════════
// ROUTE MODULES
// ═══════════════════════════════════════════════════════════
app.use("/api/v1/auth", authRoutes);
app.use("/api/auth", authRoutes); // backward compatibility alias
app.use("/api/v1/customers", customersRoutes);
app.use("/api/v1/catalog", catalogRoutes);
app.use("/api/catalog", catalogRoutes); // backward compatibility alias
app.use("/api/v1/discount-rules", discountRulesRoutes);
app.use("/api/v1/quotes", quotesRoutes);
app.use("/api/v1/approvals", approvalsRoutes);
app.use("/api/v1/recommendations", recommendationsRoutes);
app.use("/api/v1/fulfillment", fulfillmentRoutes);
app.use("/api/v1/billing", billingRoutes);
app.use("/api/v1/portal", portalRoutes);
app.use("/api/v1/analytics", analyticsRoutes);

// ── Error handler (must be last) ──────────────────────────
app.use(errorHandler);

export { app, logger };
