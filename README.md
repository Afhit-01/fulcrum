# Fulcrum

A backend REST API for managing the lifecycle of orders, returns, and refunds.

Fulcrum is built with Node.js, TypeScript, Express, and PostgreSQL, with authentication, role-based authorization, customer data isolation, server-side pricing, state-machine-driven workflows, database transactions, idempotency, rate limiting, migrations, interactive API documentation, and automated tests.

## Table of Contents

- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Features](#features)
- [Getting Started](#getting-started)
- [Useful Commands](#useful-commands)
- [API Documentation](#api-documentation)
- [Authentication](#authentication)
- [Roles](#roles)
- [API Endpoints](#api-endpoints)
- [Products and Server-Side Pricing](#products-and-server-side-pricing)
- [Order State Machine](#order-state-machine)
- [Return State Machine](#return-state-machine)
- [Refund State Machine](#refund-state-machine)
- [Database](#database)
- [Transactions](#transactions)
- [Idempotency](#idempotency)
- [Rate Limiting](#rate-limiting)
- [Validation and Error Handling](#validation-and-error-handling)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Current Scope and Known Limitations](#current-scope-and-known-limitations)
- [Author](#author)

## Tech Stack

- Node.js
- TypeScript
- Express 5
- PostgreSQL
- `pg` for database access
- JWT (`jsonwebtoken`)
- bcrypt
- Helmet
- express-rate-limit
- OpenAPI 3 with Swagger UI (`swagger-ui-express`)
- Vitest
- Supertest

## Architecture

The application follows a layered structure:

```text
HTTP Request
     ↓
Middleware
     ↓
Route
     ↓
Service
     ↓
Store
     ↓
PostgreSQL
```

- **Routes** handle HTTP concerns and request-level validation.
- **Middleware** handles authentication, idempotency, rate limiting, and body validation.
- **Services** contain business rules, authorization decisions, and workflow transitions.
- **Stores** contain PostgreSQL queries and persistence logic.
- **Database** provides durable state, constraints, foreign keys, and transactional guarantees.

## Features

- PostgreSQL-backed persistent storage
- Customer registration and login
- Staff/admin login
- JWT authentication
- Role-based access control
- Customer-level data isolation
- Product catalog with server-side pricing
- Order lifecycle management
- Partial item returns
- Return approval/rejection workflow
- Refund workflow
- Transactional multi-table state changes
- Compare-and-set state transitions for concurrent updates
- Idempotency for selected mutating operations
- Configurable rate limiting
- Centralized application error handling
- Interactive API documentation (Swagger UI)
- Database migrations
- Admin and sample catalog seeding
- Integration and service-level tests

## Getting Started

### Requirements

- Node.js
- npm
- PostgreSQL

### 1. Install dependencies

```bash
npm ci
```

### 2. Configure the environment

Create a `.env` file. At minimum:

```env
DATABASE_URL=postgres://<username>:<password>@<host>:<port>/<database_name>
JWT_SECRET=<long-random-secret>
PORT=3000
```

Optional rate-limit configuration:

```env
AUTH_RATE_LIMIT_MAX=10
API_RATE_LIMIT_MAX=80
```

Both rate limiters use a 15-minute window. Consider raising `API_RATE_LIMIT_MAX` when demoing through Swagger UI, since every "Try it out" request counts toward the limit.

For local seeding, also provide:

```env
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=<password>
```

A template is available in `.env.example`.

Tests use a separate `.env.test` pointing at a separate database (see [Testing](#testing)).

### 3. Run migrations

```bash
npm run migrate:up
```

This applies all migrations in order.

> [!IMPORTANT]
> The migration runner does not record which migrations have already run. `migrate:up` replays every migration from the first, so it only works on an **empty** database. Use it once per fresh database. To add a new migration to an existing database, apply just that file with `psql -f src/db/migrations/<file>_up.sql`, and register it in both lists in `src/db/migrate.ts` so fresh databases pick it up.

To reverse all migrations:

```bash
npm run migrate:down
```

> [!WARNING]
> `migrate:down` removes the application schema. Use it only when you intend to reset the database.

### 4. Seed an admin account and the product catalog

After the migrations have been applied:

```bash
npm run seed
```

The seed script:

- Hashes the supplied admin password with bcrypt and does not overwrite an existing staff account with the same email.
- Inserts a sample product catalog. Re-running the seed updates the name and price of existing sample products.

### 5. Start the development server

```bash
npm run dev
```

The API runs on <http://localhost:3000>, and the interactive documentation is at <http://localhost:3000/docs>.

### Running with Docker

Create a `.env` file containing `JWT_SECRET` and `SEED_ADMIN_PASSWORD`, then:

```bash
docker compose up -d --build
docker compose exec api npm run migrate:up
docker compose exec api npm run seed
```

The API is at <http://localhost:3000> and the docs at <http://localhost:3000/docs>.
Use `docker compose down -v` to wipe the database and start over.

## Useful Commands

| Command                     | Purpose                                      |
| --------------------------- | -------------------------------------------- |
| `npm run dev`               | Start the development server with watch mode |
| `npm run build`             | Compile TypeScript                           |
| `npm run lint`              | Run ESLint                                   |
| `npm run lint:fix`          | Fix ESLint issues where possible             |
| `npm run format`            | Format the project with Prettier             |
| `npm run format:check`      | Check formatting                             |
| `npm test`                  | Run the Vitest test suite                    |
| `npm run test:watch`        | Run Vitest in watch mode                     |
| `npm run migrate:up`        | Apply all application migrations             |
| `npm run migrate:down`      | Reverse all application migrations           |
| `npm run migrate:test:up`   | Apply migrations using `.env.test`           |
| `npm run migrate:test:down` | Reverse test migrations                      |
| `npm run seed`              | Seed an admin account and the sample catalog |

## API Documentation

Interactive documentation is served by the app at `/docs` (Swagger UI), generated from the OpenAPI 3 specification in [`openapi.yaml`](./openapi.yaml).

To try the API from the documentation page:

1. Register with `POST /auth/customer/register`, then log in with `POST /auth/customer/login` (or use `POST /auth/staff/login` with the seeded admin).
2. Click **Authorize** and paste the returned token.
3. For endpoints that require an `Idempotency-Key`, provide any unique string.

The specification documents every endpoint, request body, response, role requirement, and the shared error format.

## Authentication

The API uses JWT bearer authentication.

After login, the server returns a token containing:

```ts
{
  id: string;
  role: "customer" | "staff" | "admin";
}
```

Authenticated requests use:

```http
Authorization: Bearer <token>
```

Tokens expire after one hour.

## Roles

There are three roles: `customer`, `staff`, and `admin`.

The main permissions are:

| Operation                               | Customer | Staff | Admin |
| --------------------------------------- | :------: | :---: | :---: |
| Browse products (public)                |    ✓     |   ✓   |   ✓   |
| Register                                |    ✓     |   —   |   —   |
| Login                                   |    ✓     |   ✓   |   ✓   |
| Create order                            |    ✓     |   —   |   —   |
| View own orders                         |    ✓     |   —   |   —   |
| View orders across customers            |    —     |   ✓   |   ✓   |
| Update order status                     |    —     |   ✓   |   ✓   |
| Request return                          |    ✓     |   —   |   —   |
| Review returns                          |    —     |   ✓   |   ✓   |
| Move returns through operational stages |    —     |   ✓   |   ✓   |
| Process refunds                         |    —     |   ✓   |   ✓   |

Customer queries are filtered by the authenticated user's ID, preventing one customer from retrieving another customer's records by changing an ID in the URL.

## API Endpoints

All order, return, and refund endpoints require authentication. `GET /products` and the authentication endpoints are public. For full request and response details, see [API Documentation](#api-documentation).

### Authentication

```http
POST /auth/customer/register
POST /auth/customer/login
POST /auth/staff/login
```

Customer registration and login accept:

```json
{
  "email": "customer@example.com",
  "password": "password"
}
```

There is no public staff registration endpoint. Staff/admin accounts are created through the seed mechanism.

### Products

```http
GET /products
```

Returns the active product catalog as `[{ id, name, unitPrice }]`, sorted by name.

### Orders

```http
POST   /orders
GET    /orders?status=pending
GET    /orders/:orderId
GET    /orders/:orderId/total
PATCH  /orders/:orderId/status
DELETE /orders/:orderId
GET    /orders/report
```

Create an order with product ids and quantities only:

```json
{
  "items": [
    {
      "productId": "sku-1",
      "quantity": 1
    }
  ]
}
```

Quantity must be a whole number from 1 to 500, and each product may appear once per order. Names and prices are looked up on the server (see [Products and Server-Side Pricing](#products-and-server-side-pricing)).

`POST /orders` requires an `Idempotency-Key` header.

### Returns

The mounted route prefix is singular: `/return`.

```http
GET   /return
GET   /return/:returnId

PATCH /return/:orderId/:productId/:quantity
PATCH /return/:orderId/:productId/review
PATCH /return/:orderId/:productId/ship
PATCH /return/:orderId/:productId/receive

POST  /return/:orderId/:productId/refund
```

A return request requires a reason:

```json
{
  "reason": "Product arrived damaged"
}
```

The request is checked against the customer's order, delivered status, product, quantity, and 30-day return window.

### Refunds

```http
GET   /refunds
GET   /refunds/:refundId
PATCH /refunds/:refundId/complete
```

Refund completion accepts:

```json
{
  "outcome": "completed"
}
```

or:

```json
{
  "outcome": "failed"
}
```

Refund creation and completion require an `Idempotency-Key` header.

## Products and Server-Side Pricing

Prices are never accepted from the client. When an order is placed, the server looks up each requested product in the `products` table and copies its current name and unit price into the order's items.

- A client that sends its own `name` or `unitPrice` has those fields ignored.
- Unknown or inactive products are rejected with `400`.
- Order items are a **snapshot**: changing a product's price later does not change existing orders, so `order_items` deliberately has no foreign key to `products`.
- Quantities must be whole numbers from 1 to 500.

## Order State Machine

Orders use these statuses:

`pending`, `confirmed`, `shipped`, `delivered`, `cancelled`, `return_requested`, `returned`

Allowed transitions:

```text
pending
 ├── confirmed
 │    ├── shipped
 │    │    └── delivered
 │    │         └── return_requested
 │    │              ├── delivered  (return rejected)
 │    │              └── returned   (refund completed)
 │    └── cancelled
 └── cancelled
```

Transitions are validated in the service layer.

Database updates also use compare-and-set semantics:

```sql
UPDATE orders
SET status = $1
WHERE id = $2
  AND status = $3;
```

This prevents a request from overwriting a state that another concurrent request has already changed. If the update affects no rows, the request fails with `409 Conflict`. The same technique protects return and refund status changes.

## Return State Machine

Returns use these statuses:

`pending`, `approved`, `rejected`, `in_transit`, `received`, `refunded`

The normal path is:

```text
pending
   ↓
approved
   ↓
in_transit
   ↓
received
   ↓
refunded
```

A pending return may instead be rejected:

```text
pending → rejected
```

Return creation and rejection use database transactions because they update both the return request and its associated order. Creating a return locks the order row and re-checks that it is still `delivered`, so two simultaneous requests cannot both succeed.

## Refund State Machine

Refunds use these statuses:

`pending`, `completed`, `failed`

A refund can only be created when its return is `received`.

Successful completion is transactional:

```text
Refund:  pending
Return:  received
Order:   return_requested

          ↓

Refund:  completed
Return:  refunded
Order:   returned
```

The completion transaction locks the refund, return, and order rows and re-checks their states before making the three updates.

If a refund fails:

```text
Refund:  failed
Return:  received
Order:   return_requested
```

The failed refund does not move the return or order forward. A new refund can then be created for another attempt.

## Database

PostgreSQL is the persistent data store.

The main tables are:

- `customers`
- `staff`
- `products`
- `orders`
- `order_items`
- `return_requests`
- `refunds`
- `idempotency_keys`

Relationships:

```text
Customer
   │
   └── Orders
          │
          ├── Order Items   (snapshot of product name and price)
          │
          └── Return Requests
                    │
                    └── Refunds

Products  (catalog; read when an order is placed)
```

- Orders use UUID primary keys generated by PostgreSQL.
- `order_items` uses `(order_id, product_id)` as its composite primary key.
- `return_requests` references an order item through `(order_id, product_id)`.
- Orders use `ON DELETE CASCADE` for their order items.
- Database access uses parameterized SQL through `pg` rather than a heavy ORM.

## Transactions

The project uses explicit PostgreSQL transactions for operations that must change multiple pieces of state atomically.

A reusable transaction helper is provided:

```ts
withTransaction(async (client) => {
  // database operations
});
```

The helper:

1. Acquires a PostgreSQL client.
2. Starts `BEGIN`.
3. Runs the supplied function.
4. Commits on success.
5. Rolls back on failure.
6. Releases the client.

Transactional workflows currently include return creation, return rejection, and successful refund completion.

## Idempotency

Selected mutating operations require an `Idempotency-Key` header (maximum 255 characters):

```http
POST  /orders
POST  /return/:orderId/:productId/refund
PATCH /refunds/:refundId/complete
```

Idempotency prevents a retried request from accidentally performing the same operation twice.

Keys are scoped per authenticated user: `(user_id, idempotency_key)`.

- If a completed request is repeated with the same key, the stored response is returned.
- If the key is currently being processed, the second request receives `409 Conflict`.
- Successful (2xx) responses are cached.
- Failed responses release the key so the client can retry after correcting the request or after a transient server failure.
- If a client disconnects before the response is sent, the key is released.

## Rate Limiting

Two rate limiters are configured:

| Scope                                     | Limit                                       |
| ----------------------------------------- | ------------------------------------------- |
| Authentication routes                     | `AUTH_RATE_LIMIT_MAX` requests / 15 minutes |
| Order, return, refund, and product routes | `API_RATE_LIMIT_MAX` requests / 15 minutes  |

Defaults:

```env
AUTH_RATE_LIMIT_MAX=10
API_RATE_LIMIT_MAX=80
```

Exceeding a limit returns `429` with the standard error body. The current implementation uses in-memory rate limiting. Redis-backed rate limiting is a future improvement.

## Validation and Error Handling

Input validation and business validation are separated.

**Routes** validate request-level concerns such as:

- Required parameters
- Request body shape
- Status values
- Return decisions
- Numeric values
- Required fields

**Services** enforce business rules such as:

- Who can perform an operation
- Valid state transitions
- Order ownership
- Return eligibility
- Return quantities
- Refund eligibility

Application errors are represented by `AppError` subclasses and handled by a single centralized error middleware, which also logs unexpected errors. Every error response has the same shape:

```json
{
  "error": "Order not found",
  "code": "NOT_FOUND"
}
```

| Status | `code`           | Typical cause                                          |
| ------ | ---------------- | ------------------------------------------------------ |
| 400    | `BAD_REQUEST`    | Invalid input or malformed JSON                        |
| 401    | `UNAUTHORIZED`   | Missing/invalid token, wrong credentials               |
| 403    | `FORBIDDEN`      | Role not allowed to perform the operation              |
| 404    | `NOT_FOUND`      | Missing resource, or another customer's resource       |
| 409    | `CONFLICT`       | Invalid state transition, duplicate, concurrent change |
| 429    | `RATE_LIMITED`   | Rate limit exceeded                                    |
| 500    | `INTERNAL_ERROR` | Unexpected server error                                |

## Testing

The project uses Vitest and Supertest.

The test suite currently covers:

- Authentication
- Role boundaries
- Customer data isolation
- Idempotency
- Concurrent duplicate requests
- Server-side pricing and the product catalog
- Order state transitions
- Return state transitions
- Return rejection cascades
- Refund completion cascades
- Failed refund retry behavior
- Database behavior

Tests use `.env.test` and a separate test database. Each test resets the database and seeds a small fixed set of products.

> [!CAUTION]
> Because tests truncate shared database tables, `.env.test` must never point to a database containing data you want to keep.

Run the suite with:

```bash
npm test
```

## Project Structure

```text
openapi.yaml

src/
├── config/
│   └── env.ts
│
├── db/
│   ├── client.ts
│   ├── migrate.ts
│   ├── seed.ts
│   └── migrations/
│       ├── 001_initial_scheme_up.sql
│       ├── 001_initial_scheme_down.sql
│       ├── 002_add_auth_up.sql
│       ├── 002_add_auth_down.sql
│       ├── 003_add_idempotency_up.sql
│       ├── 003_add_idempotency_down.sql
│       ├── 004_fix_idempotency_constraint_up.sql
│       ├── 004_fix_idempotency_constraint_down.sql
│       ├── 005_allow_refund_retry_after_failure_up.sql
│       ├── 005_allow_refund_retry_after_failure_down.sql
│       ├── 006_add_products_up.sql
│       └── 006_add_products_down.sql
│
├── errors/
│   └── AppError.ts
│
├── middleware/
│   ├── errorHandler.ts
│   ├── idempotency.ts
│   ├── rateLimiter.ts
│   ├── requireAuth.ts
│   └── validateBody.ts
│
├── routes/
│   ├── authRouter.ts
│   ├── ordersRouter.ts
│   ├── productsRouter.ts
│   ├── refundsRouter.ts
│   └── returnsRouter.ts
│
├── services/
│   ├── authService.ts
│   ├── orderService.ts
│   ├── refundService.ts
│   └── returnService.ts
│
├── store/
│   ├── authStore.ts
│   ├── orderStore.ts
│   ├── productStore.ts
│   ├── refundStore.ts
│   └── returnStore.ts
│
├── validation/
│   └── validation.ts
│
├── app.ts
├── server.ts
├── returnLogic.ts
└── types.ts

tests/
├── helpers/
├── integration/
└── services/
```

## Current Scope and Known Limitations

Fulcrum is a backend-only project focused on order processing and the workflows that follow an order. It includes persistent PostgreSQL storage, authentication, authorization, data isolation, server-side pricing, order/return/refund state machines, transactional consistency, idempotency, rate limiting, migrations, interactive API documentation, and automated tests.

Known limitations and possible future work:

- **No frontend.** The API is explored through Swagger UI at `/docs`.
- **No online payments.** Refunds are recorded and completed by staff; no payment provider is integrated.
- **Inventory is not tracked.** Products have no stock levels, so an order is never rejected for lack of stock.
- **Migration runner is basic.** It does not track applied migrations (see [Run migrations](#3-run-migrations)).
- **One active return per order.** Placing a return moves the whole order to `return_requested`, so further returns on that order wait until the first is resolved.
- **In-memory rate limiting.** Limits are per server process; a Redis-backed store would be needed to scale across instances.

## Author

**Fatihu Ayomide Abdulganiyu (Afhit)**
Computer Science student, University of Ilorin.

GitHub: [Afhit-01](https://github.com/Afhit-01)
