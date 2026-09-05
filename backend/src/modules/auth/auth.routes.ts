import { Router } from "express";
import * as authController from "./auth.controller.js";
import { validate } from "../../middleware/validate.middleware.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { registerSchema, loginSchema, refreshSchema, roleSelectSchema } from "./auth.schemas.js";

const router = Router();

// ── Public routes ──────────────────────────────────────────
router.post("/register", validate({ body: registerSchema }), authController.register);
router.post("/login", validate({ body: loginSchema }), authController.login);
router.post("/refresh", validate({ body: refreshSchema }), authController.refresh);
router.post("/demo-login", validate({ body: roleSelectSchema }), authController.demoLogin);

// ── Protected routes ───────────────────────────────────────
router.post("/logout", authenticate, authController.logout);
router.get("/me", authenticate, authController.getMe);
router.get("/users", authenticate, authController.getUsers);
router.post("/switch-role", authenticate, validate({ body: roleSelectSchema }), authController.switchRole);

export default router;
