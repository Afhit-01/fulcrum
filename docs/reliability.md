# Reliability

Fulcrum is designed to stay consistent when requests fail halfway or arrive at the same moment. It uses four techniques.

## Transactions

Operations that must change several records together run in an explicit PostgreSQL transaction. A reusable helper in `src/db/client.ts` handles the details:

```ts
withTransaction(async (client) => {
  // database operations
});
```

The helper acquires a client, runs `BEGIN`, runs your function, commits on success, rolls back on failure, and always releases the client. A failure during rollback is logged and never hides the original error.

Transactional workflows:

- **Return creation.** Inserts the return request and moves the order to `return_requested`.
- **Return rejection.** Marks the return `rejected` and resets the order to `delivered`.
- **Refund completion.** Completes the refund, marks the return `refunded`, and marks the order `returned`.

## Row locks

Inside these transactions, the rows involved are locked with `SELECT ... FOR UPDATE` and their states are re-checked before any write. Two simultaneous return requests for the same order cannot both succeed: the second waits, sees the order has already moved on, and receives `409`.

Where more than one row is locked, the order is always the same, so transactions cannot wait on each other in a circle:

- Refund completion locks refund, then return, then order.
- Return rejection locks return, then order.

## Compare-and-set updates

Status changes that do not need a full transaction use a conditional update:

```sql
UPDATE orders
SET status = $1
WHERE id = $2
  AND status = $3;
```

The service checks that a transition is allowed, then writes it only if the row is still in the state it checked. If no row changes, someone else got there first and the request fails with `409`. This protects order status updates and cancellation, the return transitions (approve, ship, receive, refunded), and marking a refund as failed, which can only affect a refund that is still `pending`.

## Idempotency

These operations require an `Idempotency-Key` header (maximum 255 characters):

```http
POST  /orders
POST  /return/:orderId/:productId/refund
PATCH /refunds/:refundId/complete
```

It prevents a retried request from performing the same operation twice. Keys are scoped per authenticated user, as `(user_id, idempotency_key)`.

- Repeating a completed request with the same key returns the stored response.
- A request that arrives while the first is still being processed receives `409`.
- Only successful (2xx) responses are stored.
- A failed request releases its key, so the client can correct the request, or retry after a temporary failure, using the same key.
- If the client disconnects before a response is sent, the key is released.
- The outcome is saved before the response is sent, so an immediate retry never sees a half-finished state.

## Rate limiting

| Scope                                     | Limit                                         |
| ----------------------------------------- | --------------------------------------------- |
| Authentication routes                     | `AUTH_RATE_LIMIT_MAX` requests per 15 minutes |
| Order, return, refund, and product routes | `API_RATE_LIMIT_MAX` requests per 15 minutes  |

Defaults are `10` and `80`. Exceeding a limit returns `429` with code `RATE_LIMITED`. The limiter keeps its counts in memory, so limits apply per server process.
