import type { Request, Response, NextFunction } from "express";
import pool from "../db/client.js";
import { BadRequestError, ConflictError } from "../errors/AppError.js";

const MAX_KEY_LENGTH = 255;

export const checkIdempotency = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const idempotencyKey = req.headers["idempotency-key"];

  if (typeof idempotencyKey !== "string" || idempotencyKey.length === 0) {
    throw new BadRequestError("Idempotency key is required");
  }
  if (idempotencyKey.length > MAX_KEY_LENGTH) {
    throw new BadRequestError(
      `Idempotency key must be at most ${MAX_KEY_LENGTH} characters`,
    );
  }

  const userId = req.user!.id;

  const insertResult = await pool.query(
    `
    INSERT INTO idempotency_keys (idempotency_key, user_id, request_path, request_method)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id, idempotency_key) DO NOTHING
    RETURNING id;
    `,
    [idempotencyKey, userId, req.path, req.method],
  );

  if (insertResult.rowCount === 0) {
    // Key already exists: either replay the stored result, or tell the
    // caller another request holds it right now.
    const existing = await pool.query(
      `
      SELECT status, response_code, response_body FROM idempotency_keys
      WHERE user_id = $1 AND idempotency_key = $2;
      `,
      [userId, idempotencyKey],
    );
    const row = existing.rows[0];

    if (row?.status === "completed") {
      return res.status(row.response_code ?? 200).json(row.response_body);
    }

    // in_progress, or the row was released between INSERT and SELECT
    throw new ConflictError(
      "A request with this idempotency key is already being processed",
    );
  }

  // From here on, this request owns the key.
  let settled = false;

  const release = () =>
    pool.query(
      `
      DELETE FROM idempotency_keys
      WHERE idempotency_key = $1 AND user_id = $2 AND status = 'in_progress';
      `,
      [idempotencyKey, userId],
    );

  const originalJson = res.json;

  res.json = function (body) {
    res.json = originalJson;
    settled = true;

    // Only successful results are cached. Failures free the key so the
    // client can fix the request (or retry a 5xx) with the same key.
    const isSuccess = res.statusCode >= 200 && res.statusCode < 300;

    const persist = isSuccess
      ? pool.query(
          `
          UPDATE idempotency_keys
          SET response_code = $1, response_body = $2, status = 'completed'
          WHERE idempotency_key = $3 AND user_id = $4;
          `,
          [res.statusCode, body, idempotencyKey, userId],
        )
      : release();

    // Respond only after the outcome is persisted, so an immediate retry
    // never sees a stale in_progress row.
    persist
      .catch((err) => console.error("Idempotency persist error:", err))
      .finally(() => originalJson.call(this, body));

    return this;
  };

  // Client disconnected or the response ended without res.json: free the key.
  res.on("close", () => {
    if (!settled) {
      release().catch((err) =>
        console.error("Idempotency release error:", err),
      );
    }
  });

  next();
};
