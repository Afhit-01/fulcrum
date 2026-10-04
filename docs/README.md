# Fulcrum documentation

Start with the [project README](../README.md) for a quick overview, then go deeper here.

| Document                                  | What it covers                                                      |
| ----------------------------------------- | ------------------------------------------------------------------- |
| [Getting started](getting-started.md)     | Setup, environment variables, migrations, seeding, Docker, commands |
| [API reference](api.md)                   | Authentication, roles, and every endpoint                           |
| [Workflows](workflows.md)                 | Order, return, and refund state machines                            |
| [Architecture](architecture.md)           | Layers, request lifecycle, project structure                        |
| [Error handling](error-handling.md)       | Error format, status codes, validation                              |
| [Reliability](reliability.md)             | Transactions, locking, compare-and-set, idempotency, rate limiting  |
| [Database](database.md)                   | Tables, relationships, pricing snapshots, migrations                |
| [Testing](testing.md)                     | Test setup and coverage                                             |
| [Limitations and roadmap](limitations.md) | What is not built, and what could come next                         |

The machine-readable API specification is [`openapi.yaml`](../openapi.yaml) in the project root. It is also served as interactive documentation at `/docs` when the app is running.
