import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";
import { TooManyRequestsError } from "../errors/AppError.js";

const buildLimiter = (max: number, message: string) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new TooManyRequestsError(message)),
  });

export const authLimiter = buildLimiter(
  env.authRateLimitMax,
  "Too many authentication attempts. Please try again after 15 minutes.",
);

export const apiLimiter = buildLimiter(
  env.apiRateLimitMax,
  "Too many requests. Please try again later.",
);

// TO-DO: switch to rate-limit-redis
