import { Router, type Request, type Response } from "express";
import { isValidEmail } from "../validation/validation.js";
import {
  loginCustomer,
  loginStaff,
  registerCustomer,
} from "../services/authService.js";
import { BadRequestError } from "../errors/AppError.js";

const router = Router();

const readCredentials = (req: Request) => {
  const { email, password } = req.body ?? {};
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !password ||
    !isValidEmail(email)
  ) {
    throw new BadRequestError("Invalid credentials");
  }
  return { email, password };
};

router.post("/staff/login", async (req: Request, res: Response) => {
  const { email, password } = readCredentials(req);
  const { message, token } = await loginStaff(email, password);
  res.status(200).json({ message, token });
});

router.post("/customer/register", async (req: Request, res: Response) => {
  const { email, password } = readCredentials(req);
  const { message } = await registerCustomer(email, password);
  res.status(200).json({ message });
});

router.post("/customer/login", async (req: Request, res: Response) => {
  const { email, password } = readCredentials(req);
  const { message, token } = await loginCustomer(email, password);
  res.status(200).json({ message, token });
});

export default router;
