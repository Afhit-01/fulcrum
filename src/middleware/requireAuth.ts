import type { Request, Response, NextFunction } from "express";
import {env} from "../config/env.js"
import jwt from "jsonwebtoken";
import type { JwtPayload } from "../types.js";

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */


export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Access token missing",
    });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token missing" });
  }

  try {
    const secret = env.jwtSecret;

    const decoded = jwt.verify(token, secret) as JwtPayload;

    req.user = decoded;

    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};
