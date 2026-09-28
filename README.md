# Order Processing Engine

A backend API for managing orders and everything that happens after an order is placed, including returns and refunds.

## Overview

The Order Processing Engine is a REST API built with Node.js, TypeScript, Express, and PostgreSQL.

The project started out much simpler, but it has grown into a backend system with persistent database storage, authentication, role-based access control, customer data isolation, order and return state machines, refunds, idempotency, rate limiting, database transactions, and automated tests.

The main idea is simple: an order should not just be created and forgotten. Its entire lifecycle should be handled with clear rules about what can happen, who can do it, and when it can happen.

## Tech Stack

- Node.js
- TypeScript
- Express
- PostgreSQL
- JWT
- bcrypt
- Helmet
- express-rate-limit
- Vitest

## Getting Started

### Requirements

You need:

- Node.js
- npm
- PostgreSQL

### 1. Install dependencies

```sh
npm ci
```

### 2. Configure the environment

Create a `.env` file:

```dotenv
DATABASE_URL=postgres://<username>:<password>@<host>:<port>/<database_name>
JWT_SECRET=<long-random-secret>
PORT=3000
```

The rate limits can also be configured if needed:

```dotenv
AUTH_RATE_LIMIT_MAX=10
API_RATE_LIMIT_MAX=80
```

Both limits use a 15-minute window.

### 3. Run the database migrations

```sh
npm run migrate:up
```

If you want to create an admin account, set:

```dotenv
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=<password>
```

and run:

```sh
npm run seed
```

The seed script does not overwrite an existing staff account with the same email.

### 4. Start the server

```sh
npm run dev
```

The API will be available at:

```text
http://localhost:3000
```

The migration command applies all migrations in order.

There is also a `migrate:down` command that reverses all migrations and drops the schema. Use it only when you actually want to reset the database.

## Useful Commands

| Command                     | Purpose                               |
| --------------------------- | ------------------------------------- |
| `npm run dev`               | Start the development server          |
| `npm run build`             | Compile TypeScript                    |
| `npm run lint`              | Run ESLint                            |
| `npm test`                  | Run the Vitest test suite             |
| `npm run migrate:up`        | Apply application migrations          |
| `npm run migrate:down`      | Reverse application migrations        |
| `npm run migrate:test:up`   | Apply migrations to the test database |
| `npm run migrate:test:down` | Reverse test database migrations      |

Tests use `.env.test`. The test configuration checks that `DATABASE_URL` appears to point to a test database before running.

The tests also truncate shared database tables, so `.env.test` should never point to a database containing data you want to keep.

## Architecture

The application follows a simple layered structure:

```text
Route
  ↓
Service
  ↓
Store
  ↓
PostgreSQL
```

### Routes

Routes deal with HTTP.

They receive requests, validate basic input, run middleware, call the appropriate service, and send the response.

### Services

Services contain the actual business logic.

This is where things like authorization, state transitions, return rules, refund rules, and data-isolation decisions are handled.

### Stores

Stores are responsible for talking to PostgreSQL.

They contain the SQL queries and handle reading and writing database records.

This keeps the responsibilities fairly clear. Routes handle HTTP, services handle business rules, and stores handle the database.

## Authentication and Authorization

The API uses JWT-based authentication.

After a successful login, the server returns a signed JWT containing information about the authenticated user:

```ts
{
  id: string;
  role: "customer" | "staff" | "admin";
}
```

Authenticated requests send the token as:

```http
Authorization: Bearer <token>
```

Tokens expire after one hour.

There is no public staff registration endpoint. Admin accounts are created through the seed script.

Login failures also return the same generic `Invalid credentials` message whether the email or password is incorrect.

### Roles

The application currently has three roles:

- `customer`
- `staff`
- `admin`

The roles determine which operations a user is allowed to perform.

For example:

- Customers can create orders.
- Customers can request returns for their own orders.
- Staff and admins can review return requests.
- Staff and admins can move returns through operational stages.
- Staff and admins can process refunds.

Authentication is handled by the `requireAuth` middleware, while role-specific permissions are enforced where the operation requires them.

## Data Isolation

Authentication tells the application who is making a request.

Data isolation determines which records that user is actually allowed to access.

For customer-facing operations, the authenticated user's ID is used when querying their data. This means a customer cannot simply change an order ID in a URL and access another customer's order.

For example, an order lookup can apply both conditions:

```sql
WHERE orders.id = $1
AND orders.customer_id = $2
```

Staff and admins can access records across customers when the operation allows it.

## Order Lifecycle

Orders use the following statuses:

```text
pending
confirmed
shipped
delivered
cancelled
return_requested
returned
```

The main state flow is:

```text
pending
 ├── confirmed
 │    ├── shipped
 │    │    └── delivered
 │    │         └── return_requested
 │    │              ├── returned
 │    │              └── delivered
 │    └── cancelled
 └── cancelled
```

`cancelled` and `returned` are terminal states.

The service layer validates transitions, so an order cannot jump from one state to another just because a request was made to the endpoint.

## Return Lifecycle

Returns use:

```text
pending
approved
rejected
in_transit
received
refunded
```

The flow is:

```text
pending
 ├── approved
 │    └── in_transit
 │         └── received
 │              └── refunded
 └── rejected
```

A rejected return moves the associated order back to `delivered`.

A successful refund eventually moves both the return and the order forward:

```text
Refund completed
      ↓
Return → refunded
      ↓
Order → returned
```

## Refunds

Refunds have three possible statuses:

```text
pending
completed
failed
```

A refund can only be created after the associated return has reached:

```text
received
```

