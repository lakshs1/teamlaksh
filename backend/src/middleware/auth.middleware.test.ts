import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { type Request, type Response, type NextFunction } from "express";
import { authenticate, authorize } from "./auth.middleware.js";
import { generateAccessToken } from "../lib/jwt.js";
import { ApiError } from "../lib/api-error.js";

describe("Auth Middleware", () => {
  describe("authenticate()", () => {
    it("should extract and decode valid Bearer token", () => {
      const token = generateAccessToken({
        id: 1,
        email: "rep@dealflow360.dev",
        role: "rep",
      });

      const req = {
        headers: { authorization: `Bearer ${token}` },
      } as unknown as Request;
      const res = {} as Response;
      let nextCalled = false;
      let nextError: unknown = null;

      const next: NextFunction = (err?: unknown) => {
        nextCalled = true;
        nextError = err;
      };

      authenticate(req, res, next);

      assert.equal(nextCalled, true);
      assert.equal(nextError, undefined);
      assert.ok(req.user);
      assert.equal(req.user.role, "rep");
      assert.equal(req.user.email, "rep@dealflow360.dev");
    });

    it("should pass ApiError.unauthorized when header is missing", () => {
      const req = { headers: {} } as Request;
      const res = {} as Response;
      let nextError: unknown = null;

      authenticate(req, res, (err?: unknown) => {
        nextError = err;
      });

      assert.ok(nextError instanceof ApiError);
      assert.equal((nextError as ApiError).statusCode, 401);
    });

    it("should pass ApiError.unauthorized on non-Bearer prefix", () => {
      const req = {
        headers: { authorization: "Basic 12345" },
      } as unknown as Request;
      let nextError: unknown = null;

      authenticate(req, {} as Response, (err?: unknown) => {
        nextError = err;
      });

      assert.ok(nextError instanceof ApiError);
      assert.equal((nextError as ApiError).statusCode, 401);
    });
  });

  describe("authorize()", () => {
    it("should allow request if user has allowed role", () => {
      const req = {
        user: { id: 2, email: "manager@dealflow.dev", role: "manager" },
      } as unknown as Request;
      const res = {} as Response;
      let nextCalled = false;
      let nextError: unknown = null;

      const middleware = authorize("manager", "finance");
      middleware(req, res, (err?: unknown) => {
        nextCalled = true;
        nextError = err;
      });

      assert.equal(nextCalled, true);
      assert.equal(nextError, undefined);
    });

    it("should reject with 403 Forbidden if user role is not allowed", () => {
      const req = {
        user: { id: 3, email: "rep@dealflow.dev", role: "rep" },
      } as unknown as Request;
      let nextError: unknown = null;

      const middleware = authorize("manager", "finance");
      middleware(req, {} as Response, (err?: unknown) => {
        nextError = err;
      });

      assert.ok(nextError instanceof ApiError);
      assert.equal((nextError as ApiError).statusCode, 403);
      assert.match((nextError as ApiError).message, /Access denied/);
    });

    it("should reject with 401 Unauthorized if user is not on request", () => {
      const req = {} as Request;
      let nextError: unknown = null;

      const middleware = authorize("admin");
      middleware(req, {} as Response, (err?: unknown) => {
        nextError = err;
      });

      assert.ok(nextError instanceof ApiError);
      assert.equal((nextError as ApiError).statusCode, 401);
    });
  });
});
