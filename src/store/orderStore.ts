import pool from "../db/client.js";

import type { Order, OrderItem, OrderStatus } from "../types.js";

export const insertOrder = async (
  customerId: string,
  customerName: string,
  items: OrderItem[],
): Promise<Order> => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const orderQuery = `
      INSERT INTO orders (customer_id, status)
      VALUES ($1, $2)
      RETURNING id, customer_id, status, created_at;
    `;

    const orderResult = await client.query(orderQuery, [customerId, "pending"]);

    const savedOrder = orderResult.rows[0];

    for (const item of items) {
      const itemQuery = `
        INSERT INTO order_items (
          order_id,
          product_id,
          name,
          quantity,
          unit_price
        )
        VALUES ($1, $2, $3, $4, $5);
      `;

      await client.query(itemQuery, [
        savedOrder.id,
        item.productId,
        item.name,
        item.quantity,
        item.unitPrice,
      ]);
    }

    await client.query("COMMIT");

    return {
      id: savedOrder.id,
      customerName,
      items,
      status: savedOrder.status,
      createdAt: savedOrder.created_at,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const transitionOrderStatusInDb = async (
  id: string,
  fromStatus: OrderStatus,
  toStatus: OrderStatus,
): Promise<boolean> => {
  const result = await pool.query(
    `UPDATE orders SET status = $1 WHERE id = $2 AND status = $3;`,
    [toStatus, id, fromStatus],
  );

  return result.rowCount === 1;
};

export const getOrderByIdFromDb = async (
  id: string,
  customerId?: string,
): Promise<Order | null> => {
  const client = await pool.connect();

  try {
    let orderQuery = `
      SELECT
        orders.id,
        orders.customer_id,
        orders.status,
        orders.created_at,
        customers.email AS customer_email
      FROM orders
      JOIN customers
        ON orders.customer_id = customers.id
      WHERE orders.id = $1
    `;

    const queryParams: string[] = [id];

    if (customerId) {
      orderQuery += `
        AND orders.customer_id = $2
      `;

      queryParams.push(customerId);
    }

    orderQuery += ";";

    const orderResult = await client.query(orderQuery, queryParams);

    if (orderResult.rows.length === 0) {
      return null;
    }

    const row = orderResult.rows[0];

    const itemsQuery = `
      SELECT
        product_id,
        name,
        quantity,
        unit_price
      FROM order_items
      WHERE order_id = $1;
    `;

    const itemsResult = await client.query(itemsQuery, [id]);

    const order: Order = {
      id: row.id,
      customerName: row.customer_email,
      status: row.status,
      createdAt: row.created_at,

      items: itemsResult.rows.map((itemRow) => ({
        productId: itemRow.product_id,
        name: itemRow.name,
        quantity: itemRow.quantity,
        unitPrice: Number(itemRow.unit_price),
      })),
    };

    return order;
  } finally {
    client.release();
  }
};

export const getOrdersByStatusFromDb = async (
  status: OrderStatus,
  customerId?: string,
): Promise<Order[]> => {
  const client = await pool.connect();

  try {
    let orderQuery = `
      SELECT
        orders.id,
        orders.customer_id,
        orders.status,
        orders.created_at,
        customers.email AS customer_email
      FROM orders
      JOIN customers
        ON orders.customer_id = customers.id
      WHERE orders.status = $1
    `;

    const queryParams: string[] = [status];

    if (customerId) {
      orderQuery += `
        AND orders.customer_id = $2
      `;

      queryParams.push(customerId);
    }

    orderQuery += ";";

    const orderResult = await client.query(orderQuery, queryParams);

    const orders: Order[] = [];

    for (const row of orderResult.rows) {
      const itemsQuery = `
        SELECT
          product_id,
          name,
          quantity,
          unit_price
        FROM order_items
        WHERE order_id = $1;
      `;

      const itemsResult = await client.query(itemsQuery, [row.id]);

      orders.push({
        id: row.id,
        customerName: row.customer_email,
        status: row.status,
        createdAt: row.created_at,

        items: itemsResult.rows.map((itemRow) => ({
          productId: itemRow.product_id,
          name: itemRow.name,
          quantity: itemRow.quantity,
          unitPrice: Number(itemRow.unit_price),
        })),
      });
    }

    return orders;
  } finally {
    client.release();
  }
};

export const getOrderReportFromId = async (): Promise<{
  totalOrders: number;
  byStatus: Record<OrderStatus, number>;
  revenue: number;
}> => {
  const client = await pool.connect();

  try {
    const statusCountQuery = `
      SELECT
        status,
        COUNT(*) AS count
      FROM orders
      GROUP BY status;
    `;

    const statusResult = await client.query(statusCountQuery);

    const byStatus: Record<OrderStatus, number> = {
      pending: 0,
      confirmed: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
      return_requested: 0,
      returned: 0,
    };

    let totalOrders = 0;

    for (const row of statusResult.rows) {
      const count = Number(row.count);

      byStatus[row.status as OrderStatus] = count;

      totalOrders += count;
    }

    const revenueQuery = `
      SELECT
        SUM(
          order_items.quantity *
          order_items.unit_price
        ) AS total_revenue
      FROM order_items
      JOIN orders
        ON order_items.order_id = orders.id
      WHERE orders.status IN (
        'confirmed',
        'shipped',
        'delivered'
      );
    `;

    const revenueResult = await client.query(revenueQuery);

    const revenue = Number(revenueResult.rows[0].total_revenue || 0);

    return {
      totalOrders,
      byStatus,
      revenue,
    };
  } finally {
    client.release();
  }
};
