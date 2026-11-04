# B01: Foundation, auth, staff, members, wallet read, audit

Read `B00_BACKEND_RULES.md`, the schema, `@gym/domain`.

## Build
Nest bootstrap, Prisma module, config (`@gym/env`-style validation of env vars), global exception filter (error shape from B00), Zod validation pipe, Swagger at `/docs`, health `GET /health`, the guards (`JwtAuthGuard`, `RolesGuard`, `GymContextGuard`, `RequireOpenShift` stub that B06 completes), the tenant-scoping Prisma extension, `AuditService`, `NumberingService` (per-gym running invoice number, concurrency-safe), seed script.

## Endpoints
| Method + path | Roles | Notes |
|---|---|---|
| `POST /auth/login` | public | staff email+password -> access token + refresh cookie. 5 failed attempts -> 15 min lock (`ACCOUNT_LOCKED`). |
| `POST /auth/member/login` | public | member phone+password. |
| `POST /auth/refresh`, `POST /auth/logout` | any | rotate / revoke refresh token. |
| `GET /me` | any | profile + role + gym settings (timezone, classEntryMode, etc.). |
| `GET/POST/PATCH /staff` | GYM_ADMIN | create staff with role; deactivate (never delete); `baseSalary`. Cannot demote/deactivate the last GYM_ADMIN (`LAST_ADMIN`). |
| `GET/PATCH /gym/settings` | GYM_ADMIN | defaultMinUpfrontPercent, defaultDueAfterDays/Percent, classEntryMode, classCheckinEarlyMinutes, expiryNotifyDays, maxCoachBreaksPerDay, coachBreakDurationMinutes, freeSessionsOnFitnessProfile, manualDiscountLimitPercent, timezone. Validate ranges (percent 0..100, days >= 0). |
| `GET /members` | ADMIN, RECEPTION | search (name/phone/code), filters: `status` (derived access state), `planKind`, `coachId`, `expiringInDays`, `overdue=true`, `blocked`. |
| `POST /members` | ADMIN, RECEPTION | `code` auto-generated (gym-unique, 6 digits, no leading zero); `phone` unique per gym (`PHONE_EXISTS`). Creates the empty `Wallet` in the same transaction. |
| `GET /members/:id` | ADMIN, RECEPTION, COACH (only own trainees), MEMBER (self) | overview incl. wallet balance, active subscriptions, remaining balance. |
| `PATCH /members/:id` | ADMIN, RECEPTION | profile fields. |
| `POST /members/:id/block` / `unblock` | ADMIN | `reason` required; audit. |
| `POST /members/:id/set-password` | ADMIN, RECEPTION | for portal login. |
| `GET /members/:id/wallet` | ADMIN, RECEPTION, MEMBER (self) | balance + paginated `WalletTransaction`s. |
| `GET /audit` | GYM_ADMIN | filter by entity/actor/date. |

## Logic details
- Derived member "status" for the list filter is computed with `evaluateAccess` over the member's subscriptions (batch it; no N+1: load subscriptions with plan + payment totals for the page in 3 queries).
- A COACH may read only members that appear in their `CoachTrainee` rows or have an active `CoachAssignment`; a MEMBER only self. Enforce in services, not only in guards.
- Never return `passwordHash`.

## Acceptance
- Cross-tenant test: user of gym A requesting a gym B member id gets 404 (not 403).
- Duplicate phone returns 409 `PHONE_EXISTS`; a coach requesting a non-trainee member gets 403.
- Brute-force lock works; refresh rotation invalidates the old token.
