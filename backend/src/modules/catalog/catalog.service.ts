import { eq, and, sql } from "drizzle-orm";
import {
  db,
  productCategories,
  products,
  productVariants,
  priceLists,
  priceListItems,
  customerTiers,
} from "@db";
import { ApiError } from "../../lib/api-error.js";

// ═══════════════════════════════════════════════════════════
// CATEGORIES SERVICE
// ═══════════════════════════════════════════════════════════

export async function getCategories() {
  return db
    .select()
    .from(productCategories)
    .orderBy(productCategories.name);
}

export async function createCategory(data: { name: string; max_discount_pct: number }) {
  const existing = await db
    .select()
    .from(productCategories)
    .where(eq(productCategories.name, data.name))
    .limit(1);

  if (existing.length > 0) {
    throw ApiError.conflict(`Product category '${data.name}' already exists`);
  }

  const [category] = await db
    .insert(productCategories)
    .values({
      name: data.name,
      maxDiscountPct: data.max_discount_pct.toString(),
    })
    .returning();

  return category;
}

// ═══════════════════════════════════════════════════════════
// PRODUCTS SERVICE
// ═══════════════════════════════════════════════════════════

export async function listProducts(query: {
  search?: string;
  category_id?: number;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 20));
  const offset = (page - 1) * limit;

  const conditions = [];

  if (query.search) {
    conditions.push(
      sql`(${products.name} ILIKE ${`%${query.search}%`} OR ${products.description} ILIKE ${`%${query.search}%`})`
    );
  }

  if (query.category_id) {
    conditions.push(eq(products.categoryId, query.category_id));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      description: products.description,
      categoryId: products.categoryId,
      basePrice: products.basePrice,
      costPrice: products.costPrice,
      unit: products.unit,
      taxPct: products.taxPct,
      isRecurring: products.isRecurring,
      recurringInterval: products.recurringInterval,
      isActive: products.isActive,
      createdAt: products.createdAt,
      category: {
        id: productCategories.id,
        name: productCategories.name,
        maxDiscountPct: productCategories.maxDiscountPct,
        createdAt: productCategories.createdAt,
      },
    })
    .from(products)
    .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
    .where(whereClause)
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(whereClause);

  return {
    items: rows,
    pagination: {
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit) || 1,
    },
  };
}

export async function getProductById(id: number) {
  const [product] = await db
    .select({
      id: products.id,
      name: products.name,
      description: products.description,
      categoryId: products.categoryId,
      basePrice: products.basePrice,
      costPrice: products.costPrice,
      unit: products.unit,
      taxPct: products.taxPct,
      isRecurring: products.isRecurring,
      recurringInterval: products.recurringInterval,
      isActive: products.isActive,
      createdAt: products.createdAt,
      category: {
        id: productCategories.id,
        name: productCategories.name,
        maxDiscountPct: productCategories.maxDiscountPct,
        createdAt: productCategories.createdAt,
      },
    })
    .from(products)
    .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
    .where(eq(products.id, id))
    .limit(1);

  if (!product) {
    throw ApiError.notFound(`Product with ID ${id} not found`);
  }

  const variants = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, id))
    .orderBy(productVariants.id);

  return {
    ...product,
    variants,
  };
}

export async function createProduct(data: {
  name: string;
  description?: string;
  category_id: number;
  base_price: number;
  cost_price: number;
  unit?: string;
  tax_pct?: number;
  is_recurring?: boolean;
  recurring_interval?: string | null;
}) {
  const [category] = await db
    .select()
    .from(productCategories)
    .where(eq(productCategories.id, data.category_id))
    .limit(1);

  if (!category) {
    throw ApiError.badRequest(`Category ID ${data.category_id} does not exist`);
  }

  const [product] = await db
    .insert(products)
    .values({
      name: data.name,
      description: data.description || null,
      categoryId: data.category_id,
      basePrice: data.base_price.toString(),
      costPrice: data.cost_price.toString(),
      unit: data.unit || "unit",
      taxPct: (data.tax_pct ?? 0).toString(),
      isRecurring: data.is_recurring ?? false,
      recurringInterval: data.recurring_interval || null,
    })
    .returning();

  return getProductById(product.id);
}

