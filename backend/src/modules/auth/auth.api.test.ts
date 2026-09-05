import { describe, it } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { app } from "../../app.js";
import { generateAccessToken } from "../../lib/jwt.js";
import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.middleware.js";

describe("Auth API & Role Protected Endpoints", () => {
  // Mount test endpoints to verify role authorization through Express
  const testRouter = Router();
  testRouter.get("/manager-only", authenticate, authorize("manager"), (_req, res) => {
    res.json({ success: true, message: "Welcome manager" });
  });
  testRouter.get("/finance-or-admin", authenticate, authorize("finance", "admin"), (_req, res) => {
    res.json({ success: true, message: "Welcome finance or admin" });
  });
  app.use("/api/test-roles", testRouter);

  it("should verify health endpoint and role-protected endpoint access", async () => {
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      // 1. Health check
      const healthRes = await fetch(`${baseUrl}/api/health`);
      assert.equal(healthRes.status, 200);
      const healthData = await healthRes.json() as { status: string };
      assert.equal(healthData.status, "ok");

      // 2. Unauthenticated request to manager-only endpoint should be 401
      const unauthRes = await fetch(`${baseUrl}/api/test-roles/manager-only`);
      assert.equal(unauthRes.status, 401);

      // 3. User with 'rep' role accessing manager-only endpoint should be 403
      const repToken = generateAccessToken({ id: 10, email: "rep@dealflow.dev", role: "rep" });
      const forbiddenRes = await fetch(`${baseUrl}/api/test-roles/manager-only`, {
        headers: { Authorization: `Bearer ${repToken}` },
      });
      assert.equal(forbiddenRes.status, 403);

      // 4. User with 'manager' role accessing manager-only endpoint should be 200
      const managerToken = generateAccessToken({ id: 11, email: "manager@dealflow.dev", role: "manager" });
      const allowedRes = await fetch(`${baseUrl}/api/test-roles/manager-only`, {
        headers: { Authorization: `Bearer ${managerToken}` },
      });
      assert.equal(allowedRes.status, 200);
      const managerData = await allowedRes.json() as { success: boolean; message: string };
      assert.equal(managerData.success, true);
      assert.equal(managerData.message, "Welcome manager");

      // 5. User with 'finance' role accessing finance-or-admin should be 200
      const financeToken = generateAccessToken({ id: 12, email: "finance@dealflow.dev", role: "finance" });
      const financeRes = await fetch(`${baseUrl}/api/test-roles/finance-or-admin`, {
        headers: { Authorization: `Bearer ${financeToken}` },
      });
      assert.equal(financeRes.status, 200);

      // 6. User with 'admin' role accessing finance-or-admin should be 200
      const adminToken = generateAccessToken({ id: 13, email: "admin@dealflow.dev", role: "admin" });
      const adminRes = await fetch(`${baseUrl}/api/test-roles/finance-or-admin`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(adminRes.status, 200);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
