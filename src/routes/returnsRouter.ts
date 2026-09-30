import { Router, type Request, type Response } from "express";

import {
  getReturnById,
  getReturns,
  markReturnInTransit,
  receiveReturn,
  returnOrder,
  reviewReturn,
} from "../services/returnService.js";

import { isValidParam, isNumericString } from "../validation/validation.js";

import { getReturnByOrderAndProductFromDb } from "../store/returnStore.js";

import { processRefund } from "../services/refundService.js";

import { requireAuth } from "../middleware/requireAuth.js";
import { checkIdempotency } from "../middleware/idempotency.js";
import { BadRequestError, NotFoundError } from "../errors/AppError.js";

const router = Router();

router.use(requireAuth);

const readOrderAndProduct = (req: Request) => {
  const { orderId, productId } = req.params;

  if (!isValidParam(orderId)) {
    throw new BadRequestError("orderId must be provided");
  }

  if (!isValidParam(productId)) {
    throw new BadRequestError("productId must be provided");
  }

  return { orderId, productId };
};

const findReturnItem = async (
  orderId: string,
  productId: string,
  req: Request,
) => {
  const customerIdFilter =
    req.user!.role === "customer" ? req.user!.id : undefined;

  const item = await getReturnByOrderAndProductFromDb(
    orderId,
    productId,
    customerIdFilter,
  );

  if (!item) {
    throw new NotFoundError(
      "Request with the provided IDs cannot be found. Kindly check if there was a mismatch.",
    );
  }

  return { item, customerIdFilter };
};

router.get("/", async (req: Request, res: Response) => {
  const returns = await getReturns(req.user!);
  return res.status(200).json(returns);
});

router.get("/:returnId", async (req: Request, res: Response) => {
  const { returnId } = req.params;

  if (!isValidParam(returnId)) {
    throw new BadRequestError("returnId must be provided");
  }

  const returnRequest = await getReturnById(returnId, req.user!);

  if (!returnRequest) {
    throw new NotFoundError("Return request not found");
  }

  return res.status(200).json(returnRequest);
});

router.patch(
  "/:orderId/:productId/review",
  async (req: Request, res: Response) => {
    const { orderId, productId } = readOrderAndProduct(req);
    const review = req.body?.review;

    if (!review) {
      throw new BadRequestError("Kindly provide a review decision");
    }

    if (Array.isArray(review)) {
      throw new BadRequestError("review must be a string");
    }

    if (review !== "approved" && review !== "rejected") {
      throw new BadRequestError(
        "review must be either 'approved' or 'rejected'",
      );
    }

    const { item, customerIdFilter } = await findReturnItem(
      orderId,
      productId,
      req,
    );

    await reviewReturn(item.id, review, req.user!);

    const updatedItem = await getReturnByOrderAndProductFromDb(
      orderId,
      productId,
      customerIdFilter,
    );

    return res.status(200).json({
      message: `Return request ${review} successfully`,
      returnRequest: updatedItem,
    });
  },
);

router.patch(
  "/:orderId/:productId/ship",
  async (req: Request, res: Response) => {
    const { orderId, productId } = readOrderAndProduct(req);

    const { item, customerIdFilter } = await findReturnItem(
      orderId,
      productId,
      req,
    );

    await markReturnInTransit(item.id, req.user!);

    const updatedItem = await getReturnByOrderAndProductFromDb(
      orderId,
      productId,
      customerIdFilter,
    );

    return res.status(200).json({
      message: "Return marked as in transit successfully",
      returnRequest: updatedItem,
    });
  },
);

router.patch(
  "/:orderId/:productId/receive",
  async (req: Request, res: Response) => {
    const { orderId, productId } = readOrderAndProduct(req);

    const { item, customerIdFilter } = await findReturnItem(
      orderId,
      productId,
      req,
    );

    await receiveReturn(item.id, req.user!);

    const updatedItem = await getReturnByOrderAndProductFromDb(
      orderId,
      productId,
      customerIdFilter,
    );

    return res.status(200).json({
      message: "Return received successfully",
      returnRequest: updatedItem,
    });
  },
);

router.patch(
  "/:orderId/:productId/:quantity",
  async (req: Request, res: Response) => {
    const { orderId, productId } = readOrderAndProduct(req);
    const { quantity } = req.params;

    if (!isNumericString(quantity)) {
      throw new BadRequestError("quantity must be numeric");
    }

    const reason = req.body?.reason;

    if (!reason) {
      throw new BadRequestError("Kindly provide a reason for return");
    }

    if (typeof reason !== "string") {
      throw new BadRequestError("reason must be a string");
    }

    const result = await returnOrder(
      req.user!,
      orderId,
      productId,
      Number(quantity),
      reason,
    );

    return res.status(200).json({ message: result.message });
  },
);

router.post(
  "/:orderId/:productId/refund",
  checkIdempotency,
  async (req: Request, res: Response) => {
    const { orderId, productId } = readOrderAndProduct(req);
    const refundAmount = req.body?.refundAmount;

    if (typeof refundAmount !== "number") {
      throw new BadRequestError("refundAmount must be a number");
    }

    const { item } = await findReturnItem(orderId, productId, req);

    const refund = await processRefund(item.id, refundAmount, req.user!);

    return res.status(200).json({
      message: "Refund request created successfully",
      refund,
    });
  },
);

export default router;
