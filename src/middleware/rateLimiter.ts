import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

const authMax = env.authRateLimitMax;
const apiMax = env.apiRateLimitMax;

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: authMax,
  message: {
    error:
      "Too many authentication attempts. Please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: apiMax,
  message: { error: "Too many requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// TO-DO: switch to rate-limit-redis
