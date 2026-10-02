import { Router, type Request, type Response } from "express";
import { getActiveProducts } from "../store/productStore.js";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  const products = await getActiveProducts();

  return res.status(200).json(products);
});

export default router;
