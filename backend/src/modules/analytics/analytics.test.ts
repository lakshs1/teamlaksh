import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as http from "node:http";
import { app } from "../../app.js";
import {
  dealHealthQuerySchema,
  alertsQuerySchema,
  escalateAlertSchema,
  salesReportQuerySchema,
} from "./analytics.schemas.js";
import { generateAccessToken } from "../../lib/jwt.js";

describe("Analytics Module", () => {
  describe("Schema Validations", () => {
    it("dealHealthQuerySchema applies default 7 days", () => {
      const parsed = dealHealthQuerySchema.parse({});
      assert.equal(parsed.stalled_days, 7);
    });

    it("dealHealthQuerySchema coerces string numbers", () => {
      const parsed = dealHealthQuerySchema.parse({ stalled_days: "14" });
      assert.equal(parsed.stalled_days, 14);
    });

    it("alertsQuerySchema applies pagination defaults", () => {
      const parsed = alertsQuerySchema.parse({});
      assert.equal(parsed.page, 1);
      assert.equal(parsed.limit, 20);
    });

    it("alertsQuerySchema converts string booleans for is_resolved", () => {
      const parsedTrue = alertsQuerySchema.parse({ is_resolved: "true" });
      assert.equal(parsedTrue.is_resolved, true);

      const parsedFalse = alertsQuerySchema.parse({ is_resolved: "false" });
      assert.equal(parsedFalse.is_resolved, false);
    });

    it("escalateAlertSchema accepts optional message and trims", () => {
      const parsed = escalateAlertSchema.parse({ message: "  Please review ASAP  " });
      assert.equal(parsed.message, "Please review ASAP");
    });

    it("salesReportQuerySchema defaults period to monthly", () => {
      const parsed = salesReportQuerySchema.parse({});
      assert.equal(parsed.period, "monthly");
    });
  });

  describe("API Endpoints & RBAC Guards", () => {
    it("should reject unauthenticated requests with 401", async () => {
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const { port } = server.address() as any;
      const url = `http://localhost:${port}`;

      try {
        const healthRes = await fetch(`${url}/api/v1/analytics/deal-health`);
        assert.equal(healthRes.status, 401);

        const alertsRes = await fetch(`${url}/api/v1/analytics/alerts`);
        assert.equal(alertsRes.status, 401);

        const resolveRes = await fetch(`${url}/api/v1/analytics/alerts/1/resolve`, {
          method: "POST",
        });
        assert.equal(resolveRes.status, 401);

        const escalateRes = await fetch(`${url}/api/v1/analytics/alerts/1/escalate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "Follow up" }),
        });
        assert.equal(escalateRes.status, 401);

        const reportRes = await fetch(`${url}/api/v1/analytics/reports/sales`);
        assert.equal(reportRes.status, 401);
      } finally {
        server.close();
      }
    });

    it("should forbid sales reps from accessing analytics endpoints with 403", async () => {
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const { port } = server.address() as any;
      const url = `http://localhost:${port}`;

      try {
        const repToken = generateAccessToken({
          id: 99,
          email: "rep@dealflow360.dev",
          role: "rep",
        });

        const headers = { Authorization: `Bearer ${repToken}` };

        const healthRes = await fetch(`${url}/api/v1/analytics/deal-health`, { headers });
        assert.equal(healthRes.status, 403);

        const alertsRes = await fetch(`${url}/api/v1/analytics/alerts`, { headers });
        assert.equal(alertsRes.status, 403);

        const reportRes = await fetch(`${url}/api/v1/analytics/reports/sales`, { headers });
        assert.equal(reportRes.status, 403);
      } finally {
        server.close();
      }
    });
  });
});
