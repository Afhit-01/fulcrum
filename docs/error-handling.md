# Error handling

## Response format

Every error response has the same shape:

```json
{
  "error": "Order not found",
  "code": "NOT_FOUND"
}
```

| Status | `code`           | Typical cause                                               |
| ------ | ---------------- | ----------------------------------------------------------- |
| 400    | `BAD_REQUEST`    | Invalid input, malformed JSON, or a malformed id            |
| 401    | `UNAUTHORIZED`   | Missing or invalid token, or wrong credentials              |
| 403    | `FORBIDDEN`      | The role is not allowed to perform the operation            |
| 404    | `NOT_FOUND`      | Missing resource, or another customer's resource            |
| 409    | `CONFLICT`       | Invalid state transition, duplicate, or a concurrent change |
| 429    | `RATE_LIMITED`   | Rate limit exceeded                                         |
| 500    | `INTERNAL_ERROR` | Unexpected server error                                     |

## How it works

Application errors are `AppError` subclasses in `src/errors/AppError.ts`. Each carries an HTTP status and a stable code:

`BadRequestError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `TooManyRequestsError`.

Code anywhere in the stack throws one of them. A single `errorHandler` middleware, registered last in `src/app.ts`, turns the error into a response:

```ts
throw new NotFoundError("Order not found");
```

The handler also maps a few known cases:

- Malformed JSON bodies become `400`.
- A PostgreSQL unique violation (`23505`) becomes `409`.
- A PostgreSQL invalid-input error (`22P02`), such as a malformed UUID in a URL, becomes `400`.
- 4xx errors raised by the body parser, such as a payload that is too large, keep their status.
- Anything else is logged with the request method and URL, and returned as a generic `500`.

Express 5 forwards rejected promises from async handlers to the error middleware, so route handlers throw directly and need no `try/catch`.

## Validation versus business rules

**Routes and middleware** validate request-level concerns:

- required parameters
- request body shape and types
- status values and return decisions
- numeric values

**Services** enforce business rules:

- who can perform an operation
- valid state transitions
- order ownership
- return eligibility and quantities
- refund eligibility
