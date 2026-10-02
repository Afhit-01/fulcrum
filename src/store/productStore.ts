import pool from "../db/client.js";
import type { Product } from "../types.js";

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

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    unitPrice: Number(row.unit_price),
  }));
};
