import type { ErrorRequestHandler } from "express";
import type { Request, Response } from "express";
import { AppError } from "../errors/AppError.js";

export const notFound = (req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
};
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    return res
      .status(err.statusCode)
      .json({ error: err.message, code: err.code });
  }
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Malformed JSON body" });
  }
  if (err?.code === "23505") {
    return res.status(409).json({ error: "Resource already exists" });
  }

  return res.status(500).json({ error: "Internal server error" });
};
