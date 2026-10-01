import { getReturnByIdFromDB } from "../store/returnStore.js";

import {
  getRefundByIdFromDB,
  getRefundsFromDB,
  insertRefund,
  completeRefundTransaction,
  failPendingRefundInDB,
} from "../store/refundStore.js";

import type { Refund, JwtPayload } from "../types.js";

import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  BadRequestError,
} from "../errors/AppError.js";

export const processRefund = async (
  returnId: string,
  amount: number,
  user: JwtPayload,
): Promise<Refund> => {
  if (user.role !== "staff" && user.role !== "admin") {
    throw new ForbiddenError("Only staff or admin can process refunds");
  }

  const returnRequest = await getReturnByIdFromDB(returnId);

  if (!returnRequest) {
    throw new NotFoundError(
      `Return request with id ${returnId} does not exist`,
    );
  }

  if (returnRequest.status !== "received") {
    throw new ConflictError(
      `Cannot process a refund for a return at status ${returnRequest.status}`,
    );
  }

  if (amount <= 0) {
    throw new BadRequestError("Refund amount must be greater than 0");
  }

  return await insertRefund(
    returnRequest.id,
    returnRequest.orderId,
    returnRequest.productId,
    amount,
  );
};

export const completeRefund = async (
  refundId: string,
  outcome: "completed" | "failed",
  user: JwtPayload,
): Promise<void> => {
  if (user.role !== "staff" && user.role !== "admin") {
    throw new ForbiddenError("Only staff or admin can complete refunds");
  }

  const refund = await getRefundByIdFromDB(refundId);

  if (!refund) {
    throw new NotFoundError(
      `Refund request with id ${refundId} does not exist`,
    );
  }

  if (refund.status !== "pending") {
    throw new ConflictError(
      `Cannot complete a refund already at status ${refund.status}`,
    );
  }

  if (outcome === "failed") {
    const updated = await failPendingRefundInDB(refundId)

    if (!updated) {
      throw new ConflictError("Refund is no longer pending")
    }
    return;
  }

  await completeRefundTransaction(
    refundId,
    refund.returnRequestId,
    refund.orderId,
    new Date().toISOString(),
  );
};

export const getRefunds = async (user: JwtPayload): Promise<Refund[]> => {
  const customerIdFilter = user.role === "customer" ? user.id : undefined;
  return await getRefundsFromDB(customerIdFilter);
};

export const getRefundById = async (
  id: string,
  user: JwtPayload,
): Promise<Refund | null> => {
  const customerIdFilter = user.role === "customer" ? user.id : undefined;
  return await getRefundByIdFromDB(id, customerIdFilter);
};
