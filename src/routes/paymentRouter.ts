import { Router, type Request, type Response } from "express";
import { isValidEmail } from "../validation/validation.js";
import { initializeOrderPayment } from "../services/paymentService.js";

const router = Router();

router.post("/initialize", async (req: Request, res: Response) => {
  const { amount, email } = req.body;

  if (typeof amount !== "number") {
    return res.status(400).json({
      error: "Amount must be numeric",
    });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({
      error: "Email is invalid",
    });
  }

  try {
    const result = await initializeOrderPayment(req.body);

    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Payment initialization failed",
    });
  }
});

export default router;
