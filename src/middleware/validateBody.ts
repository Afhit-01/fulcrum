import type { Request, Response, NextFunction } from "express";
import { BadRequestError } from "../errors/AppError.js";

export const validateBody = <T>(guard: (body: unknown) => body is T) => {
  const middleware = (req: Request, _res: Response, next: NextFunction) => {
    if (!guard(req.body)) {
      throw new BadRequestError("Invalid request body");
    }

    next();
  };
  return middleware;
};
