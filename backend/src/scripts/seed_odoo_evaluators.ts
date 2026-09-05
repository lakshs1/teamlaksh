import {
  db,
  users,
  customers,
  customerTiers,
  productCategories,
  products,
  warehouses,
  warehouseStock,
} from "@db";
import { hashPassword } from "../lib/password.js";
import { eq } from "drizzle-orm";

async function seedOdooEvaluatorsScenario() {
  console.log("🌱 Seeding Odoo Evaluators Real Workflow Scenario...\n");

  try {
    const hashedPassword = await hashPassword("password123");

    // ── 1. Customer Tier: Gold Tier (15% max standard policy discount) ──
    let [tier] = await db
      .select()
      .from(customerTiers)
      .where(eq(customerTiers.name, "Gold Tier"))
      .limit(1);

    if (!tier) {
      [tier] = await db
        .insert(customerTiers)
        .values({
          name: "Gold Tier",
          maxDiscountPct: "15.00",
        })
        .returning();
      console.log(`  ✓ Created Customer Tier: ${tier.name} (Max Discount: 15%)`);
    } else {
      console.log(`  ✓ Using Customer Tier: ${tier.name} (id: ${tier.id})`);
    }

    // ── 2. Users: Mawiya (Admin), Lakshya (Manager), Ayush (Rep) ──
    const userConfigs = [
      {
        name: "Mawiya (Admin)",
        email: "mawiya@dealflow360.dev",
        role: "admin",
      },
      {
        name: "Lakshya (Sales Manager)",
        email: "lakshya@dealflow360.dev",
        role: "manager",
      },
      {
        name: "Ayush (Sales Rep)",
        email: "ayush@dealflow360.dev",
        role: "rep",
      },
      {
        name: "odoo-evaluators",
        email: "evaluators@odoo.com",
        role: "rep", // portal user
      },
    ];

    for (const u of userConfigs) {
      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.email, u.email))
        .limit(1);

      if (!existing) {
        await db.insert(users).values({
          name: u.name,
          email: u.email,
          password: hashedPassword,
          role: u.role as any,
          isActive: true,
        });
        console.log(`  ✓ Created User [${u.role.toUpperCase()}]: ${u.name} <${u.email}>`);
      } else {
        await db
          .update(users)
          .set({
            name: u.name,
            role: u.role as any,
            password: hashedPassword,
            isActive: true,
          })
          .where(eq(users.id, existing.id));
        console.log(`  ✓ Updated User [${u.role.toUpperCase()}]: ${u.name} <${u.email}>`);
      }
    }

    // ── 3. Customer Record: odoo-evaluators ──
    const customerEmail = "evaluators@odoo.com";
    const [existingCust] = await db
      .select()
      .from(customers)
      .where(eq(customers.email, customerEmail))
      .limit(1);

    let customerId: number;
    if (!existingCust) {
      const [newCust] = await db
        .insert(customers)
        .values({
          name: "odoo-evaluators",
          email: customerEmail,
          tierId: tier.id,
        })
        .returning();
      customerId = newCust.id;
      console.log(`  ✓ Created Customer: ${newCust.name} (Tier: Gold Tier, Email: ${newCust.email})`);
    } else {
      await db
        .update(customers)
        .set({
          name: "odoo-evaluators",
          tierId: tier.id,
        })
        .where(eq(customers.id, existingCust.id));
      customerId = existingCust.id;
      console.log(`  ✓ Updated Customer: ${existingCust.name} (id: ${existingCust.id})`);
    }

    // ── 4. Product Category: Enterprise Software ──
    let [category] = await db
      .select()
      .from(productCategories)
      .where(eq(productCategories.name, "Enterprise Software"))
      .limit(1);

    if (!category) {
      [category] = await db
        .insert(productCategories)
        .values({
          name: "Enterprise Software",
          maxDiscountPct: "15.00",
        })
        .returning();
      console.log(`  ✓ Created Category: Enterprise Software`);
    }

    // ── 5. Product: DealFlow360 ERP Software @ 1 Lakh (₹100,000) ──
    const productName = "DealFlow360 ERP Software";
    let [product] = await db
      .select()
      .from(products)
      .where(eq(products.name, productName))
      .limit(1);

    if (!product) {
      [product] = await db
        .insert(products)
        .values({
          name: productName,
          description: "Full-suite Next-Gen ERP Software License for Odoo Enterprise Deployment",
          categoryId: category.id,
          basePrice: "100000.00", // 1 Lakh
          costPrice: "60000.00",  // 60,000 cost -> 40% gross margin
          unit: "license",
          taxPct: "18.00",        // 18% GST
          isRecurring: false,
          isActive: true,
        })
        .returning();
      console.log(`  ✓ Created Product: ${product.name} @ ₹1,00,000 (Base Price)`);
    } else {
      await db
        .update(products)
        .set({
          basePrice: "100000.00",
          costPrice: "60000.00",
          categoryId: category.id,
          isActive: true,
        })
        .where(eq(products.id, product.id));
      console.log(`  ✓ Updated Product: ${product.name} (id: ${product.id}) @ ₹1,00,000`);
    }

    // ── 6. Multi-Warehouse Setup for Fulfillment Split ──
    const whList = [
      { code: "WH-MUMBAI", name: "Mumbai Central Hub", location: "Mumbai, Maharashtra", costWeight: "1.0" },
      { code: "WH-BANGALORE", name: "Bangalore Tech Hub", location: "Bangalore, Karnataka", costWeight: "1.2" },
    ];

    for (const wh of whList) {
      let [existingWh] = await db
        .select()
        .from(warehouses)
        .where(eq(warehouses.name, wh.name))
        .limit(1);

      if (!existingWh) {
        [existingWh] = await db
          .insert(warehouses)
          .values({
            code: wh.code,
            name: wh.name,
            location: wh.location,
            shippingCostWeight: wh.costWeight,
            isActive: true,
          })
          .returning();
        console.log(`  ✓ Created Warehouse: ${existingWh.name}`);
      }

      // Add stock for ERP software licenses / installation packs
      const [existingStock] = await db
        .select()
        .from(warehouseStock)
        .where(eq(warehouseStock.warehouseId, existingWh.id))
        .limit(1);

      if (!existingStock) {
        await db.insert(warehouseStock).values({
          warehouseId: existingWh.id,
          productId: product.id,
          quantity: 50,
          quantityOnHand: 50,
          quantityReserved: 0,
        });
        console.log(`    ↳ Added 50 stock units in ${existingWh.name}`);
      }
    }

    console.log("\n🎉 Setup completed successfully!");
    console.log("══════════════════════════════════════════════════════");
    console.log("👤 CREDENTIALS SUMMARY (Password for all: password123)");
    console.log("══════════════════════════════════════════════════════");
    console.log("1. Mawiya (Admin):          mawiya@dealflow360.dev");
    console.log("2. Lakshya (Sales Manager): lakshya@dealflow360.dev");
    console.log("3. Ayush (Sales Rep):       ayush@dealflow360.dev");
    console.log("4. Customer:                evaluators@odoo.com (odoo-evaluators)");
    console.log("══════════════════════════════════════════════════════");
    console.log("📦 PRODUCT:");
    console.log(`   Name:  ${product.name}`);
    console.log(`   Price: ₹1,00,000 (1 Lakh)`);
    console.log("══════════════════════════════════════════════════════");
  } catch (err: any) {
    console.error("❌ Seeding failed:", err.message);
  } finally {
    process.exit(0);
  }
}

seedOdooEvaluatorsScenario();
