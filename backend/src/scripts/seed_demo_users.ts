import { db, users, customers, customerTiers } from "@db";
import { hashPassword } from "../lib/password.js";
import { eq } from "drizzle-orm";

async function seedDemoUsers() {
  console.log("🌱 Seeding Demo Users for Sales Manager and Customer...");

  try {
    const hashedPassword = await hashPassword("password123");

    // 1. Ensure Customer Tier exists
    let [tier] = await db.select().from(customerTiers).where(eq(customerTiers.name, "Gold Tier")).limit(1);
    if (!tier) {
      [tier] = await db.insert(customerTiers).values({
        name: "Gold Tier",
        maxDiscountPct: "20.00"
      }).returning();
      console.log("  ✓ Created Gold Tier");
    }

    // 2. Ensure Sales Manager User exists
    const managerEmail = "manager@dealflow360.dev";
    const [existingManager] = await db.select().from(users).where(eq(users.email, managerEmail)).limit(1);
    if (!existingManager) {
      const [newManager] = await db.insert(users).values({
        name: "Alex Rivera (Sales Manager)",
        email: managerEmail,
        password: hashedPassword,
        role: "manager",
        isActive: true
      }).returning();
      console.log(`  ✓ Created Sales Manager: ${newManager.email} (password: password123)`);
    } else {
      await db.update(users).set({ password: hashedPassword, role: "manager" }).where(eq(users.id, existingManager.id));
      console.log(`  ✓ Updated Sales Manager: ${existingManager.email} (password: password123)`);
    }

    // 3. Ensure Customer exists in customers table
    const customerEmail = "customer@acme-corp.com";
    const [existingCustomer] = await db.select().from(customers).where(eq(customers.email, customerEmail)).limit(1);
    if (!existingCustomer) {
      const [newCust] = await db.insert(customers).values({
        name: "Acme Corp Procurement",
        email: customerEmail,
        tierId: tier.id
      }).returning();
      console.log(`  ✓ Created Customer record: ${newCust.name} (${newCust.email})`);
    } else {
      console.log(`  ✓ Customer record exists: ${existingCustomer.name} (${existingCustomer.email})`);
    }

    // 4. Ensure Customer User exists in users table for direct portal login
    const [existingCustUser] = await db.select().from(users).where(eq(users.email, customerEmail)).limit(1);
    if (!existingCustUser) {
      const [newCustUser] = await db.insert(users).values({
        name: "Acme Corp Customer",
        email: customerEmail,
        password: hashedPassword,
        role: "rep", // portal user
        isActive: true
      }).returning();
      console.log(`  ✓ Created Customer User account: ${newCustUser.email} (password: password123)`);
    } else {
      await db.update(users).set({ password: hashedPassword }).where(eq(users.id, existingCustUser.id));
      console.log(`  ✓ Updated Customer User account: ${existingCustUser.email} (password: password123)`);
    }

    console.log("\n✅ Demo Users Ready:");
    console.log("---------------------------------------------");
    console.log("👔 Sales Manager:");
    console.log("   Email:    manager@dealflow360.dev");
    console.log("   Password: password123");
    console.log("   Role:     Sales Manager");
    console.log("---------------------------------------------");
    console.log("🛒 Customer:");
    console.log("   Email:    customer@acme-corp.com");
    console.log("   Password: password123");
    console.log("   Company:  Acme Corp Procurement");
    console.log("---------------------------------------------");
  } catch (err: any) {
    console.error("❌ Seed failed:", err.message);
  } finally {
    process.exit(0);
  }
}

seedDemoUsers();
