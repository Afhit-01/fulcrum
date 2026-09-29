import express, {
  type Express,
  type Request,
  type Response,
} from "express";
import dotenv from "dotenv";
import helmet from "helmet";
import { authLimiter, apiLimiter } from "./middleware/rateLimiter.js";
import ordersRouter from "./routes/ordersRouter.js";
import returnsRouter from "./routes/returnsRouter.js";
import refundsRouter from "./routes/refundsRouter.js";
import authRouter from "./routes/authRouter.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";

dotenv.config();

const app: Express = express();

app.use(helmet());
app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.status(200).send("Wanna test the order management system? see /orders");
});

app.use("/auth", authLimiter, authRouter);
app.use("/orders", apiLimiter, ordersRouter);
app.use("/return", apiLimiter, returnsRouter);
app.use("/refunds", apiLimiter, refundsRouter);

// app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
//   console.log(err);
//   res.status(500).json({ error: "Something went wrong" });
// });

app.use(notFound);
app.use(errorHandler);

export default app;
