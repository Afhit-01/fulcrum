import express, { type Express, type Request, type Response } from "express";
import dotenv from "dotenv";
import helmet from "helmet";
import { authLimiter, apiLimiter } from "./middleware/rateLimiter.js";
import ordersRouter from "./routes/ordersRouter.js";
import returnsRouter from "./routes/returnsRouter.js";
import refundsRouter from "./routes/refundsRouter.js";
import authRouter from "./routes/authRouter.js";
import productsRouter from "./routes/productsRouter.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import fs from "node:fs";
import path from "node:path";
import swaggerUi from "swagger-ui-express";
import { parse } from "yaml";
import pool from "./db/client.js";

dotenv.config();

const app: Express = express();

const openApiDocument = parse(
  fs.readFileSync(path.join(process.cwd(), "openapi.yaml"), "utf-8"),
);

app.use(helmet());
app.use(express.json());

app.get("/", (_req: Request, res: Response) => {
  res.status(200).send("Fulcrum API. Interactive documentation: /docs");
});

app.get("/health", async (_req: Request, res: Response) => {
  await pool.query("SELECT 1");
  res.status(200).json({ status: "ok" });
});

app.use("/auth", authLimiter, authRouter);
app.use("/orders", apiLimiter, ordersRouter);
app.use("/return", apiLimiter, returnsRouter);
app.use("/refunds", apiLimiter, refundsRouter);
app.use("/products", apiLimiter, productsRouter);

app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));

app.use(notFound);
app.use(errorHandler);

export default app;
