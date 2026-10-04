# Architecture

## Layers

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

An error thrown at the route, service, or store layer travels up to a single error handler. See [Error handling](error-handling.md).

## Request lifecycle

In `src/app.ts`, requests pass through, in order:

1. Security headers (Helmet) and JSON body parsing
2. Public routes such as `/` and `/health`
3. Rate limiters, then the routers: `/auth`, `/orders`, `/return`, `/refunds`, `/products`
4. The interactive docs at `/docs`
5. The not-found handler, then the error handler

Order matters: anything registered after the not-found handler can never match, which is why `/docs` is mounted above it.

## Project structure

```text
openapi.yaml
Dockerfile
docker-compose.yml
.env.example
docs/

src/
├── config/
│   └── env.ts
│
├── db/
│   ├── client.ts            # pool and withTransaction helper
│   ├── migrate.ts
│   ├── seed.ts
│   └── migrations/          # 001 to 006, each with up and down files
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

`openapi.yaml` stays in the project root because `src/app.ts` reads it from the working directory when serving `/docs`. If you ever move it, update that path too.
