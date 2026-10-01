import type { Order, OrderItem, OrderStatus, JwtPayload } from "../types.js";

import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../errors/AppError.js";

import {
  getOrderByIdFromDb,
  getOrderReportFromId,
  getOrdersByStatusFromDb,
  insertOrder,
  transitionOrderStatusInDb,
} from "../store/orderStore.js";

export const validTransitions: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],

  confirmed: ["shipped", "cancelled"],

  shipped: ["delivered"],

  delivered: ["return_requested"],

  cancelled: [],

  return_requested: ["returned", "delivered"],

  returned: [],
};

export const createOrder = async (
  user: JwtPayload,
  items: OrderItem[],
): Promise<Order> => {
  if (items.length === 0) {
    throw new BadRequestError("Order cart cannot be empty");
  }

  const hasNegatives = items.some(
    (item) => item.quantity <= 0 || item.unitPrice <= 0,
  );

  if (hasNegatives) {
    throw new BadRequestError("Quantity or UnitPrice must be greater than 0");
  }

  // Only customers can create orders.
  if (user.role !== "customer") {
    throw new ForbiddenError("Only customers can place orders");
  }

  return await insertOrder(user.id, "Customer", items);
};

export const getOrderById = async (
  id: string,
  user: JwtPayload,
): Promise<Order | null> => {
  // Customers can only access their own orders. Staff/admin can access any order.
  const customerIdFilter = user.role === "customer" ? user.id : undefined;

  return await getOrderByIdFromDb(id, customerIdFilter);
};

export const getOrdersByStatus = async (
  status: OrderStatus,
  user: JwtPayload,
): Promise<Order[]> => {
  // Customers only see their own orders. Staff/admin see all orders matching the status.
  const customerIdFilter = user.role === "customer" ? user.id : undefined;

  return await getOrdersByStatusFromDb(status, customerIdFilter);
};

export const updateOrderStatus = async (
  id: string,
  newStatus: OrderStatus,
  user: JwtPayload,
): Promise<void> => {
  // Only staff/admin can manually update order status.
  if (user.role !== "staff" && user.role !== "admin") {
    throw new ForbiddenError("Only staff or admin can update order status");
  }

  const order = await getOrderByIdFromDb(id);

  if (!order) {
    throw new NotFoundError(`Order with id ${id} does not exist`);
  }

  if (!validTransitions[order.status].includes(newStatus)) {
    throw new ConflictError(
      `Cannot change status from ${order.status} to ${newStatus}`,
    );
  }

  const updated = await transitionOrderStatusInDb(id, order.status, newStatus);

  if (!updated) {
    throw new ConflictError(
      "Order was changed by another request. Reload and try again",
    );
  }
};

export const getOrderTotal = async (
  id: string,
  user: JwtPayload,
): Promise<number | null> => {
  const customerIdFilter = user.role === "customer" ? user.id : undefined;

  const order = await getOrderByIdFromDb(id, customerIdFilter);

  if (!order) {
    return null;
  }

  return order.items.reduce(
    (total, item) => total + item.quantity * item.unitPrice,
    0,
  );
};

export const cancelOrder = async (
  id: string,
  user: JwtPayload,
): Promise<void> => {
  // Customers can only cancel their own orders. Staff/admin can cancel any eligible order.
  const customerIdFilter = user.role === "customer" ? user.id : undefined;

  const order = await getOrderByIdFromDb(id, customerIdFilter);

  if (!order) {
    throw new NotFoundError("Order not found");
  }

  if (order.status !== "pending" && order.status !== "confirmed") {
    throw new ConflictError("Can't cancel at this stage");
  }

  const updated = await transitionOrderStatusInDb(
    id,
    order.status,
    "cancelled",
  );

  if (!updated) {
    throw new ConflictError(
      "Order was changed by another request. Reload and try again",
    );
  }
};

export const getOrderReport = async () => {
  return await getOrderReportFromId();
};
