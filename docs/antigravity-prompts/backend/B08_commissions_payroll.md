# B08: Commission milestones and payroll

Read `B00_BACKEND_RULES.md`, schema, `@gym/domain` (`commission.ts`, `money.ts`, `payments.ts`).

## Rules (decided with the owner)
- Commission only for PT subscriptions (`commissionable`).
- Milestones are generated AT SALE: price / N slices, due after each period (3000 over 3 months = 3 x 1000 due after month 1, 2, 3). Remainder piasters go to the last slice.
- Collected money fills milestones IN ORDER (waterfall) so partial and late payments are handled by recomputation: `allocatedBase`.
- Tier is picked at payroll time by the coach's COLLECTED revenue of the month and applies to the WHOLE commissionable amount of that month. Tiers must start at 0; no hidden default percent.
- A coach change splits by DAYS; the transfer day belongs to the new coach; past milestones stay.
- A freeze moves not-yet-due milestones forward by the frozen days.
- Money for the tier = sum of `PaymentAllocation.amount` of the coach's PT items in the month (refunds negative).

## Service API used by other modules
- `generateMilestones(tx, subscription)` -> `buildMilestones` -> one `CommissionEntry` per milestone (`shareBps=10000`, status PENDING, coach = initial coach).
- `recomputeAllocation(tx, subscriptionId)` : `collected = sum(allocations of the item)`; `allocateCollected(collected, milestones)`; update each entry's `allocatedBase` (all coach rows of the same milestone share one `allocatedBase`). Called after every payment, refund, void.
- `shiftPendingMilestones(tx, subscriptionId, freezeDays)`; `voidUnearned(tx, subscriptionId)` on cancel/void (entries not in a closed payroll -> VOID; already PAID stay and a negative ADJUSTMENT is raised next payroll if the allocated base dropped).
- Transfer is performed by B04 `change-coach` using `splitOnTransfer`.

## Tiers
`GET/PUT /commission-tiers?coachId=` (GYM_ADMIN). `PUT` replaces the list atomically and runs `validateTiers` (`NO_TIERS_CONFIGURED, TIERS_MUST_START_AT_ZERO, DUPLICATE_TIER_THRESHOLD, PERCENT_OUT_OF_RANGE`). A coach with his own tiers uses them, else the gym default (`coachId = null`).

## Payroll run (per month, gym timezone)
| Method + path | Roles | Notes |
|---|---|---|
| `POST /payroll/runs` | GYM_ADMIN | `{ year, month }` -> creates a DRAFT and calculates. Unique per gym/month (`RUN_EXISTS`). |
| `POST /payroll/runs/:id/recalculate` | GYM_ADMIN | DRAFT only; rebuilds all lines. |
| `GET /payroll/runs/:id` | GYM_ADMIN | lines grouped by staff with the numbers used. |
| `POST /payroll/runs/:id/lines` | GYM_ADMIN | manual BONUS / DEDUCTION with description (DRAFT only). |
| `POST /payroll/runs/:id/close` | GYM_ADMIN | fails if an earlier month is still DRAFT (`PREVIOUS_RUN_OPEN`). Freezes entries and locks the run. |
| `GET /me/commission?month=` | COACH | own numbers, read only (entries per milestone, tier progress to the next tier). |
| `GET /coaches/:id/commission?month=` | GYM_ADMIN | same for any coach. |

Calculation, per active staff member:
1. `BASE_SALARY` line = `Staff.baseSalary` (if > 0).
2. For COACHes: `collectedRevenue` = sum of allocations with `coachId` in `[monthStart, monthEnd]`. `tier = pickTier(tiersForCoach, collectedRevenue)`.
3. Entries included: `coachId = coach`, not VOID, `payrollRunId = null`, `dueDate <= monthEnd` (a milestone missed in an earlier month is picked up here). `monthlyCommission({ entries: [{allocatedBase, shareBps}], tier })` -> one `COMMISSION` line (stores `collectedRevenue`, `tierPercent`).
4. **Adjustments:** for entries already PAID in a closed run whose current `percentOf(bpsOf(allocatedBase, shareBps), frozenTierPercent)` differs from the frozen `amount` (late payment, refund) -> `ADJUSTMENT` line with the signed difference; update the entry's `amount`.
5. Manual BONUS/DEDUCTION lines are preserved on recalculate.
On `close`: each included entry gets `status = PAID`, `tierPercent`, `amount`, `payrollRunId`; run `CLOSED`, `closedAt/closedById`; audit.

## Jobs
- daily 00:10 (gym tz): `PENDING` entries with `dueDate <= now` -> `EARNED` (notify the coach `MILESTONE_EARNED`, informational).

## Acceptance (e2e) - use exact numbers
- PT 3000 / 3 months, fully collected, tier 50%: three payrolls give 500 each.
- Only 1500 collected: month 1 = 500, month 2 = 250, month 3 = 0; then the member pays the rest: next payroll shows ADJUSTMENT lines (+250 and +500).
- Tiers 0 -> 40%, 10,000 -> 50%; coach collected 12,000 in the month: 50% on the WHOLE commissionable amount; 9,999.99 -> 40%.
- No tiers -> `NO_TIERS_CONFIGURED`; tiers without 0 -> `TIERS_MUST_START_AT_ZERO`.
- Transfer in the middle of month 2: old coach gets month 1 + his day share of month 2, new coach the rest + month 3; shares sum to 10000 bps.
- Freeze of 10 days moves pending due dates by 10 days; refund lowers `allocatedBase` from the LAST milestone first.
- Closing March while February is DRAFT -> `PREVIOUS_RUN_OPEN`; a closed run cannot be recalculated.
