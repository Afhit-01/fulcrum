import { Router, type Request, type Response } from "express";
import {
  completeRefund,
  getRefundById,
  getRefunds,
} from "../services/refundService.js";
import { getRefundByIdFromDB } from "../store/refundStore.js";
import { isValidParam } from "../validation/validation.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { checkIdempotency } from "../middleware/idempotency.js";
import { BadRequestError, NotFoundError } from "../errors/AppError.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req: Request, res: Response) => {
  const refunds = await getRefunds(req.user!);
  return res.status(200).json(refunds);
});

router.get("/:refundId", async (req: Request, res: Response) => {
  const { refundId } = req.params;

  if (!isValidParam(refundId)) {
    throw new BadRequestError("refundId must be provided");
  }

  const refund = await getRefundById(refundId, req.user!);

  if (!refund) {
    throw new NotFoundError("Refund not found");
  }

  return res.status(200).json(refund);
});

router.patch(
  "/:refundId/complete",
  checkIdempotency,
  async (req: Request, res: Response) => {
    const { refundId } = req.params;
    const outcome = req.body?.outcome;

    if (!isValidParam(refundId)) {
      throw new BadRequestError("refundId must be provided");
    }

    if (typeof outcome !== "string") {
      throw new BadRequestError("outcome must be a string");
    }

    if (outcome !== "completed" && outcome !== "failed") {
      throw new BadRequestError(
        "outcome must be either 'completed' or 'failed'",
      );
    }

    await completeRefund(refundId, outcome, req.user!);

    const refund = await getRefundByIdFromDB(refundId);

    return res.status(200).json({
      message:
        outcome === "completed"
          ? "Refund completed successfully"
          : "Refund marked as failed",
      refund,
    });
  },
);

export default router;