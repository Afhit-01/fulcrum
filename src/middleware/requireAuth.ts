import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env.js";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "../types.js";
import { UnauthorizedError } from "../errors/AppError.js";

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

export const requireAuth = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new UnauthorizedError("Access token missing");
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    throw new UnauthorizedError("Access token missing");
  }

  try {
    req.user = jwt.verify(token, env.jwtSecret) as JwtPayload;
  } catch {
    throw new UnauthorizedError("Invalid or expired token");
  }

  next();
};
