import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, comparePassword } from "./password.js";

describe("Password Utility", () => {
  it("should hash a password with bcrypt", async () => {
    const raw = "SuperSecret123!";
    const hash = await hashPassword(raw);

    assert.ok(hash);
    assert.notEqual(hash, raw);
    assert.match(hash, /^\$2[aby]\$\d+\$/);
  });

  it("should verify matching password successfully", async () => {
    const raw = "dealflow-secure-2026";
    const hash = await hashPassword(raw);
    const isValid = await comparePassword(raw, hash);

    assert.equal(isValid, true);
  });

  it("should reject incorrect password", async () => {
    const raw = "correctPassword123";
    const hash = await hashPassword(raw);
    const isValid = await comparePassword("wrongPassword321", hash);

    assert.equal(isValid, false);
  });
});
