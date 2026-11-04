# Backend rules (attach to EVERY backend phase)

Stack: NestJS + Prisma + PostgreSQL inside the monorepo (`apps/api`). Sources of truth: `packages/db/prisma/schema.prisma` (data) and `packages/domain` (rules, 88 tests). **A rule that exists in `@gym/domain` is called, never re-written.** If a rule you need is missing from the domain, STOP and list it under "missing", do not invent it in a service.

## Conventions
- Base path `/api/v1`. JSON only. Money in JSON = integer piasters (`amount: 125000` = 1,250.00). Dates = ISO-8601 UTC. Conversion Decimal <-> piasters only in `@gym/db`.
- Tenancy: `gymId` comes from the JWT (`GymContextGuard`), never from the body/query. `SUPER_ADMIN` has no gym and sends `X-Gym-Id`. EVERY query filters by `gymId`; write a Prisma middleware/extension that refuses queries on tenant tables without it.
- Auth: staff = email + password (argon2), access JWT 15 min + rotating refresh token (httpOnly cookie). Members = phone + password (set by reception on first visit, resettable). Roles: `SUPER_ADMIN, GYM_ADMIN, RECEPTION, BAR_CASHIER, COACH, MEMBER`. `@Roles()` on every route; default deny.
- Validation: Zod schemas from `@gym/contracts` (one per request/response). Controllers validate and delegate; services hold Prisma + transactions; rules come from `@gym/domain`.
- Errors: `{ statusCode, code, message, details? }`. `code` is UPPER_SNAKE and is exactly the domain denial code when one exists (`PAYMENT_OVERDUE`, `COUNT_EXHAUSTED`, `ANOTHER_COACH_ON_BREAK`, `NO_OPEN_SHIFT` ...). 400 validation, 401, 403, 404, 409 state conflict, 422 business rule denied. The frontend translates `code` to Arabic; never return Arabic text.
- Transactions: every operation that moves money or changes a subscription runs in ONE `prisma.$transaction` (isolation Serializable for wallet/shift/queue/break writes, with retry on serialization failure). Money tables are append-only; fix mistakes with a reversing record.
- Idempotency: `POST /invoices`, `POST /invoices/:id/payments`, vouchers accept `Idempotency-Key`; same key + same user within 24 h returns the first result.
- Shift guard: any endpoint that creates a Payment, Invoice, Expense, CashVoucher or ServiceUsage requires `@RequireOpenShift()`; it injects the actor's open shift or fails `422 NO_OPEN_SHIFT`.
- Audit: write `AuditLog` (actor, action, entity, before/after) for: manual discount, discount approval, refund/void, wallet adjustment, freeze/unfreeze, cancel, coach transfer, price/plan edits, break approve/reject, shift close (by admin), payroll close, member block, role change.
- Pagination: `?page=1&limit=20` -> `{ items, total, page, limit }`. Sort/filter via explicit allow-listed query params.
- Time: all "today / this month / weekday" logic uses the gym's `timezone` (default Africa/Cairo) via `localParts`; never server local time.
- Jobs: `@nestjs/schedule`, each job idempotent and safe to run twice, logs counts. Jobs are listed per phase.
- Tests: for each endpoint at least one e2e test (Supertest + a test Postgres, `resetDb()` between tests) for the happy path and for each error code in its table. Unit tests stay in `@gym/domain`.
- Seeds: `packages/db/prisma/seed.ts` builds one gym with staff of every role, plans of every kind, members in every access state, so every scenario in the acceptance lists can be reproduced.

## Working agreement
Do ONLY the current phase. Finish with: what you built, how to run the tests, assumptions, rules missing from the domain, what is left out. Then stop.
