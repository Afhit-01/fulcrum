import pool, { withTransaction } from "../db/client.js";
import { ConflictError, NotFoundError } from "../errors/AppError.js";
import type { ReturnRequest, ReturnStatus } from "../types.js";

export const createReturnRequestTransaction = async (
  orderId: string,
  productId: string,
  quantity: number,
  reason: string,
): Promise<ReturnRequest> =>
  withTransaction(async (client) => {
    const orderResult = await client.query(
      `SELECT status FROM orders WHERE id = $1 FOR UPDATE;`,
      [orderId],
    );

    if (orderResult.rowCount === 0) {
      throw new NotFoundError("Order not found");
    }

    const orderStatus = orderResult.rows[0].status;
    if (orderStatus !== "delivered") {
      throw new ConflictError(
        `Cannot change order status from ${orderStatus} to return_requested`,
      );
    }

    const insertResult = await client.query(
      `
      INSERT INTO return_requests (order_id, product_id, quantity, reason, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, order_id, product_id, quantity, reason, status, created_at;
      `,
      [orderId, productId, quantity, reason, "pending"],
    );

    await client.query(
      `
      UPDATE orders SET status = $1 WHERE id = $2;
      `,
      ["return_requested", orderId],
    );

    const row = insertResult.rows[0];

    return {
      id: row.id,
      orderId: row.order_id,
      productId: row.product_id,
      quantity: row.quantity,
      reason: row.reason,
      status: row.status as ReturnStatus,
      requestedAt: row.created_at,
    };
  });

export const rejectReturnTransaction = async (
  returnId: string,
): Promise<void> =>
  withTransaction(async (client) => {
    const returnResult = await client.query(
      `SELECT status, order_id FROM return_requests WHERE  id = $1 FOR UPDATE;`,
      [returnId],
    );

    if (returnResult.rowCount === 0) {
      throw new NotFoundError("Return request not found");
    }

    const { status: returnStatus, order_id: orderId } = returnResult.rows[0];

    if (returnStatus !== "pending") {
      throw new ConflictError(`Cannot move from ${returnStatus} to rejected`);
    }

    const orderResult = await client.query(
      `
      SELECT status FROM orders WHERE id = $1 FOR UPDATE
      `,
      [orderId],
    );

    if (orderResult.rowCount === 0) {
      throw new NotFoundError("Return request not found");
    }

    const orderStatus = orderResult.rows[0].status;

    if (orderStatus !== "return_requested") {
      throw new ConflictError(
        `Cannot change order status from ${orderStatus} to delivered`,
      );
    }
    await client.query(
      `
      UPDATE return_requests SET status = $1 WHERE id = $2;
      `,
      ["rejected", returnId],
    );

    await client.query(
      `
      UPDATE orders SET status = $1 WHERE id = $2;
      `,
      ["delivered", orderId],
    );
  });

export const getReturnByIdFromDB = async (
  id: string,
  customerId?: string,
): Promise<ReturnRequest | null> => {
  const client = await pool.connect();

  try {
    let getQuery = `
      SELECT
        return_requests.id,
        return_requests.order_id,
        return_requests.product_id,
        return_requests.quantity,
        return_requests.reason,
        return_requests.status,
        return_requests.created_at
      FROM return_requests
      JOIN orders
        ON return_requests.order_id = orders.id
      WHERE return_requests.id = $1
    `;

    const queryParams: string[] = [id];

    if (customerId) {
      getQuery += `
        AND orders.customer_id = $2
      `;

      queryParams.push(customerId);
    }

    getQuery += ";";

    const result = await client.query(getQuery, queryParams);

    if (result.rowCount === 0) {
      return null;
    }

    const row = result.rows[0];

    return {
      id: row.id,
      orderId: row.order_id,
      productId: row.product_id,
      quantity: row.quantity,
      reason: row.reason,
      status: row.status as ReturnStatus,
      requestedAt: row.created_at,
    };
  } finally {
    client.release();
  }
};

export const updateReturnRequestInDB = async (
  id: string,
  status: ReturnStatus,
): Promise<void> => {
  const client = await pool.connect();

  try {
    const query = `
      UPDATE return_requests
      SET status = $1
      WHERE id = $2;
    `;

    await client.query(query, [status, id]);
  } finally {
    client.release();
  }
};

export const getReturnByOrderAndProductFromDb = async (
  orderId: string,
  productId: string,
  customerId?: string,
): Promise<ReturnRequest | null> => {
  const client = await pool.connect();

  try {
    let query = `
        SELECT
          return_requests.id,
          return_requests.order_id,
          return_requests.product_id,
          return_requests.quantity,
          return_requests.reason,
          return_requests.status,
          return_requests.created_at
        FROM return_requests
        JOIN orders
          ON return_requests.order_id = orders.id
        WHERE
          return_requests.order_id = $1
          AND return_requests.product_id = $2
      `;

    const queryParams: string[] = [orderId, productId];

    if (customerId) {
      query += `
          AND orders.customer_id = $3
        `;

      queryParams.push(customerId);
    }

    query += ";";

    const result = await client.query(query, queryParams);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    return {
      id: row.id,
      orderId: row.order_id,
      productId: row.product_id,
      quantity: row.quantity,
      reason: row.reason,
      status: row.status as ReturnStatus,
      requestedAt: row.created_at,
    };
  } finally {
    client.release();
  }
};

export const getReturnsFromDb = async (
  customerId?: string,
): Promise<ReturnRequest[]> => {
  const client = await pool.connect();

  try {
    let query = `
      SELECT
        return_requests.id,
        return_requests.order_id,
        return_requests.product_id,
        return_requests.quantity,
        return_requests.reason,
        return_requests.status,
        return_requests.created_at
      FROM return_requests
      JOIN orders
        ON return_requests.order_id = orders.id
    `;

    const queryParams: string[] = [];

    if (customerId) {
      query += `WHERE orders.customer_id = $1`;
      queryParams.push(customerId);
    }

    query += ";";

    const result = await client.query(query, queryParams);

    return result.rows.map((row) => ({
      id: row.id,
      orderId: row.order_id,
      productId: row.product_id,
      quantity: row.quantity,
      reason: row.reason,
      status: row.status as ReturnStatus,
      requestedAt: row.created_at,
    }));
  } finally {
    client.release();
  }
};
