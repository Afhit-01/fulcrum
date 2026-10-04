# Fulcrum

A backend REST API for managing the lifecycle of orders, returns, and refunds, built with Node.js, TypeScript, Express 5, and PostgreSQL.

## Highlights

- JWT authentication with customer, staff, and admin roles, and strict customer data isolation
- Order, return, and refund workflows modelled as validated state machines
- Prices always come from the server's product catalog, never from the client
- Transactions, row locks, and compare-and-set updates keep related records consistent under concurrent requests
- Idempotency keys, rate limiting, and one centralized error format
- Interactive API documentation (Swagger UI) at `/docs`

## Quick start

You need Node.js, npm, and PostgreSQL.

```bash
npm ci
cp .env.example .env      # then fill in the values
npm run migrate:up        # run once, on an empty database
npm run seed              # admin account and sample products
npm run dev
```

The API runs on <http://localhost:3000> and the interactive docs are at <http://localhost:3000/docs>.

> [!NOTE]
> `migrate:up` replays every migration and only works on an empty database. See [Database](docs/database.md#migrations) for details.

Prefer containers? See [Running with Docker](docs/getting-started.md#running-with-docker).

## Documentation

| Document | What it covers |
| --- | --- |
| [Getting started](docs/getting-started.md) | Setup, environment variables, migrations, seeding, Docker, commands |
| [API reference](docs/api.md) | Authentication, roles, and every endpoint (also in [`openapi.yaml`](openapi.yaml) and at `/docs`) |
| [Workflows](docs/workflows.md) | Order, return, and refund state machines |
| [Architecture](docs/architecture.md) | Layers, request lifecycle, project structure |
| [Error handling](docs/error-handling.md) | Error format, status codes, validation |
| [Reliability](docs/reliability.md) | Transactions, locking, compare-and-set, idempotency, rate limiting |
| [Database](docs/database.md) | Tables, relationships, pricing snapshots, migrations |
| [Testing](docs/testing.md) | Test setup and coverage |
| [Limitations and roadmap](docs/limitations.md) | What is not built, and what could come next |

## Tech stack

Node.js, TypeScript, Express 5, PostgreSQL (`pg`), JWT, bcrypt, Helmet, express-rate-limit, OpenAPI 3 with Swagger UI, Vitest, and Supertest.

## Author

**Fatihu Ayomide Abdulganiyu (Afhit)**
Computer Science student, University of Ilorin.

GitHub: [Afhit-01](https://github.com/Afhit-01)
