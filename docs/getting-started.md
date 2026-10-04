# Getting started

## Requirements

- Node.js
- npm
- PostgreSQL (or Docker, see [Running with Docker](#running-with-docker))

## 1. Install dependencies

```bash
npm ci
```

## 2. Configure the environment

Copy the template and fill in the values:

```bash
cp .env.example .env
```

Required:

```env
DATABASE_URL=postgres://<username>:<password>@<host>:<port>/<database_name>
JWT_SECRET=<long-random-secret>
PORT=3000
```

Optional rate-limit configuration (both limiters use a 15-minute window):

```env
AUTH_RATE_LIMIT_MAX=10
API_RATE_LIMIT_MAX=80
```

Used only by `npm run seed`:

```env
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=<password>
```

Consider raising `API_RATE_LIMIT_MAX` when demoing through Swagger UI, since every "Try it out" request counts toward the limit.

Tests use a separate `.env.test` that points at a separate database. See [Testing](testing.md).

## 3. Run migrations

```bash
npm run migrate:up
```

> [!IMPORTANT]
> The migration runner does not record which migrations have already run, so `migrate:up` only works on an **empty** database. To add a new migration to an existing database, apply just that file with `psql -f` and register it in both lists in `src/db/migrate.ts`. See [Database](database.md#migrations).

To reverse all migrations:

```bash
npm run migrate:down
```

> [!WARNING]
> `migrate:down` removes the application schema. Use it only when you intend to reset the database.

## 4. Seed data

```bash
npm run seed
```

The seed script:

- hashes the admin password with bcrypt and never overwrites an existing staff account with the same email
- inserts a sample product catalog (re-running it updates the name and price of existing sample products)

## 5. Start the server

```bash
npm run dev
```

- API: <http://localhost:3000>
- Interactive docs: <http://localhost:3000/docs>
- Health check: <http://localhost:3000/health>

## Running with Docker

Docker is optional. The compose file starts PostgreSQL 16 and the API together.

Create a `.env` file containing at least `JWT_SECRET` and `SEED_ADMIN_PASSWORD` (Compose refuses to start without them). If a value contains `$`, write it as `$$`.

```bash
docker compose up -d --build
docker compose exec api npm run migrate:up
docker compose exec api npm run seed
```

Then open <http://localhost:3000/docs>.

- `docker compose stop` stops the containers and keeps the data.
- `docker compose down` removes the containers but keeps the database.
- `docker compose down -v` also deletes the database, so run the migration and seed commands again afterwards.
- The database inside Docker is separate from any local PostgreSQL, and its port is not published to your machine.
- Migrations are run manually on purpose, because the runner would fail if it replayed them on every start.

## Useful commands

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

## Troubleshooting

| Symptom                                              | Likely cause                                                                                 |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `429` with code `RATE_LIMITED`                       | You hit a rate limit. Wait, or raise the limits in `.env`.                                   |
| `migrate:up` fails with "already exists"             | The database already has the tables. See the note under [Run migrations](#3-run-migrations). |
| `/docs` returns "Route not found"                    | The docs route must be registered before the not-found handler in `src/app.ts`.              |
| Tests fail with `relation "products" does not exist` | The test database has not received the latest migration.                                     |
