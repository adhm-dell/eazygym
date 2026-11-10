# EazyGym - Gym Management System

NestJS + Prisma + PostgreSQL inside a Turborepo monorepo with Next.js applications (`@gym/staff`, `@gym/coach`, `@gym/member`).
Contains the data model and all business rules as **pure, tested functions** in `@gym/domain` (no DB, no framework).

```
packages/db/prisma/schema.prisma full data model
packages/domain/src/             pure business rules (88 tests)
  access.ts                      evaluateAccess: the ONE door decision
  payments.ts                    min upfront %, overdue suspension, wallet, overpayment
  freeze.ts                      per-subscription freeze limits + settlement
  commission.ts                  milestones, waterfall allocation, tiers, transfer by days
  class-session.ts               reception 'start class' rules
  coach-ops.ts                   shifts, breaks, rotation queue, attendance, assessments
  promotions.ts                  promo codes, limits, per-item discount split
  shift.ts                       expected cash, variance, close permissions
  notifications.ts               expiry reminder thresholds + dedupe keys
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

## Go-Live Checklist & Production Setup

Follow these steps when provisioning a fresh production environment for a gym:

### 1. Configure Environment Variables
Copy `.env.example` to `.env` in the root:
```bash
cp .env.example .env
```
Ensure the following variables are set:
```env
DATABASE_URL="postgresql://postgres:<password>@<host>:5432/<database>?schema=public"
JWT_SECRET="<generate-a-strong-random-64-character-string>"
JWT_REFRESH_SECRET="<generate-another-strong-random-64-character-string>"
ALLOW_DB_RESET=false

# First Gym & Owner Bootstrap Credentials
BOOTSTRAP_GYM_NAME="اسم الجيم"
BOOTSTRAP_GYM_SLUG="gym-slug"
BOOTSTRAP_TIMEZONE="Africa/Cairo"
BOOTSTRAP_ADMIN_NAME="اسم المالك"
BOOTSTRAP_ADMIN_EMAIL="owner@yourgym.com"
BOOTSTRAP_ADMIN_PASSWORD="<strong-password-at-least-10-chars>"

# Optional Platform SuperAdmin
BOOTSTRAP_SUPER_ADMIN_EMAIL="platform@yourgym.com"
BOOTSTRAP_SUPER_ADMIN_PASSWORD="<strong-password-at-least-10-chars>"
```

### 2. Apply Database Migrations
Run Prisma migrations to initialize the schema without any demo data:
```bash
pnpm --filter @gym/db db:migrate
```

### 3. Bootstrap First Gym and Admin Account
Run the idempotent bootstrap tool:
```bash
pnpm --filter @gym/db db:bootstrap
```
This initializes exactly one gym and one admin staff account. No demo members, plans, invoices, or shifts are inserted.

### 4. First Login & Security
1. Navigate to the staff portal at `http://localhost:3000` (or your domain).
2. Login using the owner email and bootstrap password.
3. If using temporary credentials, update your password from `/staff` immediately.

### 5. Complete Owner First-Run Setup Checklist
On the Admin Dashboard (`/admin`), follow the **إعداد الجيم وتجهيز النظام** onboarding card:
- **الباقات**: Create at least 1 membership plan (`/plans`).
- **الاستقبال**: Create at least 1 reception staff account (`/staff`).
- **الكباتن**: Create coach accounts (`/staff`).
- **الورديات**: Define shift schedules for each active coach (`/coach-ops`).
- **شرائح العمولات**: Set gym commission tiers starting at 0 EGP from the Admin dashboard.
- **سياسة الدفع**: Review default upfront and due-date parameters (`/settings`).
The checklist card automatically disappears once all 6 required items are configured.

### 6. Destructive Reset & Backups Warning
> [!CAUTION]
> The command `pnpm --filter @gym/db db:reset` is **destructive** and truncates all public tables except `_prisma_migrations`.
>
> **Always backup your database before running a reset:**
> ```bash
> pg_dump "$DATABASE_URL" > backup-$(date +%s).sql
> ```
>
> Safety guards enforced by `db:reset`:
> 1. Requires `ALLOW_DB_RESET=true` in `.env`.
> 2. Requires `--confirm=<database-name>` matching the exact database name.
> 3. Refuses non-local database hosts unless `--allow-remote` is explicitly passed.

