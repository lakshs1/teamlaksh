import { type Request, type Response, type NextFunction } from "express";
import * as catalogService from "./catalog.service.js";

// ═══════════════════════════════════════════════════════════
// CATEGORIES CONTROLLER
// ═══════════════════════════════════════════════════════════

export async function getCategories(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const categories = await catalogService.getCategories();
    res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
}

export async function createCategory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const category = await catalogService.createCategory(req.body);
    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category,
    });
  } catch (error) {
    next(error);
  }
}

// ═══════════════════════════════════════════════════════════
// PRODUCTS CONTROLLER
// ═══════════════════════════════════════════════════════════

export async function listProducts(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await catalogService.listProducts(req.query as any);
    res.status(200).json({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function getProductById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = Number(req.params.id);
    const product = await catalogService.getProductById(id);
    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
}

export async function createProduct(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const product = await catalogService.createProduct(req.body);
    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateProduct(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = Number(req.params.id);
    const product = await catalogService.updateProduct(id, req.body);
    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: product,
    });
  } catch (error) {
    next(error);
  }
}

// ═══════════════════════════════════════════════════════════
// VARIANTS CONTROLLER
// ═══════════════════════════════════════════════════════════

export async function createVariant(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const productId = Number(req.params.id);
    const variant = await catalogService.createVariant(productId, req.body);
    res.status(201).json({
      success: true,
      message: "Product variant created successfully",
      data: variant,
    });
  } catch (error) {
    next(error);
  }
}

// ═══════════════════════════════════════════════════════════
// PRICE LISTS CONTROLLER
// ═══════════════════════════════════════════════════════════

export async function getPriceLists(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const priceLists = await catalogService.getPriceLists();
    res.status(200).json({
      success: true,
      data: priceLists,
    });
  } catch (error) {
    next(error);
  }
}

export async function createPriceList(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const priceList = await catalogService.createPriceList(req.body);
    res.status(201).json({
      success: true,
      message: "Price list created successfully",
      data: priceList,
    });
  } catch (error) {
    next(error);
  }
}

export async function addPriceListItem(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const priceListId = Number(req.params.id);
    const item = await catalogService.addPriceListItem(priceListId, req.body);
    res.status(201).json({
      success: true,
      message: "Item added to price list successfully",
      data: item,
    });
  } catch (error) {
    next(error);
  }
}
