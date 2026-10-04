# Testing

The project uses Vitest and Supertest.

## Setup

Tests load `.env.test` and run against a **separate test database**. Create that database, point `DATABASE_URL` in `.env.test` at it, and migrate it:

```bash
npm run migrate:test:up
```

Each integration test resets the database before it runs and seeds a small fixed set of products, so tests do not depend on your development data.

> [!CAUTION]
> Tests truncate shared tables. `.env.test` must never point at a database containing data you want to keep.

Whenever you add a migration, apply it to the test database as well. A missing table there makes many tests fail at once with the same error.

## Running

```bash
npm test             # run the suite once
npm run test:watch   # watch mode
```

## Coverage

- Authentication and role boundaries
- Customer data isolation
- Idempotency, including concurrent duplicate requests
- Server-side pricing and the product catalog
- Order state transitions
- Return state transitions
- Return rejection cascades
- Refund completion cascades
- Failed refund retry behavior

Service-level unit tests need no database. Integration tests exercise the real application through HTTP.
