import { Router, type Request, type Response } from "express";
import { isValidEmail } from "../validation/validation.js";
import {
  loginCustomer,
  loginStaff,
  registerCustomer,
} from "../services/authService.js";
import { BadRequestError } from "../errors/AppError.js";

const router = Router();

router.post("/staff/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!isValidEmail(email)) {
    throw new BadRequestError("Invalid credentials");
  }

  if (!password) {
    throw new BadRequestError("Invalid credentials");
  }

  const result = await loginStaff(email, password);

  if (!result.success) {
    throw new BadRequestError(result.reason);
  }

  res.status(200).json({
    message: result.message,
    token: result.token,
  });
});

router.post("/customer/register", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!isValidEmail(email)) {
    throw new BadRequestError("Invalid credentials");
  }

  if (!password) {
    throw new BadRequestError("Invalid credentials");
  }

  const result = await registerCustomer(email, password);

  if (!result.success) {
    throw new BadRequestError(result.reason);
  }

  res.status(200).json({
    message: result.message,
  });
});

router.post("/customer/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!isValidEmail(email)) {
    throw new BadRequestError("Invalid credentials");
  }

  if (!password) {
    throw new BadRequestError("Invalid credentials");
  }

  const result = await loginCustomer(email, password);

  if (!result.success) {
    throw new BadRequestError(result.reason);
  }

  res.status(200).json({
    message: result.message,
    token: result.token,
  });
});

export default router;
