# Limitations and roadmap

Fulcrum is a backend-only project focused on order processing and the workflows that follow an order.

## Known limitations

- **No frontend.** The API is explored through Swagger UI at `/docs`.
- **No online payments.** Refunds are recorded and completed by staff. No payment provider is integrated.
- **Inventory is not tracked.** Products have no stock levels, so an order is never rejected for lack of stock.
- **Basic migration runner.** It does not track applied migrations. See [Database](database.md#migrations).
- **One active return per order.** Requesting a return moves the whole order to `return_requested`, so further returns on that order wait until the first is resolved.
- **In-memory rate limiting.** Limits apply per server process.

## Possible future work

- A regression test file for status codes, transactions, concurrent updates, and pricing rules
- Online payments: initialize and verify transactions on the server, take the amount from the order total, and handle webhooks using the raw request body and signature verification
- Inventory, with stock decremented atomically inside the order transaction
- A migration tracker that records which migrations have run
- Receipts generated as PDFs
- Moving the remaining hand-written transactions onto the shared `withTransaction` helper
- A shared store (such as Redis) for rate limiting, and a trust-proxy setting when deployed behind a proxy
- A frontend built against `openapi.yaml`
