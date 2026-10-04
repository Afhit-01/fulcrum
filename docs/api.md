# API reference

This page summarizes the API. For full request and response schemas, use the interactive documentation at `/docs` when the app is running, or read [`openapi.yaml`](../openapi.yaml).

All order, return, and refund endpoints require authentication. `GET /products` and the authentication endpoints are public.

## Authentication

The API uses JWT bearer authentication. After login, the server returns a token containing:

```ts
{
  id: string;
  role: "customer" | "staff" | "admin";
}
```

Send it on authenticated requests:

```http
Authorization: Bearer <token>
```

Tokens expire after one hour.

### Endpoints

```http
POST /auth/customer/register
POST /auth/customer/login
POST /auth/staff/login
```

All three accept:

```json
{
  "email": "customer@example.com",
  "password": "password"
}
```

There is no public staff registration. Staff and admin accounts are created by the seed script.

## Roles

| Operation | Customer | Staff | Admin |
| --- | :---: | :---: | :---: |
| Browse products (public) | yes | yes | yes |
| Register | yes | no | no |
| Login | yes | yes | yes |
| Create order | yes | no | no |
| View own orders | yes | no | no |
| View orders across customers | no | yes | yes |
| Update order status | no | yes | yes |
| Request return | yes | no | no |
| Review returns | no | yes | yes |
| Move returns through operational stages | no | yes | yes |
| Process refunds | no | yes | yes |

Customer queries are filtered by the authenticated user's id, so one customer cannot retrieve another's records by changing an id in the URL. Another customer's record returns `404`, not `403`.

## Products

```http
GET /products
```

Returns the active catalog as `[{ id, name, unitPrice }]`, sorted by name. See [Pricing](database.md#products-and-server-side-pricing) for how prices are used.

## Orders

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
    { "productId": "sku-1", "quantity": 1 }
  ]
}
```

- Quantity must be a whole number from 1 to 500, and each product may appear once per order.
- Names and prices are looked up on the server. Anything else the client sends is ignored.
- `POST /orders` requires an `Idempotency-Key` header.
- `GET /orders` requires a `status` query parameter.
- `GET /orders/report` is limited to staff and admin.

## Returns

The route prefix is singular: `/return`.

```http
GET   /return
GET   /return/:returnId

PATCH /return/:orderId/:productId/:quantity
PATCH /return/:orderId/:productId/review
PATCH /return/:orderId/:productId/ship
PATCH /return/:orderId/:productId/receive

POST  /return/:orderId/:productId/refund
```

A return request needs a reason:

```json
{ "reason": "Product arrived damaged" }
```

It is checked against the customer's order, its delivered status, the product, the quantity, and a 30-day return window. A review accepts `{ "review": "approved" }` or `{ "review": "rejected" }`. Creating a refund takes `{ "refundAmount": 15000 }` and requires an `Idempotency-Key` header.

## Refunds

```http
GET   /refunds
GET   /refunds/:refundId
PATCH /refunds/:refundId/complete
```

Completing a refund takes `{ "outcome": "completed" }` or `{ "outcome": "failed" }` and requires an `Idempotency-Key` header.

## Operational endpoints

```http
GET /health     # checks the database connection
GET /docs       # interactive documentation (Swagger UI)
```

## Idempotency keys

These operations require an `Idempotency-Key` header:

```http
POST  /orders
POST  /return/:orderId/:productId/refund
PATCH /refunds/:refundId/complete
```

See [Reliability](reliability.md#idempotency) for how they behave.
