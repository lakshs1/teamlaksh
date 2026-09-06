import {
  db,
  users,
  customers,
  customerTiers,
  productCategories,
  products,
  warehouses,
  warehouseStock,
  quotes,
  quoteLines,
} from "@db";
import { eq } from "drizzle-orm";

async function main() {
  console.log("🚀 Seeding Fulfillment Multi-Warehouse Split Demo Scenario...\n");

  // 1. Customer Tier
  let [tier] = await db
    .select()
    .from(customerTiers)
    .where(eq(customerTiers.name, "Enterprise Tier"))
    .limit(1);

  if (!tier) {
    [tier] = await db
      .insert(customerTiers)
      .values({
        name: "Enterprise Tier",
        maxDiscountPct: "20.00",
      })
      .returning();
  }

  // 2. Customer
  let [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.email, "ayushkanyal@gmail.com"))
    .limit(1);

  if (!customer) {
    [customer] = await db
      .insert(customers)
      .values({
        name: "Ayush Kanyal",
        email: "ayushkanyal@gmail.com",
        tierId: tier.id,
      })
      .returning();
  }

  // 3. Category & Product
  let [cat] = await db
    .select()
    .from(productCategories)
    .where(eq(productCategories.name, "Enterprise Hardware"))
    .limit(1);

  if (!cat) {
    [cat] = await db
      .insert(productCategories)
      .values({
        name: "Enterprise Hardware",
        maxDiscountPct: "15.00",
      })
      .returning();
  }

  let [product] = await db
    .select()
    .from(products)
    .where(eq(products.name, "Titan Blade Server X1"))
    .limit(1);

  if (!product) {
    [product] = await db
      .insert(products)
      .values({
        name: "Titan Blade Server X1",
        description: "High-density rackmount computing node for enterprise cluster",
        categoryId: cat.id,
        basePrice: "45000.00",
        costPrice: "30000.00",
        unit: "unit",
        taxPct: "18.00",
        isRecurring: false,
        isActive: true,
      })
      .returning();
  }

  // 4. Warehouses with differentiated Shipping Cost Weights
  // Warehouse A: Mumbai Hub (Weight 1.0 - Preferred, cheaper shipping)
  let [whMumbai] = await db
    .select()
    .from(warehouses)
    .where(eq(warehouses.name, "Mumbai Central Hub"))
    .limit(1);

  if (!whMumbai) {
    [whMumbai] = await db
      .insert(warehouses)
      .values({
        code: "WH-MUM",
        name: "Mumbai Central Hub",
        location: "Mumbai, Maharashtra",
        shippingCostWeight: "1.00",
        isActive: true,
      })
      .returning();
  }

  // Warehouse B: Bangalore Hub (Weight 1.3 - Secondary, higher shipping cost)
  let [whBangalore] = await db
    .select()
    .from(warehouses)
    .where(eq(warehouses.name, "Bangalore Logistics Center"))
    .limit(1);

  if (!whBangalore) {
    [whBangalore] = await db
      .insert(warehouses)
      .values({
        code: "WH-BLR",
        name: "Bangalore Logistics Center",
        location: "Bangalore, Karnataka",
        shippingCostWeight: "1.30",
        isActive: true,
      })
      .returning();
  }

  // 5. Seed stock designed to trigger Multi-Warehouse Split + Backorder!
  // Mumbai has 3 units, Bangalore has 5 units. (Total available = 8 units)
  const setStock = async (whId: number, qty: number) => {
    const [existing] = await db
      .select()
      .from(warehouseStock)
      .where(eq(warehouseStock.warehouseId, whId))
      .limit(1);

    if (existing) {
      await db
        .update(warehouseStock)
        .set({ quantity: qty, quantityOnHand: qty, quantityReserved: 0 })
        .where(eq(warehouseStock.id, existing.id));
    } else {
      await db.insert(warehouseStock).values({
        warehouseId: whId,
        productId: product.id,
        quantity: qty,
        quantityOnHand: qty,
        quantityReserved: 0,
        reorderLevel: 5,
        reorderQuantity: 20,
      });
    }
  };

  await setStock(whMumbai.id, 3);
  await setStock(whBangalore.id, 5);

  console.log(`  ✓ Configured Warehouse Stock:`);
  console.log(`    - ${whMumbai.name} (Weight 1.0): 3 units available`);
  console.log(`    - ${whBangalore.name} (Weight 1.3): 5 units available`);
  console.log(`    - Total physical stock in network: 8 units`);

  // 6. Find a rep user to own the quote
  const [rep] = await db
    .select()
    .from(users)
    .where(eq(users.role, "rep"))
    .limit(1);

  const repId = rep ? rep.id : 1;

  // 7. Create a Quotation demanding 12 units (More than the 8 available -> Triggers Split + Backorder!)
  const quoteNumber = `SO/DEMO/${Math.floor(1000 + Math.random() * 9000)}`;
  const subtotal = 45000 * 12;
  const tax = subtotal * 0.18;
  const grandTotal = subtotal + tax;

  const [demoQuote] = await db
    .insert(quotes)
    .values({
      quoteNumber,
      customerId: customer.id,
      repId: repId,
      status: "fulfillment", // Placed directly into fulfillment state so it appears in /fulfillment
      subtotal: subtotal.toString(),
      totalDiscount: "0.00",
      totalTax: tax.toString(),
      grandTotal: grandTotal.toString(),
      blendedRiskScore: "10.00",
      notes: "Demo order for testing Multi-Warehouse Split, Manual Override, and Backorder Consolidation",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    })
    .returning();

  await db.insert(quoteLines).values({
    quoteId: demoQuote.id,
    productId: product.id,
    quantity: 12,
    unitPrice: "45000.00",
    costPrice: "30000.00",
    discountPct: "0.00",
    discountAmount: "0.00",
    lineTotal: (45000 * 12).toString(),
    isRecurring: false,
  });

  console.log(`\n🎉 DEMO SCENARIO CREATED!`);
  console.log(`═══════════════════════════════════════════════════════════════`);
  console.log(`📦 Order Reference: ${demoQuote.quoteNumber} (Quote ID: ${demoQuote.id})`);
  console.log(`👤 Customer:        ${customer.name} (${customer.email})`);
  console.log(`💻 Product:         ${product.name} (Quantity Demanded: 12 units)`);
  console.log(`⚡ Expected Allocation:`);
  console.log(`   1. Mumbai Central Hub (Weight 1.0):      Fulfills 3 units (exhausts stock)`);
  console.log(`   2. Bangalore Logistics Center (Weight 1.3): Fulfills 5 units (exhausts stock)`);
  console.log(`   3. Backorder Deficit:                    4 units backordered!`);
  console.log(`═══════════════════════════════════════════════════════════════`);
  console.log(`👉 To view this order in the UI:`);
  console.log(`   Open: http://localhost:5173/fulfillment/${demoQuote.id}`);
  console.log(`═══════════════════════════════════════════════════════════════\n`);

  process.exit(0);
}

main().catch((e) => {
  console.error("Error seeding fulfillment scenario:", e);
  process.exit(1);
});
