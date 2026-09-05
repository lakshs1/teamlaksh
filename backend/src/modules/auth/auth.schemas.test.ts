import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { USER_ROLES } from "../../db/schema/index.js";
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  safeUserResponseSchema,
} from "./auth.schemas.js";

describe("Auth Schemas & User Roles Validation", () => {
  it("should define the required DealFlow360 roles", () => {
    assert.deepEqual([...USER_ROLES], ["admin", "manager", "rep", "finance"]);
  });

  it("should accept valid register request with supported roles", () => {
    for (const role of USER_ROLES) {
      const parsed = registerSchema.safeParse({
        email: `${role}@dealflow.dev`,
        password: "securepassword123",
        name: `User ${role}`,
        role,
      });

      assert.equal(parsed.success, true);
    }
  });

  it("should reject register request with invalid email or short password", () => {
    const invalidEmail = registerSchema.safeParse({
      email: "not-an-email",
      password: "password123",
      name: "Test",
    });
    assert.equal(invalidEmail.success, false);

    const shortPassword = registerSchema.safeParse({
      email: "test@dealflow.dev",
      password: "short",
      name: "Test",
    });
    assert.equal(shortPassword.success, false);
  });

  it("should accept valid login schema", () => {
    const valid = loginSchema.safeParse({
      email: "sales@dealflow.dev",
      password: "password123",
    });
    assert.equal(valid.success, true);
  });

  it("should validate safeUserResponseSchema with numeric id", () => {
    const sampleSafeUser = {
      id: 1,
      email: "rep@dealflow.dev",
      name: "Sales Rep",
      role: "rep",
      avatarUrl: null,
      githubUrl: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const parsed = safeUserResponseSchema.safeParse(sampleSafeUser);
    assert.equal(parsed.success, true);
  });
});
