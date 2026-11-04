# Phase 7 (Staff App, admin only): Commission tiers, payroll, reports, notifications

Read `00_PROJECT_RULES.md`. Phases 1-6 are done.

## Build
1. **Commission tiers:** editor with `validateTiers` errors (first tier must start at 0, no duplicates, 0-100%).
2. **Coach detail:** trainees, assignment history, commission entries per month and milestone (PENDING / EARNED / PAID / VOID) showing share, base, allocated, due date.
3. **Payroll run:** pick month, per coach: base salary, collected revenue, tier reached (`pickTier`), commissionable base, commission (`monthlyCommission`), adjustments for late payments/refunds from closed months; close run (locks it). Tooltip explaining: tier is chosen by the coach's COLLECTED revenue in the month and applies to the whole month's commissionable amount.
4. **Reports:** daily revenue by method, shift reports, expiring subscriptions, overdue balances, attendance, promotion usage, coach performance. Export CSV.
5. **Notifications center** and **audit log** viewer.

## Acceptance
- Example: PT subscription 3000 over 3 months, tier 50%: each earned month shows commission 500; if only 1500 was collected the totals are 500 + 250 + 0.
- Coach with 12,000 collected in a month where tiers are 0=40% and 10,000=50% gets 50% on the whole amount.

STOP after this phase.
