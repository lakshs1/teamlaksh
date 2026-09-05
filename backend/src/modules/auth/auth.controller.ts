import { type Request, type Response, type NextFunction } from "express";
import * as authService from "./auth.service.js";

// ═══════════════════════════════════════════════════════════
// AUTH CONTROLLER — DealFlow360 Auth Request Handlers
// ═══════════════════════════════════════════════════════════

export async function register(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await authService.register(req.body);
    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await authService.login(req.body);
    res.status(200).json({
      success: true,
      message: "Login successful",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await authService.logout(req.user!.id);
    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
}

export async function refresh(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await authService.refresh(req.body.refreshToken);
    res.status(200).json({
      success: true,
      message: "Tokens refreshed successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMe(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await authService.getMe(req.user!.id);
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

export async function switchRole(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await authService.switchRole(req.user!.id, req.body.role);
    res.status(200).json({
      success: true,
      message: `Role switched to ${req.body.role} successfully`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function demoLogin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await authService.demoLogin(req.body.role);
    res.status(200).json({
      success: true,
      message: `Demo logged in as ${req.body.role}`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getUsers(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await authService.getAllUsers();
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