Only staff and admins can create or complete refunds.

A failed refund does not destroy the state of the return or order. The refund can be retried, which means a temporary refund failure does not leave the order stuck in an inconsistent state.

## API Endpoints

### Authentication

```http
POST /auth/customer/register
POST /auth/customer/login
POST /auth/staff/login
```

### Orders

```http
POST   /orders
GET    /orders
GET    /orders/:orderId
GET    /orders/:orderId/total
PATCH  /orders/:orderId/status
DELETE /orders/:orderId
GET    /orders/report
```

Customers can only access their own orders.

Authorized staff and admins can access orders across customers.

### Returns

```http
GET   /return
GET   /return/:returnId

PATCH /return/:orderId/:productId/:quantity
PATCH /return/:orderId/:productId/review
PATCH /return/:orderId/:productId/ship
PATCH /return/:orderId/:productId/receive

POST  /return/:orderId/:productId/refund
```

The mounted route prefix is singular: `/return`.

A return request includes a reason:

```json
{
  "reason": "Product arrived damaged"
}
```

The application checks things like ownership, order status, product existence, quantity, and the 30-day return window before creating the request.

### Refunds

```http
GET   /refunds
GET   /refunds/:refundId
PATCH /refunds/:refundId/complete
```

Completing a refund accepts:

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

A successful completion changes:

```text
Refund   → completed
Return   → refunded
Order    → returned
```

A failed refund remains retryable.

## Idempotency

Some operations can safely be retried using an `Idempotency-Key` header.

This is useful when a client does not know whether a request succeeded, for example because the network connection dropped after the server processed it. Without idempotency, retrying the request could create a duplicate order or perform the same operation twice.

Idempotency currently applies to:

```text
POST  /orders
POST  /return/:orderId/:productId/refund
PATCH /refunds/:refundId/complete
```

Keys are scoped per user, so two different users can use the same key without interfering with each other.

If the same key is already being processed, the new request receives `409 Conflict`.

If the original request has already completed, its stored response is returned instead of running the operation again.

The key is claimed atomically in PostgreSQL, which also handles the case where two identical requests arrive at almost the same time.

## Rate Limiting

The API uses two in-memory rate limiters:

```text
/auth                  10 requests / 15 minutes
/orders, /return,
/refunds               80 requests / 15 minutes
```

The limits can be changed with:

```dotenv
AUTH_RATE_LIMIT_MAX=10
API_RATE_LIMIT_MAX=80
```

The authentication routes have a lower limit because they are the most obvious place to protect against repeated credential attempts.

## Validation

Validation happens at different levels.

Routes handle things like:

- Required parameters
- Request body shape
- Valid status values
- Valid return decisions
- Numeric quantities
- Required fields

Services handle the rules that depend on the application's business logic.

For example:

- Only customers can create orders.
- Only customers can request returns.
- Only staff/admin can process returns.
- Orders must follow the defined state machine.
- Returns must follow the defined state machine.
- Return quantities cannot exceed the quantity ordered.
- Refunds cannot be created before a return is received.

## Database

PostgreSQL is used as the persistent data store.

The main entities are:

```text
customers
staff
orders
order_items
return_requests
refunds
idempotency_keys
```

The relationships roughly look like this:

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

The application uses parameterized SQL rather than directly interpolating user input into queries.

Related operations that need to succeed together are also wrapped in database transactions.

For example, creating an order involves creating the order itself and its order items. If something fails halfway through, the transaction rolls everything back instead of leaving half an order in the database.

## Testing

The project uses Vitest for automated tests.

The test suite covers:

- Authentication boundaries
- Role-based access control
- Customer data isolation
- Idempotency
- Concurrent duplicate requests
- Order state transitions
- Return state transitions
- Return rejection cascades
- Refund completion cascades
- Failed refund retry behavior
- Database migration behavior

The suite can be run with:

```sh
npm test
```

## Project Structure

A simplified version of the project looks like this:

```text
src/
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
├── middleware/
│   ├── requireAuth.ts
│   ├── idempotency.ts
│   ├── rateLimiter.ts
│   └── validateBody.ts
│
├── routes/
│   ├── authRouter.ts
│   ├── ordersRouter.ts
│   ├── returnsRouter.ts
│   └── refundsRouter.ts
│
├── services/
│   ├── authService.ts
│   ├── orderService.ts
│   ├── returnService.ts
│   └── refundService.ts
│
├── store/
│   ├── authStore.ts
│   ├── orderStore.ts
│   ├── returnStore.ts
│   └── refundStore.ts
│
├── validation/
│   └── validation.ts
│
├── app.ts
├── server.ts
└── types.ts

tests/
├── integration/
└── services/
```

## What This Project Covers

The project has been a way for me to put backend concepts into an actual system instead of learning each one in isolation.

Some of the concepts currently implemented are:

- REST API design
- Layered architecture
- TypeScript
- Authentication
- JWT
- Role-based access control
- Data isolation
- Request and business validation
- State machines
- PostgreSQL
- Relational data modeling
- Parameterized SQL
- Database transactions
- Idempotency
- Rate limiting
- Error handling
- Database migrations
- Automated testing
- Separation of concerns

## Current Scope

This is currently a backend-only project.

The API has persistent PostgreSQL storage, authentication and authorization, order/return/refund workflows, idempotency, rate limiting, migrations, and automated service and integration tests.

There is currently no frontend, invoice generation, or generated API specification.

## Author

**Fatihu Ayomide Abdulganiyu (Afhit)**

Computer Science student, University of Ilorin.

GitHub: `Afhit-01`
