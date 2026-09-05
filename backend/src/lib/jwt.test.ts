import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateTokenPair,
  type TokenPayload,
} from "./jwt.js";

describe("JWT Utility", () => {
  const mockPayload: TokenPayload = {
    id: 42,
    email: "manager@dealflow360.dev",
    role: "manager",
  };

  it("should generate and verify an access token with correct payload", () => {
    const token = generateAccessToken(mockPayload);
    assert.ok(token);

    const decoded = verifyAccessToken(token);
    assert.equal(decoded.id, 42);
    assert.equal(decoded.email, "manager@dealflow360.dev");
    assert.equal(decoded.role, "manager");
  });

  it("should generate and verify a refresh token with correct payload", () => {
    const token = generateRefreshToken(mockPayload);
    assert.ok(token);

    const decoded = verifyRefreshToken(token);
    assert.equal(decoded.id, 42);
    assert.equal(decoded.email, "manager@dealflow360.dev");
    assert.equal(decoded.role, "manager");
  });

  it("should generate both access and refresh tokens as a pair", () => {
    const pair = generateTokenPair(mockPayload);
    assert.ok(pair.accessToken);
    assert.ok(pair.refreshToken);

    const accessDecoded = verifyAccessToken(pair.accessToken);
    const refreshDecoded = verifyRefreshToken(pair.refreshToken);

    assert.equal(accessDecoded.role, "manager");
    assert.equal(refreshDecoded.role, "manager");
  });

  it("should preserve different user roles in token payload", () => {
    const roles = ["admin", "manager", "rep", "finance"];

    for (const role of roles) {
      const payload: TokenPayload = { id: 10, email: `${role}@dealflow.dev`, role };
      const token = generateAccessToken(payload);
      const decoded = verifyAccessToken(token);
      assert.equal(decoded.role, role);
    }
  });

  it("should throw on corrupted/invalid token", () => {
    assert.throws(() => {
      verifyAccessToken("invalid.corrupted.token");
    });
  });
});
