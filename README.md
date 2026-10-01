# Order Processing Engine

A backend REST API for managing the lifecycle of orders, returns, and refunds.

The project uses **Node.js, TypeScript, Express, and PostgreSQL**, with authentication, role-based authorization, customer data isolation, state-machine-driven workflows, database transactions, idempotency, rate limiting, migrations, and automated tests.

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
- Vitest
- Supertest
- Paystack integration for payment initialization

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
- Order lifecycle management
- Partial item returns
- Return approval/rejection workflow
- Refund workflow
- Transactional multi-table state changes
- Compare-and-set state transitions for concurrent updates
- Idempotency for selected mutating operations
- Configurable rate limiting
- Centralized application error handling
- Database migrations
- Admin seeding
- Integration and service-level tests

## Getting Started

### Requirements

- Node.js
- npm
- PostgreSQL

### 1. Install dependencies

```sh
npm ci
```

### 2. Configure the environment

Create a `.env` file.

At minimum:

```dotenv
DATABASE_URL=postgres://<username>:<password>@<host>:<port>/<database_name>
JWT_SECRET=<long-random-secret>
PORT=3000
PAYSTACK_SECRET_KEY=<paystack-secret-key>
```

Optional rate-limit configuration:

```dotenv
AUTH_RATE_LIMIT_MAX=10
API_RATE_LIMIT_MAX=80
```

Both rate limiters use a 15-minute window.

For local admin seeding, also provide:

```dotenv
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=<password>
```

A template is available in `.env.example`.

### 3. Run migrations

```sh
npm run migrate:up
```

This applies all migrations in order.

To reverse all migrations:

```sh
npm run migrate:down
```

> `migrate:down` removes the application schema. Use it only when you intend to reset the database.

### 4. Seed an admin account

After the authentication migration has been applied:

```sh
npm run seed
```

The seed script hashes the supplied password with bcrypt and does not overwrite an existing staff account with the same email.

### 5. Start the development server

```sh
npm run dev
```

The API runs on:

```text
http://localhost:3000
```

## Useful Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server with watch mode |
| `npm run build` | Compile TypeScript |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint issues where possible |
| `npm run format` | Format the project with Prettier |
| `npm run format:check` | Check formatting |
| `npm test` | Run the Vitest test suite |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run migrate:up` | Apply all application migrations |
| `npm run migrate:down` | Reverse all application migrations |
| `npm run migrate:test:up` | Apply migrations using `.env.test` |
| `npm run migrate:test:down` | Reverse test migrations |
| `npm run seed` | Seed an admin staff account |

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

### Roles

There are three roles:

- `customer`
- `staff`
- `admin`

The main permissions are:

| Operation | Customer | Staff | Admin |
| --- | :---: | :---: | :---: |
| Register | ✓ | — | — |
| Login | ✓ | ✓ | ✓ |
| Create order | ✓ | — | — |
| View own orders | ✓ | — | — |
| View orders across customers | — | ✓ | ✓ |
| Update order status | — | ✓ | ✓ |
| Request return | ✓ | — | — |
| Review returns | — | ✓ | ✓ |
| Move returns through operational stages | — | ✓ | ✓ |
| Process refunds | — | ✓ | ✓ |

Customer queries are filtered by the authenticated user's ID, preventing one customer from retrieving another customer's records by changing an ID in the URL.

## API Endpoints

All order, return, and refund endpoints require authentication.

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

Create an order with:

```json
{
  "items": [
    {
      "productId": "sku-1",
      "name": "Keyboard",
      "unitPrice": 15000,
      "quantity": 1
    }
  ]
}
```

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

### Payment integration

A Paystack integration exists in `src/integrations/paystack.ts` and supports transaction initialization internally.

The payment router is currently not mounted in `src/app.ts`, so there is no active `/payment` HTTP endpoint in the current application.

## Order State Machine

Orders use these statuses:

```text
pending
confirmed
shipped
delivered
cancelled
return_requested
returned
```

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

This prevents a request from overwriting a state that another concurrent request has already changed.

## Return State Machine

Returns use:

```text
pending
approved
rejected
in_transit
received
refunded
```

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

Return creation and rejection use database transactions because they update both the return request and its associated order.

## Refund State Machine

Refunds use:

```text
pending
completed
failed
```

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

```text
customers
staff
orders
order_items
return_requests
refunds
idempotency_keys
```

Relationships:

```text
Customer
   │
   └── Orders
          │
          ├── Order Items
          │
          └── Return Requests
                    │
                    └── Refunds
