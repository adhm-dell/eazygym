# Phase 3 (Staff App): Sell (POS), payments, wallet, promotions at checkout

Read `00_PROJECT_RULES.md`. Phases 1-2 are done.

## Build
One **Sell** screen that produces one Invoice with any mix of: subscriptions, services, bar products.
1. Item picker: plan (with start date; coach picker for PT; class slot picker for CLASS; freeze limits prefilled from the plan and editable by an admin), services, products. Cart on the side.
2. **Discount:** promotion by code or pick (`evaluatePromotion`, show the denial reason in Arabic if not applicable) or a manual discount (needs a note and permission, `validateManualDiscount`). One promotion per invoice. Show the per-item split.
3. **Payment panel:** several payment rows (cash / instapay / card / wallet) summing to the amount; wallet is auto-suggested up to the balance (`planWalletUse`); anything paid above the total is credited to the wallet with a clear message (`settleTender`).
4. **Activation rules:** `activationDecision` against the plan's (or gym's) min upfront percent. If not met, show the shortfall and block activation. Show `balanceDueDate` when a balance remains and explain that unpaid subscriptions get suspended after it.
5. **Collect balance** on an existing invoice, **Receipt voucher (سند قبض)** and **Disbursement voucher (سند صرف)** (optionally credited to / paid out from the wallet). All need an open shift.
6. Invoice view and print layout (80mm receipt and A4).
7. Mock data additions: Service, Product, Promotion (active, expired, code-only, limited, per-member), Wallet transactions, vouchers.

## Acceptance
- Sell a 3-month PT subscription with a promotion, paying part cash + part wallet, leaving a balance: totals, wallet balance and remaining amount are all correct.
- Pay 49% when the minimum is 50%: activation is blocked with the exact shortfall.
- Overpay: the excess shows up in the member's wallet.
- No arithmetic uses floats.

STOP after this phase.