export async function updateProduct(
  id: number,
  data: {
    name?: string;
    description?: string | null;
    category_id?: number;
    base_price?: number;
    cost_price?: number;
    unit?: string;
    tax_pct?: number;
    is_recurring?: boolean;
    recurring_interval?: string | null;
    is_active?: boolean;
  }
) {
  const existing = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  if (existing.length === 0) {
    throw ApiError.notFound(`Product with ID ${id} not found`);
  }

  if (data.category_id) {
    const [category] = await db
      .select()
      .from(productCategories)
      .where(eq(productCategories.id, data.category_id))
      .limit(1);

    if (!category) {
      throw ApiError.badRequest(`Category ID ${data.category_id} does not exist`);
    }
  }

  await db
    .update(products)
    .set({
      ...(data.name ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.category_id ? { categoryId: data.category_id } : {}),
      ...(data.base_price !== undefined ? { basePrice: data.base_price.toString() } : {}),
      ...(data.cost_price !== undefined ? { costPrice: data.cost_price.toString() } : {}),
      ...(data.unit ? { unit: data.unit } : {}),
      ...(data.tax_pct !== undefined ? { taxPct: data.tax_pct.toString() } : {}),
      ...(data.is_recurring !== undefined ? { isRecurring: data.is_recurring } : {}),
      ...(data.recurring_interval !== undefined ? { recurringInterval: data.recurring_interval } : {}),
      ...(data.is_active !== undefined ? { isActive: data.is_active } : {}),
    })
    .where(eq(products.id, id));

  return getProductById(id);
}

// ═══════════════════════════════════════════════════════════
// VARIANTS SERVICE
// ═══════════════════════════════════════════════════════════

export async function createVariant(
  productId: number,
  data: {
    attribute_name: string;
    attribute_value: string;
    extra_price?: number;
  }
) {
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product) {
    throw ApiError.notFound(`Product with ID ${productId} not found`);
  }

  const [variant] = await db
    .insert(productVariants)
    .values({
      productId,
      attributeName: data.attribute_name,
      attributeValue: data.attribute_value,
      extraPrice: (data.extra_price ?? 0).toString(),
    })
    .returning();

  return variant;
}

// ═══════════════════════════════════════════════════════════
// PRICE LISTS SERVICE
// ═══════════════════════════════════════════════════════════

export async function getPriceLists() {
  const lists = await db
    .select({
      id: priceLists.id,
      name: priceLists.name,
      tierId: priceLists.tierId,
      currency: priceLists.currency,
      isActive: priceLists.isActive,
      createdAt: priceLists.createdAt,
      tier: {
        id: customerTiers.id,
        name: customerTiers.name,
      },
    })
    .from(priceLists)
    .leftJoin(customerTiers, eq(priceLists.tierId, customerTiers.id))
    .orderBy(priceLists.name);

  return lists;
}

export async function createPriceList(data: {
  name: string;
  tier_id?: number | null;
  currency?: string;
}) {
  if (data.tier_id) {
    const [tier] = await db
      .select()
      .from(customerTiers)
      .where(eq(customerTiers.id, data.tier_id))
      .limit(1);

    if (!tier) {
      throw ApiError.badRequest(`Customer tier ID ${data.tier_id} does not exist`);
    }
  }

  const [priceList] = await db
    .insert(priceLists)
    .values({
      name: data.name,
      tierId: data.tier_id || null,
      currency: data.currency || "USD",
    })
    .returning();

  return priceList;
}

export async function addPriceListItem(
  priceListId: number,
  data: {
    product_id: number;
    unit_price: number;
  }
) {
  const [list] = await db
    .select()
    .from(priceLists)
    .where(eq(priceLists.id, priceListId))
    .limit(1);

  if (!list) {
    throw ApiError.notFound(`Price list with ID ${priceListId} not found`);
  }

  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, data.product_id))
    .limit(1);

  if (!product) {
    throw ApiError.notFound(`Product with ID ${data.product_id} not found`);
  }

  const [item] = await db
    .insert(priceListItems)
    .values({
      priceListId,
      productId: data.product_id,
      unitPrice: data.unit_price.toString(),
    })
    .returning();

  return item;
}
