# Phase 5 (Staff App): Members and subscription management

Read `00_PROJECT_RULES.md`. Phases 1-4 are done.

## Build
1. **Members list:** filters (status, plan kind, coach, expiring in N days, overdue), search, quick actions.
2. **Member profile tabs:** Overview, Subscriptions, Invoices & payments, Wallet, Attendance, Freeze history, Notes.
3. **Freeze / unfreeze:** dialog driven by `canFreeze` (shows remaining count and days, denial reasons in Arabic), `settleFreeze` result on unfreeze (days added to the end date, overflow days lost).
4. **Subscription actions:** renew (early renewal starts after the current end), cancel (reason), change coach (dialog showing how each milestone is split by days via `splitOnTransfer`), log a PT session.
5. **Overdue / suspended view:** list with due date and balance, collect-balance shortcut.
6. **Visitor invitations:** from a member profile, check in a visitor (autocomplete by name/phone, create visitor inline); shows invitations used / allowed, denial codes `NO_INVITATIONS_LEFT`, `SUBSCRIPTION_NOT_USABLE`.
7. Create/edit member (code generation, phone unique, block with reason).

## Acceptance
- Freeze 15 days over 2 times: third freeze and over-allowance requests are denied with the right message; an overdue member cannot freeze.
- Changing coach in the middle of month 2 shows month 1 for the old coach, month 3 for the new, month 2 split by days, and the numbers add up to 100%.

STOP after this phase.
