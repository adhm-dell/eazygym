# Architecture Rules

1. **Business rules live ONLY in `@gym/domain`** as pure functions with tests. Controllers, services, and components never re-implement a rule.
2. **API service pattern**: Load data with Prisma, call the pure domain function, persist the result. Controllers only validate (with `@gym/contracts` Zod schemas) and delegate.
3. **Transactional money movement**: Any operation that moves money (invoice + payments + wallet + subscription + commission entries) runs in ONE `prisma.$transaction` inside a service.
4. **Money representation**: Money is integer piasters in `@gym/domain` and in API/JSON payloads; Prisma uses `Decimal(12,2)`; conversion happens only at the boundary in `@gym/db`.
5. **Multi-tenancy isolation**: Every business table query is scoped by `gymId` (multi-tenant) through the guard/context, never taken from the untrusted request body.
6. **Frontend-Backend contract**: Frontends talk to the backend only through `@gym/contracts` types and one typed client in `lib/`. Until the API exists, that client reads from `@gym/mock-data`.
7. **Localization and Layout**: All user-facing text comes from `@gym/i18n` (`ar` + `en`). UI styles use RTL-safe logical CSS properties only (`ms-`, `me-`, `ps-`, `pe-`, `start`, `end`).

