import pool from "../db/client.js";
import type { Product } from "../types.js";

const toProduct = (row: {
  id: string;
  name: string;
  unit_price: string;
}): Product => ({
  id: row.id,
  name: row.name,
  unitPrice: Number(row.unit_price),
});

export const getActiveProducts = async (): Promise<Product[]> => {
  const result = await pool.query(
    `SELECT id, name, unit_price
        FROM products
        WHERE active=TRUE
        ORDER BY name`,
  );

  return result.rows.map(toProduct);
};

export const getActiveProductsByIds = async (
  ids: string[],
): Promise<Product[]> => {
  const result = await pool.query(
    `
        SELECT id, name, unit_price
        FROM products WHERE id = ANY($1::varchar[])
        AND active = TRUE;
        `,
    [ids],
  );

  return result.rows.map(toProduct);
};
