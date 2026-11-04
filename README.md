# EazyGym - Gym Management System

NestJS + Prisma + PostgreSQL. This drop contains the data model and the
business rules as **pure, tested functions** (no DB, no framework).

```
prisma/schema.prisma        full data model
src/domain/                 pure business rules (70 tests)
  access.ts                 evaluateAccess: the ONE door decision
  payments.ts               min upfront %, overdue suspension, wallet, overpayment
  freeze.ts                 per-subscription freeze limits + settlement
  commission.ts             milestones, waterfall allocation, tiers, transfer by days
  class-session.ts          reception 'start class' rules
  promotions.ts             promo codes, limits, per-item discount split
  shift.ts                  expected cash, variance, close permissions
  notifications.ts          expiry reminder thresholds + dedupe keys
```

## Business rules (as decided)

| Area | Rule |
|---|---|
| Money | Domain works in integer piasters. DB is Decimal(12,2). |
| Sales | One `Invoice` for subscriptions, services and bar products. Split payments = several `Payment` rows (cash + wallet). |
| Min upfront | Per plan (falls back to gym default). Below it the subscription stays `PENDING_PAYMENT` and cannot enter. |
| Overdue | `dueAfterDays` and/or `dueAfterPercent` of the duration. Past it with a balance => `SUSPENDED_UNPAID`. Suspended days are LOST (end date unchanged). Paying restores access. |
| Wallet | Overpayment / receipt voucher credits the wallet. Buying auto-uses the wallet up to the balance. Disbursement voucher pays it out. Never negative. |
| Freeze | Limits (count + total days) are snapshotted on the subscription when sold, admin-editable. Not allowed while overdue. Frozen days extend the end date (capped at the allowance). |
| Class plans | Default `RECEPTION_STARTS`: reception presses "Start class" (creates a `ClassSession`); members scan in only after that, for the scheduled class length from the ACTUAL start (or until reception ends it). A late coach just means a later start. Only on the member's registered weekday. Alternative `SCHEDULED` mode = fixed timetable window (+ optional early minutes). Cancelled / rescheduled occurrences handled. |
| Shifts | Every payment / invoice / expense / voucher needs an open shift. Staff close their own; admin can close any ("close all"). Expected cash = opening + cash payments + cash receipts - drawer expenses - cash disbursements. |
| Commission | Milestones generated at sale (price / N, due after each period). Collected money fills milestones in order, so partial payments and late top-ups just recompute. Tier = coach's COLLECTED revenue in the month, applied to the whole month. Finalised when the payroll run closes. |
| Transfer | Split by DAYS inside the milestone in progress; past milestones stay with the old coach; future ones move. Transfer day belongs to the new coach. |
| Tiers | Must include a 0 threshold. No hidden default percent. |

## Suggested NestJS modules

`auth, gyms, staff, members, wallet, plans, services, products, invoices (+payments),
subscriptions (+freeze), access (scan), classes, shifts, expenses, vouchers,
commissions, payroll, notifications (cron + SSE), reports, audit`

Each module = controller (HTTP) -> service (Prisma + transactions) -> `src/domain` (rules).
Services never re-implement rules; they load data, call the pure function, persist.

## Jobs (cron)
- hourly: mark overdue subscriptions `SUSPENDED_UNPAID`, expire ended ones
- hourly: unfreeze planned freezes that reached `plannedEndAt`
- daily: expiry reminders (`nextExpiryReminder`), mark commission entries `EARNED` when due
- on payment/refund: recompute `allocatedBase` for the subscription's entries

## Next steps
1. `npx prisma migrate dev` against your Postgres (+ CHECK constraint `Wallet.balance >= 0`).
2. Nest scaffold + auth/RBAC + gym-context guard.
3. Invoices/payments/wallet service (single transaction) -> subscriptions -> access scan endpoint.
4. Shifts + expenses + vouchers, then commissions + payroll.
