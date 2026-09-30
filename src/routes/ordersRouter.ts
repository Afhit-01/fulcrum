import { Router, type Request, type Response } from "express";

import {
  createOrder,
  cancelOrder,
  getOrderReport,
  getOrdersByStatus,
  getOrderTotal,
  updateOrderStatus,
  getOrderById,
} from "../services/orderService.js";

import {
  isCreateOrderPayload,
  isValidStatus,
  isValidParam,
} from "../validation/validation.js";

import { validateBody } from "../middleware/validateBody.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { checkIdempotency } from "../middleware/idempotency.js";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "../errors/AppError.js";

const router = Router();

router.use(requireAuth);

router.post(
  "/",
  checkIdempotency,
  validateBody(isCreateOrderPayload),
  async (req: Request, res: Response) => {
    if (!isCreateOrderPayload(req.body)) {
      throw new BadRequestError("Invalid order payload");
    }

    const { items } = req.body;

    const order = await createOrder(req.user!, items);

    return res.status(201).json(order);
  },
);

router.get("/", async (req: Request, res: Response) => {
  const status = req.query.status;

  if (!status) {
    throw new BadRequestError("Status query param is required");
  }

  if (!isValidStatus(status)) {
    throw new BadRequestError("Status is invalid");
  }

  const orders = await getOrdersByStatus(status, req.user!);

  return res.status(200).json(orders);
});

router.get("/report", async (req: Request, res: Response) => {
  if (req.user!.role !== "staff" && req.user!.role !== "admin") {
    throw new ForbiddenError("You are not authorized to view order reports");
  }

  const report = await getOrderReport();

  return res.status(200).json(report);
});

router.get("/:orderId", async (req: Request, res: Response) => {
  if (!isValidParam(req.params.orderId)) {
    throw new BadRequestError("orderId must be provided");
  }

  const order = await getOrderById(req.params.orderId, req.user!);

  if (!order) {
    throw new NotFoundError();
  }

  return res.status(200).json(order);
});

router.get("/:orderId/total", async (req: Request, res: Response) => {
  if (!isValidParam(req.params.orderId)) {
    throw new BadRequestError("orderId must be provided");
  }

  const total = await getOrderTotal(req.params.orderId, req.user!);

  if (total === null) {
    throw new NotFoundError("Order not found");
  }

  return res.status(200).json({ total });
});

router.patch("/:orderId/status", async (req: Request, res: Response) => {
  if (!isValidParam(req.params.orderId)) {
    throw new BadRequestError("orderId must be provided");
  }

  if (req.user!.role !== "staff" && req.user!.role !== "admin") {
    throw new ForbiddenError("Customers cannot update order status");
  }

  const newStatus = req.body?.status;

  if (!isValidStatus(newStatus)) {
    throw new BadRequestError("Status is invalid");
  }

  await updateOrderStatus(req.params.orderId, newStatus, req.user!);
  return res.status(200).json({
    message: "Status updated",
  });
});

router.delete("/:orderId", async (req: Request, res: Response) => {
  if (!isValidParam(req.params.orderId)) {
    throw new BadRequestError("orderId must be provided");
  }
  await cancelOrder(req.params.orderId, req.user!);

  return res.status(200).json({
    message: "Order cancelled",
  });
});

export default router;
