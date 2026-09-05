import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as http from "node:http";
import { app } from "../../app.js";
import {
  approveActionSchema,
  rejectActionSchema,
  reviseActionSchema,
} from "./approvals.schemas.js";
import { generateAccessToken } from "../../lib/jwt.js";

// ═══════════════════════════════════════════════════════════
// SCHEMA VALIDATION
// ═══════════════════════════════════════════════════════════

describe("Approvals Module", () => {
  describe("Schema Validations", () => {
    it("approveActionSchema accepts empty body (reason is optional)", () => {
      const result = approveActionSchema.parse({});
      assert.equal(result.reason, undefined);
    });

    it("approveActionSchema accepts a reason", () => {
      const result = approveActionSchema.parse({ reason: "Margins are acceptable" });
      assert.equal(result.reason, "Margins are acceptable");
    });

    it("rejectActionSchema requires a reason", () => {
      assert.throws(() => rejectActionSchema.parse({}), /too_small|required|min/i);
    });

    it("rejectActionSchema accepts valid reason", () => {
      const result = rejectActionSchema.parse({ reason: "Discount exceeds policy" });
      assert.equal(result.reason, "Discount exceeds policy");
    });

    it("reviseActionSchema requires a reason", () => {
      assert.throws(() => reviseActionSchema.parse({}), /too_small|required|min/i);
    });

    it("reviseActionSchema accepts valid reason", () => {
      const result = reviseActionSchema.parse({ reason: "Please reduce line 2 discount" });
      assert.equal(result.reason, "Please reduce line 2 discount");
    });
  });

  // ═══════════════════════════════════════════════════════════
  // API ENDPOINT TESTS — ACCESS CONTROL
  // ═══════════════════════════════════════════════════════════

  describe("API Endpoints & Access Control", () => {
    it("should require authentication on all approval endpoints", async () => {
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const { port } = server.address() as any;
      const url = `http://localhost:${port}`;

      try {
        const pendingRes = await fetch(`${url}/api/v1/approvals/pending`);
        assert.equal(pendingRes.status, 401);

        const logsRes = await fetch(`${url}/api/v1/approvals/quotes/1/logs`);
        assert.equal(logsRes.status, 401);

        const approveRes = await fetch(`${url}/api/v1/approvals/quotes/1/approve`, { method: "POST" });
        assert.equal(approveRes.status, 401);

        const rejectRes = await fetch(`${url}/api/v1/approvals/quotes/1/reject`, { method: "POST" });
        assert.equal(rejectRes.status, 401);
      } finally {
        server.close();
      }
    });

    it("rep role cannot access /approvals/pending (403)", async () => {
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const { port } = server.address() as any;
      const url = `http://localhost:${port}`;

      try {
        const repToken = generateAccessToken({ id: 10, email: "rep@dealflow.dev", role: "rep" });
        const res = await fetch(`${url}/api/v1/approvals/pending`, {
          headers: { Authorization: `Bearer ${repToken}` },
        });
        assert.equal(res.status, 403);
      } finally {
        server.close();
      }
    });

    it("rep role cannot approve quotes (403)", async () => {
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const { port } = server.address() as any;
      const url = `http://localhost:${port}`;

      try {
        const repToken = generateAccessToken({ id: 10, email: "rep@dealflow.dev", role: "rep" });
        const res = await fetch(`${url}/api/v1/approvals/quotes/1/approve`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${repToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason: "Self approval attempt" }),
        });
        assert.equal(res.status, 403);
      } finally {
        server.close();
      }
    });

    it("rep role cannot reject quotes (403)", async () => {
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const { port } = server.address() as any;
      const url = `http://localhost:${port}`;

      try {
        const repToken = generateAccessToken({ id: 10, email: "rep@dealflow.dev", role: "rep" });
        const res = await fetch(`${url}/api/v1/approvals/quotes/1/reject`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${repToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason: "Invalid price" }),
        });
        assert.equal(res.status, 403);
      } finally {
        server.close();
      }
    });

    it("rep role cannot request revision (403)", async () => {
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const { port } = server.address() as any;
      const url = `http://localhost:${port}`;

      try {
        const repToken = generateAccessToken({ id: 10, email: "rep@dealflow.dev", role: "rep" });
        const res = await fetch(`${url}/api/v1/approvals/quotes/1/revise`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${repToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ feedback: "Change items" }),
        });
        assert.equal(res.status, 403);
      } finally {
        server.close();
      }
    });

    it("reject action requires a reason body — 422 on empty body", async () => {
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const { port } = server.address() as any;
      const url = `http://localhost:${port}`;

      try {
        const managerToken = generateAccessToken({ id: 2, email: "manager@dealflow.dev", role: "manager" });
        const res = await fetch(`${url}/api/v1/approvals/quotes/1/reject`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${managerToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });
        assert.ok([400, 422].includes(res.status));
      } finally {
        server.close();
      }
    });

    it("revise action requires feedback — 422 on empty feedback", async () => {
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const { port } = server.address() as any;
      const url = `http://localhost:${port}`;

      try {
        const managerToken = generateAccessToken({ id: 2, email: "manager@dealflow.dev", role: "manager" });
        const res = await fetch(`${url}/api/v1/approvals/quotes/1/revise`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${managerToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ feedback: "" }),
        });
        assert.ok([400, 422].includes(res.status));
      } finally {
        server.close();
      }
    });
  });
});
