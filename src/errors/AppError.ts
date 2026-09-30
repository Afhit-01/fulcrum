export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code: string = "APP_ERROR",
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class UnauthorizedError extends AppError {
  constructor(msg = "Unauthorized") {
    super(401, msg, "UNAUTHORIZED");
  }
}
export class NotFoundError extends AppError {
  constructor(msg = "Not found") {
    super(404, msg, "NOT_FOUND");
  }
}
export class ForbiddenError extends AppError {
  constructor(msg = "Forbidden") {
    super(403, msg, "FORBIDDEN");
  }
}
export class ConflictError extends AppError {
  constructor(msg: string) {
    super(409, msg, "CONFLICT");
  }
}
export class BadRequestError extends AppError {
  constructor(msg: string) {
    super(400, msg, "BAD_REQUEST");
  }
}
export class UpstreamError extends AppError {
  constructor(msg = "Payment provider error") {
    super(502, msg, "UPSTREAM_ERROR");
  }
}
