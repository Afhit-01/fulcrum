import pool from "../../src/db/client.js";

export const resetDb = async (): Promise<void> => {
  await pool.query(`
    TRUNCATE TABLE
      idempotency_keys,
      refunds,
      return_requests,
      order_items,
      orders,
      products,
      customers,
      staff
    CASCADE;
  `);

  await pool.query(
    `INSERT INTO products (id, name, unit_price) VALUES
    ('sku-1', 'Keyboard', 15000),
    ('sku-2', 'Mouse', 8000);`,
  );
};
