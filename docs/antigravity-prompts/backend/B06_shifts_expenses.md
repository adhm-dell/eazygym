# B06: Shifts, cash drawer, expenses

Read `B00_BACKEND_RULES.md`, schema, `@gym/domain` (`shift.ts`).

## Rules
- Each RECEPTION / BAR_CASHIER has their own shift; one OPEN shift per staff member (`SHIFT_ALREADY_OPEN`). ADMIN can open one too (admin selling at the desk).
- Everything cash-affecting (invoice, payment, voucher, expense, service usage) attaches to the actor's open shift (`RequireOpenShift`, 422 `NO_OPEN_SHIFT`). A closed shift never changes again.
- Operational expenses paid from reception reduce THAT shift's expected cash.

## Endpoints
| Method + path | Roles | Notes |
|---|---|---|
| `POST /shifts/open` | RECEPTION, BAR_CASHIER, ADMIN | `{ openingCash }` >= 0. |
| `GET /shifts/current` | same | live summary (below). |
| `POST /shifts/:id/close` | owner or ADMIN | `{ countedCash, note? }`. `canCloseShift` -> `ALREADY_CLOSED`, `NOT_OWNER`. Freezes `expectedCash`, `countedCash`, `variance` (= counted - expected), `closedAt`, `closedById`. If an ADMIN closes someone else's shift, audit it. |
| `POST /shifts/close-all` | GYM_ADMIN | `{ note }`; closes every OPEN shift of the gym. Admin has no physical count, so `countedCash = null`, `variance = null`, note stored; the report shows "closed by admin, not counted". Returns the list. |
| `GET /shifts` | ADMIN | filters: staff, date range, status, `hasVariance`. |
| `GET /shifts/:id/report` | ADMIN, owner | full breakdown + records list, printable. |
| `POST /expenses` | RECEPTION, BAR_CASHIER, ADMIN | `{ category, amount > 0, description?, paidFromDrawer = true }`; needs open shift. |
| `GET /expenses` | ADMIN (all), staff (own shift) | filter by shift/day/category. |
| `POST /expenses/:id/void` | GYM_ADMIN | reason required; sets `voidedAt/voidReason`, never deletes; if the shift is already closed the closed totals stay as they were and the void is applied to the day report as a correction line. |

## Shift summary (also used by the report)
```
openingCash
+ cashPayments        = sum(Payment.amount where method=CASH and shiftId)  (refunds are negative rows)
+ cashReceiptVouchers = sum(CashVoucher RECEIPT, method=CASH)
- expensesFromDrawer  = sum(Expense where paidFromDrawer and not voided)
- cashDisbursements   = sum(CashVoucher DISBURSEMENT, method=CASH)
= expectedCash   (use @gym/domain expectedCash)
other methods shown separately and NEVER in expectedCash: INSTAPAY, CARD, WALLET totals, and wallet credits created.
```
Also: invoices count, sales by kind (subscriptions / services / products), discounts given, refunds.

## Jobs
- every 30 min: shifts open longer than 14 h -> notify admins (`SHIFT_OPEN_TOO_LONG`).

## Acceptance (e2e)
- Opening 500, cash sales 2000, receipt 300, expense 150, disbursement 100 -> expected 2550; counted 2500 -> variance -5000 piasters (shortage).
- Payment by instapay 1000 does not change expected cash.
- Reception B cannot close reception A's shift (`NOT_OWNER`); admin can; close-all closes both and sets counted null.
- Creating an expense or payment after closing -> 422 `NO_OPEN_SHIFT`.
- Voided expense is excluded from expected cash of an open shift.
