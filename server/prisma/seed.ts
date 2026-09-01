import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";
import bcrypt from "bcrypt";

async function main() {
  const managerPassword = await bcrypt.hash("manager123", 10);
  const waiterPassword = await bcrypt.hash("waiter123", 10);

  await prisma.user.upsert({
    where: { email: "manager@demo.local" },
    update: {},
    create: {
      name: "Demo Manager",
      email: "manager@demo.local",
      passwordHash: managerPassword,
      role: "MANAGER",
    },
  });

  await prisma.user.upsert({
    where: { email: "waiter1@demo.local" },
    update: {},
    create: {
      name: "Demo Waiter 1",
      email: "waiter1@demo.local",
      passwordHash: waiterPassword,
      role: "WAITER",
    },
  });

  await prisma.user.upsert({
    where: { email: "waiter2@demo.local" },
    update: {},
    create: {
      name: "Demo Waiter 2",
      email: "waiter2@demo.local",
      passwordHash: waiterPassword,
      role: "WAITER",
    },
  });

  const menuItems = [
    {
      name: "Butter Chicken",
      price: 320,
    },
    {
      name: "Paneer Tikka",
      price: 280,
    },
    {
      name: "Veg Biryani",
      price: 240,
    },
    {
      name: "Masala Dosa",
      price: 180,
    },
  ];

  for (const item of menuItems) {
    const existing = await prisma.menuItem.findFirst({
      where: {
        name: item.name,
      },
    });

    if (!existing) {
      await prisma.menuItem.create({
        data: {
          name: item.name,
          price: item.price,
          available: true,
        },
      });
    }
  }

  console.log("Database seeded successfully.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });