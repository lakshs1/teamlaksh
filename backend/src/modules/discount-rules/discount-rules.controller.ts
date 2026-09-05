import { type Request, type Response, type NextFunction } from "express";
import * as discountRulesService from "./discount-rules.service.js";

// ═══════════════════════════════════════════════════════════
// DISCOUNT RULES CONTROLLER
// ═══════════════════════════════════════════════════════════

export async function getDiscountRules(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rules = await discountRulesService.getDiscountRules(req.query as any);
    res.status(200).json({
      success: true,
      data: rules,
    });
  } catch (error) {
    next(error);
  }
}

export async function createDiscountRule(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rule = await discountRulesService.createDiscountRule(req.body);
    res.status(201).json({
      success: true,
      message: "Discount rule created successfully",
      data: rule,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateDiscountRule(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = Number(req.params.id);
    const rule = await discountRulesService.updateDiscountRule(id, req.body);
    res.status(200).json({
      success: true,
      message: "Discount rule updated successfully",
      data: rule,
    });
  } catch (error) {
    next(error);
  }
}

export async function evaluatePolicy(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { tier_id, category_id, requested_discount_pct } = req.query as any;
    const result = await discountRulesService.evaluateDiscountPolicy({
      tier_id: Number(tier_id),
      category_id: Number(category_id),
      requested_discount_pct: Number(requested_discount_pct),
    });
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