```

Orders use UUID primary keys generated by PostgreSQL.

`order_items` uses `(order_id, product_id)` as its composite primary key.

`return_requests` references an order item through:

```text
(order_id, product_id)
```

Orders use `ON DELETE CASCADE` for their order items.

Database access uses parameterized SQL through `pg` rather than a heavy ORM.

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

Selected mutating operations require an `Idempotency-Key` header:

```text
POST  /orders
POST  /return/:orderId/:productId/refund
PATCH /refunds/:refundId/complete
```

Idempotency prevents a retried request from accidentally performing the same operation twice.

Keys are scoped per authenticated user:

```text
(user_id, idempotency_key)
```

If a completed request is repeated with the same key, the stored response is returned.

If the key is currently being processed, the second request receives:

```http
409 Conflict
```

Successful responses are cached. Failed responses release the key so the client can retry after correcting the request or after a transient server failure.

## Rate Limiting

Two rate limiters are configured:

```text
Authentication routes
→ AUTH_RATE_LIMIT_MAX requests / 15 minutes

Order, return, and refund routes
→ API_RATE_LIMIT_MAX requests / 15 minutes
```

Defaults:

```dotenv
AUTH_RATE_LIMIT_MAX=10
API_RATE_LIMIT_MAX=80
```

The current implementation uses in-memory rate limiting. Redis-backed rate limiting is a future improvement.

## Validation and Error Handling

Input validation and business validation are separated.

Routes validate request-level concerns such as:

- Required parameters
- Request body shape
- Status values
- Return decisions
- Numeric values
- Required fields

Services enforce business rules such as:

- Who can perform an operation
- Valid state transitions
- Order ownership
- Return eligibility
- Return quantities
- Refund eligibility

Application errors are represented by `AppError` subclasses and handled by centralized error middleware.

Typical responses include:

```json
{
  "error": "Order not found",
  "code": "NOT_FOUND"
}
```

Unexpected errors return:

```json
{
  "error": "Internal server error",
  "code": "INTERNAL_ERROR"
}
```

## Testing

The project uses **Vitest** and **Supertest**.

The test suite currently covers:

- Authentication
- Role boundaries
- Customer data isolation
- Idempotency
- Concurrent duplicate requests
- Order state transitions
- Return state transitions
- Return rejection cascades
- Refund completion cascades
- Failed refund retry behavior
- Database behavior

Tests use `.env.test` and a separate test database.

Because tests truncate shared database tables, `.env.test` must never point to a database containing data you want to keep.

Run the suite with:

```sh
npm test
```

## Project Structure

```text
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
│       └── 005_allow_refund_retry_after_failure_down.sql
│
├── errors/
│   └── AppError.ts
│
├── integrations/
│   └── paystack.ts
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
│   ├── paymentRouter.ts
│   ├── refundsRouter.ts
│   └── returnsRouter.ts
│
├── services/
│   ├── authService.ts
│   ├── orderService.ts
│   ├── paymentService.ts
│   ├── refundService.ts
│   └── returnService.ts
│
├── store/
│   ├── authStore.ts
│   ├── orderStore.ts
│   ├── paymentStore.ts
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

## Current Scope

This is currently a backend-only project focused on order processing and the workflows that follow an order.

The current implementation includes persistent PostgreSQL storage, authentication, authorization, data isolation, order/return/refund state machines, transactional consistency, idempotency, rate limiting, migrations, and automated tests.

There is currently no frontend or generated API specification.

## Author

**Fatihu Ayomide Abdulganiyu (Afhit)**

Computer Science student, University of Ilorin.

GitHub: `Afhit-01`
