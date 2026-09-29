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

import type { OrderStatus } from "../types.js";

import {
  isCreateOrderPayload,
  isValidStatus,
  isValidParam,
} from "../validation/validation.js";

import { validateBody } from "../middleware/validateBody.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { checkIdempotency } from "../middleware/idempotency.js";
import { NotFoundError } from "../errors/AppError.js";

const router = Router();

router.use(requireAuth);

router.post(
  "/",
  checkIdempotency,
  validateBody(isCreateOrderPayload),
  async (req: Request, res: Response) => {
    if (!isCreateOrderPayload(req.body)) {
      return res.status(400).json({
        error: "Invalid order payload",
      });
    }

    const { items } = req.body;

    const result = await createOrder(req.user!, items);

    if (!result.success) {
      return res.status(400).json({
        error: result.reason,
      });
    }

    return res.status(201).json(result.order);
  },
);

router.get("/", async (req: Request, res: Response) => {
  const status = req.query.status as OrderStatus | undefined;

  if (!status) {
    return res.status(400).json({
      error: "Status query param is required",
    });
  }

  const orders = await getOrdersByStatus(status, req.user!);

  return res.status(200).json(orders);
});

router.get("/report", async (req: Request, res: Response) => {
  if (req.user!.role !== "staff" && req.user!.role !== "admin") {
    return res.status(403).json({
      error: "You are not authorized to view order reports",
    });
  }

  const report = await getOrderReport();

  return res.status(200).json(report);
});

router.get("/:orderId", async (req: Request, res: Response) => {
  if (!isValidParam(req.params.orderId)) {
    return res.status(400).json({
      error: "orderId must be provided",
    });
  }

  const order = await getOrderById(req.params.orderId, req.user!);

  if (!order) {
    throw new NotFoundError();
  }

  return res.status(200).json(order);
});

router.get("/:orderId/total", async (req: Request, res: Response) => {
  if (!isValidParam(req.params.orderId)) {
    return res.status(400).json({
      error: "orderId must be provided",
    });
  }

  const total = await getOrderTotal(req.params.orderId, req.user!);

  if (total === null) {
    return res.status(404).json({
      error: "Order not found",
    });
  }

  return res.status(200).json({ total });
});

router.patch("/:orderId/status", async (req: Request, res: Response) => {
  if (!isValidParam(req.params.orderId)) {
    return res.status(400).json({
      error: "orderId must be provided",
    });
  }

  if (req.user!.role !== "staff" && req.user!.role !== "admin") {
    return res.status(403).json({
      error: "Customers cannot update order status",
    });
  }

  const newStatus = req.body.status;

  if (!isValidStatus(newStatus)) {
    return res.status(400).json({
      error: "Status is invalid",
    });
  }

  const result = await updateOrderStatus(
    req.params.orderId,
    newStatus,
    req.user!,
  );

  if (!result.success) {
    return res.status(400).json({
      error: result.reason,
    });
  }

  return res.status(200).json({
    message: "Status updated",
  });
});

router.delete("/:orderId", async (req: Request, res: Response) => {
  if (!isValidParam(req.params.orderId)) {
    return res.status(400).json({
      error: "orderId must be provided",
    });
  }

  const result = await cancelOrder(req.params.orderId, req.user!);

  if (!result.success) {
    return res.status(400).json({
      error: result.reason,
    });
  }

  return res.status(200).json({
    message: "Order cancelled",
  });
});

export default router;
