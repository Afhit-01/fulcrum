# Workflows

Orders, returns, and refunds each have their own state machine. Transitions are validated in the service layer, and the database enforces the important ones a second time. See [Reliability](reliability.md) for how.

## Order state machine

Statuses: `pending`, `confirmed`, `shipped`, `delivered`, `cancelled`, `return_requested`, `returned`.

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

An order can be cancelled only while it is `pending` or `confirmed`. Status changes are made by staff or admin, except that creating or rejecting a return moves the order automatically.

## Return state machine

Statuses: `pending`, `approved`, `rejected`, `in_transit`, `received`, `refunded`.

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

Creating a return and rejecting one each update both the return request and its order, so each runs in a single transaction.

## Refund state machine

Statuses: `pending`, `completed`, `failed`.

A refund can only be created when its return is `received`. Only one active refund can exist per return.

Successful completion changes three records together:

```text
Refund:  pending           →  completed
Return:  received          →  refunded
Order:   return_requested  →  returned
```

If a refund fails, only the refund changes:

```text
Refund:  failed
Return:  received          (unchanged)
Order:   return_requested  (unchanged)
```

A new refund can then be created for another attempt.
