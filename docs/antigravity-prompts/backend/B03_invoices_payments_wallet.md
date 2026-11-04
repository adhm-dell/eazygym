# B03: Invoices, payments, wallet, vouchers, refunds

Read `B00_BACKEND_RULES.md`, schema, `@gym/domain` (`money.ts`, `payments.ts`, `promotions.ts`, `shift.ts`).

This is the heart of the system. Money tables are append-only. Cash-affecting calls need an open shift.

## Endpoints
| Method + path | Roles | Notes |
|---|---|---|
| `POST /invoices` | ADMIN, RECEPTION, BAR_CASHIER (bar: only SERVICE/PRODUCT items) | Create invoice + subscriptions + first payments atomically (see steps). `Idempotency-Key`. |
| `GET /invoices`, `GET /invoices/:id` | staff; MEMBER (own) | with items, payments, remaining, promotion. |
| `POST /invoices/:id/payments` | ADMIN, RECEPTION, BAR_CASHIER | collect a later payment (balance). |
| `POST /invoices/:id/approve-discount` | GYM_ADMIN | approve/reject a pending manual discount (reject = admin must edit via void + re-sell). |
| `POST /invoices/:id/void` | GYM_ADMIN | reason required; reverses everything (see Refund). |
| `POST /invoices/:id/refund` | GYM_ADMIN | partial/full refund of a payment, reason required. |
| `POST /members/:id/wallet/topup` | ADMIN, RECEPTION | receipt voucher (سند قبض) credited to wallet. |
| `POST /members/:id/wallet/payout` | ADMIN, RECEPTION | disbursement voucher (سند صرف) pays balance out in cash. |
| `POST /members/:id/wallet/adjust` | GYM_ADMIN | signed amount + note, audit. |
| `POST /vouchers/receipt`, `/vouchers/disbursement` | ADMIN, RECEPTION | standalone vouchers (not tied to a member), cash affecting. |

## Create invoice: request
```
{ memberId?, items: [ { kind: SUBSCRIPTION|SERVICE|PRODUCT, planId?|serviceId?|productId?, quantity,
    subscription?: { startDate?, coachId?, classSlotIds?, freezeMaxCount?, freezeMaxTotalDays?, bundleId? } } ],
  promotionCode? | promotionId?, manualDiscount?: { amount, note },
  payments: [ { method: CASH|INSTAPAY|CARD|WALLET, amount, reference? } ],
  useWallet?: boolean (default true when member has balance) }
```

## Steps (single serializable transaction)
1. `requireOpenShift`. Load plans/services/products (this gym, active). Walk-in (no `memberId`) may buy only SERVICE/PRODUCT (`MEMBER_REQUIRED`).
2. Price each item (`unitPrice * quantity`); subscription price = plan price (admin may override price only if role GYM_ADMIN, audited).
3. Discount: if `promotion*` given -> `evaluatePromotion` (counts from DB) else 422 with its code; if `manualDiscount` -> `validateManualDiscount`; a manual discount above `Gym.manualDiscountLimitPercent` (default 0 = every manual discount by non-admin needs approval) is allowed for GYM_ADMIN directly; for others the invoice is created with `discountApprovedById = null` (pending, flagged on the admin dashboard) and `POST /invoices/:id/approve-discount` (GYM_ADMIN) sets it. Only ONE of promotion / manual. Split the discount across items with `perItem`; item `total` = after discount. `invoice.total` = sum of item totals.
4. Payments: total of `payments[]` plus wallet use. If `useWallet` and member has balance, `planWalletUse` adds a WALLET payment first (up to the remaining due). `settleTender`: anything tendered above the total becomes a wallet credit (`WalletTransaction OVERPAYMENT`) - not change. Wallet debit via `applyWalletDelta` (fails `INSUFFICIENT_WALLET_BALANCE`). Each payment row gets `shiftId`, `receivedById`.
5. For each payment create `PaymentAllocation` rows over the invoice items using `allocateAcrossItems` (pro rata by item total); set `coachId` on rows of a PT item to the subscription's coach.
6. Create the invoice (number from `NumberingService`), items, payments, allocations, wallet transactions, `PromotionRedemption`. `status = PAID` if collected >= total else `OPEN`.
7. For each SUBSCRIPTION item call the B04 `SubscriptionsService.createFromItem(tx, ...)` (activation rule, dates, milestones, free sessions, fitness profile). It returns `PENDING_PAYMENT` or `ACTIVE`.
8. Decrement product stock (`OUT_OF_STOCK` if insufficient). Create `ServiceUsage` for SERVICE items (entrance, sauna...).
9. Audit if manual discount. Return the full invoice.

## Collect later payment
`POST /invoices/:id/payments` body `{ payments[] }`: same payment/allocation logic; then call `SubscriptionsService.recompute(tx, subscriptionIds)` which (a) re-evaluates activation (`PENDING_PAYMENT -> ACTIVE` if the minimum is now met) and (b) lifts `SUSPENDED_UNPAID` if the balance is settled, and `CommissionService.recomputeAllocation` (B08). Overpaying the remaining credits the wallet.

## Refund / void
Create NEGATIVE `Payment` rows (same method; CASH needs an open shift and reduces expected cash) with NEGATIVE allocations, wallet refund as `WalletTransaction REFUND` if refunded to wallet. Void: all payments reversed, invoice `VOID`, subscriptions `CANCELLED` (B04), commission entries `VOID` (B08), product stock restored, redemption removed. Refund amount cannot exceed collected (`REFUND_EXCEEDS_COLLECTED`).

## Vouchers
Receipt to wallet: `CashVoucher RECEIPT` + `WalletTransaction TOPUP` (+). Payout: `CashVoucher DISBURSEMENT` + `WalletTransaction PAYOUT` (-), fails if balance too small. Both need an open shift and `method` != WALLET.

## Invariants (enforce with DB constraints + tests)
- `Wallet.balance >= 0` (CHECK constraint); `Wallet.balance = sum(WalletTransaction.amount)`.
- For each invoice: `sum(PaymentAllocation.amount) = sum(Payment.amount)` (excluding WALLET overpayment credits, which are not payments).
- A closed shift's totals never change (payments cannot be attached to a closed shift).

## Acceptance (write these as e2e tests)
- Sell PT 3000 with 10% promotion, pay 800 cash + 500 wallet: total 2700, collected 1300 (48%) -> min upfront 50% not met -> subscription `PENDING_PAYMENT`; pay 100 more -> `ACTIVE`.
- Tender 1000 on a 800 invoice: 200 lands in the wallet.
- Wallet 100, invoice 300, `useWallet` true: 100 from wallet, 200 due.
- Double submit with the same `Idempotency-Key` creates one invoice.
- Void after a cash payment: expected cash of the shift decreases by the refunded cash; second void -> 409.
