import { getOrderById } from "./orderService.js";

import {
  getReturnByIdFromDB,
  updateReturnRequestInDB,
  getReturnsFromDb,
  createReturnRequestTransaction,
  rejectReturnTransaction,
} from "../store/returnStore.js";

import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../errors/AppError.js";

import type { ReturnStatus, JwtPayload, ReturnRequest } from "../types.js";

export const validReturnTransitions: Record<ReturnStatus, ReturnStatus[]> = {
  pending: ["approved", "rejected"],
  approved: ["in_transit"],
  rejected: [],
  in_transit: ["received"],
  received: ["refunded"],
  refunded: [],
};

const requireStaff = (user: JwtPayload, message: string): void => {
  if (user.role !== "staff" && user.role !== "admin") {
    throw new ForbiddenError(message);
  }
};

// Staff/admin can access return requests across customers.
const loadReturn = async (returnId: string): Promise<ReturnRequest> => {
  const returnRequest = await getReturnByIdFromDB(returnId);

  if (!returnRequest) {
    throw new NotFoundError(
      `Return request with id ${returnId} does not exist`,
    );
  }

  return returnRequest;
};

const assertReturnTransition = (from: ReturnStatus, to: ReturnStatus): void => {
  if (!validReturnTransitions[from].includes(to)) {
    throw new ConflictError(`Cannot move from ${from} to ${to}`);
  }
};

export const getReturns = async (
  user: JwtPayload,
): Promise<ReturnRequest[]> => {
  const customerIdFilter = user.role === "customer" ? user.id : undefined;
  return await getReturnsFromDb(customerIdFilter);
};

export const getReturnById = async (
  id: string,
  user: JwtPayload,
): Promise<ReturnRequest | null> => {
  const customerIdFilter = user.role === "customer" ? user.id : undefined;
  return await getReturnByIdFromDB(id, customerIdFilter);
};

export const returnOrder = async (
  user: JwtPayload,
  orderId: string,
  productId: string,
  quantity: number,
  reason: string,
): Promise<{ message: string }> => {
  // Only customers can request returns.
  if (user.role !== "customer") {
    throw new ForbiddenError("Only customers can request returns");
  }

  const order = await getOrderById(orderId, user);

  if (!order) {
    throw new NotFoundError(`Order with id ${orderId} was not found`);
  }

  if (order.status !== "delivered") {
    throw new ConflictError(
      "Can't return this item yet. You can request a return after it has been delivered.",
    );
  }

  if (quantity <= 0) {
    throw new BadRequestError("Quantity must be greater than 0");
  }

  const item = order.items.find((item) => item.productId === productId);

  if (!item) {
    throw new NotFoundError(
      `Item with id ${productId} does not exist in order ${orderId}`,
    );
  }

  if (quantity > item.quantity) {
    throw new BadRequestError(
      "Return quantity cannot exceed the quantity ordered",
    );
  }

  const millisecondsPerDay = 1000 * 24 * 60 * 60;

  const daysSinceCreated = Math.floor(
    (Date.now() - new Date(order.createdAt).getTime()) / millisecondsPerDay,
  );

  if (daysSinceCreated > 30) {
    throw new ConflictError(
      "Return period has expired. You can only return items within 30 days of delivery.",
    );
  }

  // Ownership was already established by getOrderById(orderId, user).

  await createReturnRequestTransaction(orderId, productId, quantity, reason);

  return {
    message: "Your return request has been received and is under review",
  };
};

export const reviewReturn = async (
  returnId: string,
  decision: "approved" | "rejected",
  user: JwtPayload,
): Promise<void> => {
  requireStaff(user, "Only staff or admin can review return requests");

  const returnRequest = await loadReturn(returnId);
  assertReturnTransition(returnRequest.status, decision);

  if (decision === "rejected") {
    await rejectReturnTransaction(returnId);
    return;
  }

  await updateReturnRequestInDB(returnId, decision);
};

export const markReturnInTransit = async (
  returnId: string,
  user: JwtPayload,
): Promise<void> => {
  requireStaff(user, "Only staff or admin can mark returns as in transit");

  const returnRequest = await loadReturn(returnId);
  assertReturnTransition(returnRequest.status, "in_transit");

  await updateReturnRequestInDB(returnId, "in_transit");
};

export const receiveReturn = async (
  returnId: string,
  user: JwtPayload,
): Promise<void> => {
  requireStaff(user, "Only staff or admin can receive returns");

  const returnRequest = await loadReturn(returnId);
  assertReturnTransition(returnRequest.status, "received");

  await updateReturnRequestInDB(returnId, "received");
};

export const markReturnRefunded = async (
  returnId: string,
  user: JwtPayload,
): Promise<void> => {
  requireStaff(user, "Only staff or admin can mark returns as refunded");

  const returnRequest = await loadReturn(returnId);
  assertReturnTransition(returnRequest.status, "refunded");

  await updateReturnRequestInDB(returnId, "refunded");
};
