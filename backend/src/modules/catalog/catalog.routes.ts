import { Router } from "express";
import { z } from "zod";
import * as catalogController from "./catalog.controller.js";
import { validate } from "../../middleware/validate.middleware.js";
import { authenticate, authorize } from "../../middleware/auth.middleware.js";
import {
  createCategorySchema,
  createProductSchema,
  updateProductSchema,
  productQuerySchema,
  createVariantSchema,
  createPriceListSchema,
  addPriceListItemSchema,
} from "./catalog.schemas.js";

const router = Router();

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// ── Categories ──────────────────────────────────────────────
router.get("/categories", authenticate, catalogController.getCategories);
router.post(
  "/categories",
  authenticate,
  authorize("admin"),
  validate({ body: createCategorySchema }),
  catalogController.createCategory
);

// ── Price Lists ─────────────────────────────────────────────
router.get("/price-lists", authenticate, catalogController.getPriceLists);
router.post(
  "/price-lists",
  authenticate,
  authorize("admin"),
  validate({ body: createPriceListSchema }),
  catalogController.createPriceList
);
router.post(
  "/price-lists/:id/items",
  authenticate,
  authorize("admin"),
  validate({ params: idParamSchema, body: addPriceListItemSchema }),
  catalogController.addPriceListItem
);

// ── Products ────────────────────────────────────────────────
router.get(
  "/products",
  authenticate,
  validate({ query: productQuerySchema }),
  catalogController.listProducts
);

router.post(
  "/products",
  authenticate,
  authorize("admin"),
  validate({ body: createProductSchema }),
  catalogController.createProduct
);

router.get(
  "/products/:id",
  authenticate,
  validate({ params: idParamSchema }),
  catalogController.getProductById
);

router.patch(
  "/products/:id",
  authenticate,
  authorize("admin"),
  validate({ params: idParamSchema, body: updateProductSchema }),
  catalogController.updateProduct
);

// ── Product Variants ────────────────────────────────────────
router.post(
  "/products/:id/variants",
  authenticate,
  authorize("admin"),
  validate({ params: idParamSchema, body: createVariantSchema }),
  catalogController.createVariant
);

export default router;
