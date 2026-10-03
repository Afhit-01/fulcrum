import type { ErrorRequestHandler, Request, Response } from "express";
import { AppError } from "../errors/AppError.js";

export const notFound = (_req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found", code: "NOT_FOUND" });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof AppError) {
    return res
      .status(err.statusCode)
      .json({ error: err.message, code: err.code });
  }
  if (err?.type === "entity.parse.failed") {
    return res
      .status(400)
      .json({ error: "Malformed JSON body", code: "BAD_REQUEST" });
  }
  if (err?.code === "23505") {
    return res
      .status(409)
      .json({ error: "Resource already exists", code: "CONFLICT" });
  }

  if (err?.code === "22P02") {
    return res
      .status(400)
      .json({ error: "Invalid identifier format", code: "BAD_REQUEST" });
  }

  const status = err?.status ?? err?.statusCode;
  if (Number.isInteger(status) && status >= 400 && status < 500) {
    return res.status(status).json({
      error: err.expose ? err.message : "Bad request",
      code: "BAD_REQUEST",
    });
  }

  console.error(`[${req.method} ${req.originalUrl}]`, err);
  return res
    .status(500)
    .json({ error: "Internal server error", code: "INTERNAL_ERROR" });
};
