import { Router } from "express";
import * as authController from "./auth.controller.js";
import { validate } from "../../middleware/validate.middleware.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "./auth.schemas.js";

const router = Router();

// ── Public routes ──────────────────────────────────────────
router.post("/register", validate({ body: registerSchema }), authController.register);
router.post("/login", validate({ body: loginSchema }), authController.login);
router.post("/refresh", validate({ body: refreshSchema }), authController.refresh);
router.post("/forgot-password", validate({ body: forgotPasswordSchema }), authController.forgotPassword);
router.post("/reset-password", validate({ body: resetPasswordSchema }), authController.resetPassword);
router.post("/verify-email", validate({ body: verifyEmailSchema }), authController.verifyEmail);

// ── Protected routes ───────────────────────────────────────
router.post("/logout", authenticate, authController.logout);
router.get("/me", authenticate, authController.getMe);

export default router;
