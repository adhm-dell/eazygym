# B02: Plans, services, products, promotions

Read `B00_BACKEND_RULES.md`, schema, `@gym/domain` (`promotions.ts`, `payments.ts`).

## Endpoints
| Method + path | Roles | Notes |
|---|---|---|
| `GET /plans` | all staff, MEMBER | `?kind=&active=`. |
| `POST/PATCH /plans`, `POST /plans/:id/archive` | GYM_ADMIN | Plans are never deleted once sold; archive hides them. Editing a plan does NOT change existing subscriptions (they hold snapshots). |
| `GET/POST/PATCH /services`, `/products` | ADMIN (write), staff (read) | Product stock decrements on sale; service has no stock. |
| `GET/POST/PATCH /promotions`, `POST /promotions/:id/deactivate` | GYM_ADMIN | with `planIds[]`, `itemKinds[]`. |
| `POST /promotions/preview` | ADMIN, RECEPTION, BAR_CASHIER | body `{ items[], memberId?, code? }` -> `evaluatePromotion` result with per-item split, or `422` with the denial reason. Reads redemption counts. |
| `GET /promotions/:id/usage` | ADMIN | redemptions count + total discount. |

## Validation (reject with 400 `INVALID_PLAN` and a `details.fields` list)
- GYM: `durationDays > 0`, `price >= 0`. PT: `commissionable = true` by default, `commissionMilestones` between 1 and `ceil(durationDays/30)`, `grantsFloorAccess = false` by default. CLASS: `sessionsPerWeek >= 1`.
- `freezeMaxCount >= 0`, `freezeMaxTotalDays >= 0`; if one is 0 the other must be 0 (freeze disabled).
- `minUpfrontPercent` 0..100 (null = gym default); `dueAfterDays >= 0`; `dueAfterPercent` 0..100.
- Promotion: PERCENT value 0..100; FIXED value > 0; `endsAt > startsAt`; code unique per gym (case-insensitive); `maxUses`, `perMemberLimit` > 0 when set.

## Logic details
- Redemption counting: total = `PromotionRedemption` rows for the promotion; per member = rows with that `memberId`. The row is created by B03 inside the invoice transaction; voiding an invoice deletes its redemption.
- Included services of a plan (`PlanService`) are copied as entitlements at sale time by B04.

## Acceptance
- Creating a PT plan with `commissionMilestones` > months returns 400.
- Preview with an expired / wrong-code / limit-reached promotion returns 422 with the exact domain code.
- Editing a plan price does not change an existing subscription's price.
