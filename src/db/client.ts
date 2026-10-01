import { env } from "../config/env.js";
import { Pool, type PoolClient } from "pg";

const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 5,
});

export const withTransaction = async <T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("Commit");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("Rollback failed: ", rollbackErr);
    }
    throw error;
  } finally {
    client.release();
  }
};

export default pool;
