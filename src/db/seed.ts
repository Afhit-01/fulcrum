import bcrypt from "bcrypt";
import pool from "./client.js";
import dotenv from "dotenv";

dotenv.config();

const products = [
  { id: "sku-1", name: "Keyboard", unitPrice: 15000 },
  { id: "sku-2", name: "Mouse", unitPrice: 8000 },
  { id: "sku-3", name: "Monitor", unitPrice: 120000 },
  { id: "sku-4", name: "USB-C Cable", unitPrice: 3500 },
  { id: "sku-5", name: "Laptop Stand", unitPrice: 12000 },

  // Internal components
  { id: "sku-6", name: "Intel Core i5 Processor", unitPrice: 185000 },
  { id: "sku-7", name: "AMD Ryzen 5 Processor", unitPrice: 175000 },
  { id: "sku-8", name: "16GB DDR4 RAM", unitPrice: 45000 },
  { id: "sku-9", name: "32GB DDR4 RAM", unitPrice: 85000 },
  { id: "sku-10", name: "16GB DDR5 RAM", unitPrice: 65000 },
  { id: "sku-11", name: "500GB NVMe SSD", unitPrice: 55000 },
  { id: "sku-12", name: "1TB NVMe SSD", unitPrice: 95000 },
  { id: "sku-13", name: "2TB NVMe SSD", unitPrice: 175000 },
  { id: "sku-14", name: "1TB HDD", unitPrice: 55000 },
  { id: "sku-15", name: "2TB HDD", unitPrice: 85000 },
  { id: "sku-16", name: "NVIDIA GeForce RTX 4060", unitPrice: 550000 },
  { id: "sku-17", name: "NVIDIA GeForce RTX 4070", unitPrice: 850000 },
  { id: "sku-18", name: "AMD Radeon RX 7600", unitPrice: 480000 },
  { id: "sku-19", name: "650W Power Supply", unitPrice: 95000 },
  { id: "sku-20", name: "750W Power Supply", unitPrice: 125000 },
  { id: "sku-21", name: "850W Power Supply", unitPrice: 165000 },
  { id: "sku-22", name: "ATX Motherboard", unitPrice: 180000 },
  { id: "sku-23", name: "B650 Motherboard", unitPrice: 250000 },
  { id: "sku-24", name: "CPU Air Cooler", unitPrice: 45000 },
  { id: "sku-25", name: "240mm Liquid CPU Cooler", unitPrice: 95000 },
  { id: "sku-26", name: "120mm Case Fan", unitPrice: 12000 },
  { id: "sku-27", name: "Thermal Paste", unitPrice: 8500 },

  // Peripherals
  { id: "sku-28", name: "Mechanical Keyboard", unitPrice: 35000 },
  { id: "sku-29", name: "Wireless Mouse", unitPrice: 18000 },
  { id: "sku-30", name: "Gaming Mouse", unitPrice: 28000 },
  { id: "sku-31", name: "Gaming Headset", unitPrice: 45000 },
  { id: "sku-32", name: "Webcam", unitPrice: 35000 },
  { id: "sku-33", name: "USB Hub", unitPrice: 15000 },
  { id: "sku-34", name: "External SSD", unitPrice: 85000 },
  { id: "sku-35", name: "External Hard Drive", unitPrice: 75000 },
  { id: "sku-36", name: "DisplayPort Cable", unitPrice: 7000 },
  { id: "sku-37", name: "HDMI Cable", unitPrice: 6000 },
  { id: "sku-38", name: "Ethernet Cable", unitPrice: 4000 },

  // Networking and power
  { id: "sku-39", name: "Wi-Fi Adapter", unitPrice: 12000 },
  { id: "sku-40", name: "Gigabit Ethernet Adapter", unitPrice: 18000 },
  { id: "sku-41", name: "Wireless Router", unitPrice: 55000 },
  { id: "sku-42", name: "8-Port Network Switch", unitPrice: 35000 },
  { id: "sku-43", name: "UPS", unitPrice: 85000 },
  { id: "sku-44", name: "Surge Protector", unitPrice: 18000 },
];

const seedStaff = async () => {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const saltRounds = 12;

  if (!adminPassword) {
    throw new Error("SEED_ADMIN_PASSWORD is not set");
  }

  const hashedPasswd = await bcrypt.hash(adminPassword, saltRounds);

  const queryStatement = `
    INSERT INTO staff (email, password_hash, role)
    VALUES ($1, $2, $3)
    ON CONFLICT (email) DO NOTHING
    RETURNING id, email, role`;
  const result = await pool.query(queryStatement, [
    adminEmail,
    hashedPasswd,
    "admin",
  ]);

  if (result.rowCount === 0) {
    console.log("Admin already exits!");
  } else {
    console.log("Admin account seeded successfully!", result.rows[0]);
  }
};

const seedProducts = async () => {
  for (const product of products) {
    await pool.query(
      `
      INSERT INTO products (id, name, unit_price)
      VALUES ($1, $2, $3)
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name, unit_price = EXCLUDED.unit_price;
      `,
      [product.id, product.name, product.unitPrice],
    );
  }
  console.log(`Seeded ${products.length} products successfully`);
};

const run = async () => {
  try {
    await seedStaff();
    await seedProducts();
    process.exit(0);
  } catch (err) {
    console.log("Seeding failed", err);
    process.exit(1);
  }
};

run();
