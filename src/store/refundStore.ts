import pool from "../db/client.js";
import type { Refund, RefundStatus } from "../types.js";
import { ConflictError, NotFoundError } from "../errors/AppError.js";

export const insertRefund = async (
  returnRequestId: string,
  orderId: string,
  productId: string,
  amount: number,
): Promise<Refund> => {
  const client = await pool.connect();

  try {
    const query = `
      INSERT INTO refunds (
        return_request_id,
        order_id,
        product_id,
        amount,
        status
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id,
        return_request_id,
        order_id,
        product_id,
        amount,
        status,
        requested_at,
        completed_at;
    `;

    const result = await client.query(query, [
      returnRequestId,
      orderId,
      productId,
      amount,
      "pending",
    ]);

    const row = result.rows[0];

    return {
      id: row.id,
      returnRequestId: row.return_request_id,
      orderId: row.order_id,
      productId: row.product_id,
      amount: Number(row.amount),
      status: row.status as RefundStatus,
      requestedAt: row.requested_at,
      completedAt: row.completed_at,
    };
  } finally {
    client.release();
  }
};

export const getRefundByIdFromDB = async (
  refundID: string,
  customerId?: string,
): Promise<Refund | null> => {
  const client = await pool.connect();

  try {
    let query = `
      SELECT
        refunds.id,
        refunds.return_request_id,
        refunds.order_id,
        refunds.product_id,
        refunds.amount,
        refunds.status,
        refunds.requested_at,
        refunds.completed_at
      FROM refunds
      JOIN orders
        ON refunds.order_id = orders.id
      WHERE refunds.id = $1
    `;

    const queryParams: string[] = [refundID];

    if (customerId) {
      query += ` AND orders.customer_id = $2`;
      queryParams.push(customerId);
    }

    query += ";";

    const result = await client.query(query, queryParams);

    if (result.rowCount === 0) {
      return null;
    }

    const row = result.rows[0];

    return {
      id: row.id,
      returnRequestId: row.return_request_id,
      orderId: row.order_id,
      productId: row.product_id,
      amount: Number(row.amount),
      status: row.status as RefundStatus,
      requestedAt: row.requested_at,
      completedAt: row.completed_at,
    };
  } finally {
    client.release();
  }
};

export const failPendingRefundInDB = async (id: string): Promise<boolean> => {
  const result = await pool.query(
    `UPDATE refunds SET status = 'failed' WHERE id = $1 AND status = 'pending';`,
    [id],
  );
  return result.rowCount === 1;
};

export const completeRefundTransaction = async (
  refundId: string,
  returnRequestId: string,
  orderId: string,
  completedAt: string,
): Promise<void> => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const refundResult = await client.query(
      `
        SELECT status
        FROM refunds
        WHERE id = $1
        FOR UPDATE;
      `,
      [refundId],
    );

    if (refundResult.rowCount === 0) {
      throw new NotFoundError("Refund not found");
    }

    const returnResult = await client.query(
      `
        SELECT status
        FROM return_requests
        WHERE id = $1
        FOR UPDATE;
      `,
      [returnRequestId],
    );

    if (returnResult.rowCount === 0) {
      throw new NotFoundError("Return request not found");
    }

    const orderResult = await client.query(
      `
        SELECT status
        FROM orders
        WHERE id = $1
        FOR UPDATE;
      `,
      [orderId],
    );

    if (orderResult.rowCount === 0) {
      throw new NotFoundError("Order not found");
    }

    const refundStatus = refundResult.rows[0].status;
    const returnStatus = returnResult.rows[0].status;
    const orderStatus = orderResult.rows[0].status;

    //Re-check the state inside the transaction to protect against stale data and concurrent requests even if the service checked the states earlier.

    if (refundStatus !== "pending") {
      throw new ConflictError(
        `Cannot complete a refund already at status ${refundStatus}`,
      );
    }

    if (returnStatus !== "received") {
      throw new ConflictError(
        `Cannot mark a return as refunded from status ${returnStatus}`,
      );
    }

    if (orderStatus !== "return_requested") {
      throw new ConflictError(
        `Cannot mark an order as returned from status ${orderStatus}`,
      );
    }

    await client.query(
      `
        UPDATE return_requests
        SET status = $1
        WHERE id = $2;
      `,
      ["refunded", returnRequestId],
    );

    await client.query(
      `
        UPDATE orders
        SET status = $1
        WHERE id = $2;
      `,
      ["returned", orderId],
    );

    await client.query(
      `
        UPDATE refunds
        SET
          status = $1,
          completed_at = $2
        WHERE id = $3;
      `,
      ["completed", completedAt, refundId],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const getRefundsFromDB = async (
  customerId?: string,
): Promise<Refund[]> => {
  const client = await pool.connect();

  try {
    let query = `
    SELECT refunds.id, refunds.return_request_id,
    refunds.order_id, refunds.product_id,
    refunds.amount, refunds.status,
    refunds.requested_at, refunds.completed_at
    FROM refunds
    JOIN orders
    ON refunds.order_id = orders.id`;

    const queryParams: string[] = [];

    if (customerId) {
      query += ` WHERE orders.customer_id = $1`;
      queryParams.push(customerId);
    }

    query += ";";

    const result = await client.query(query, queryParams);

    return result.rows.map((row) => ({
      id: row.id,
      returnRequestId: row.return_request_id,
      orderId: row.order_id,
      productId: row.product_id,
      amount: Number(row.amount),
      status: row.status as RefundStatus,
      requestedAt: row.requested_at,
      completedAt: row.completed_at,
    }));
  } finally {
    client.release();
  }
};
