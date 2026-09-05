import { type Request, type Response, type NextFunction } from "express";
import * as customersService from "./customers.service.js";

// ═══════════════════════════════════════════════════════════
// CUSTOMER TIERS CONTROLLER
// ═══════════════════════════════════════════════════════════

export async function getTiers(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tiers = await customersService.getTiers();
    res.status(200).json({
      success: true,
      data: tiers,
    });
  } catch (error) {
    next(error);
  }
}

export async function createTier(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tier = await customersService.createTier(req.body);
    res.status(201).json({
      success: true,
      message: "Customer tier created successfully",
      data: tier,
    });
  } catch (error) {
    next(error);
  }
}

// ═══════════════════════════════════════════════════════════
// CUSTOMERS CONTROLLER
// ═══════════════════════════════════════════════════════════

export async function listCustomers(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await customersService.listCustomers(req.query as any);
    res.status(200).json({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function getCustomerById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = Number(req.params.id);
    const customer = await customersService.getCustomerById(id);
    res.status(200).json({
      success: true,
      data: customer,
    });
  } catch (error) {
    next(error);
  }
}

export async function createCustomer(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const customer = await customersService.createCustomer(req.body);
    res.status(201).json({
      success: true,
      message: "Customer created successfully",
      data: customer,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateCustomer(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = Number(req.params.id);
    const customer = await customersService.updateCustomer(id, req.body);
    res.status(200).json({
      success: true,
      message: "Customer updated successfully",
      data: customer,
    });
  } catch (error) {
    next(error);
  }
}
