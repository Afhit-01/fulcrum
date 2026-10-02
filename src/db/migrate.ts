import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pool from "./client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const runMigration = async () => {
  const direction = process.argv[2];

  const upMigrations = [
    "001_initial_scheme_up.sql",
    "002_add_auth_up.sql",
    "003_add_idempotency_up.sql",
    "004_fix_idempotency_constraint_up.sql",
    "005_allow_refund_retry_after_failure_up.sql",
    "006_add_products_up.sql",
  ];

  const downMigrations = [
    "006_add_products_down.sql",
    "005_allow_refund_retry_after_failure_down.sql",
    "004_fix_idempotency_constraint_down.sql",
    "003_add_idempotency_down.sql",
    "002_add_auth_down.sql",
    "001_initial_scheme_down.sql",
  ];

  let filesToRun: string[] = [];

  if (direction === "up") {
    filesToRun = upMigrations;
  } else if (direction === "down") {
    filesToRun = downMigrations;
  } else {
    console.error("Please specify migration direction: 'up' or 'down'");
    process.exit(1);
  }

  try {
    for (const file of filesToRun) {
      console.log(`Running migration: ${file}...`);
      const filePath = path.join(__dirname, "migrations", file);
      const sqlFile = fs.readFileSync(filePath, "utf-8");

      await pool.query(sqlFile);
      console.log(`Migration ${file} completed!`);
    }

    console.log(`All ${direction} migrations executed successfully.`);
    process.exit(0);
  } catch (error) {
    console.error(`Migration ${direction} failed:`, error);
    process.exit(1);
  }
};

runMigration();
