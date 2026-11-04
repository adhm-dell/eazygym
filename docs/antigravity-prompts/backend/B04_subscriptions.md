# B04: Subscriptions (activation, overdue, freeze, renew, cancel, bundles, invitations)

Read `B00_BACKEND_RULES.md`, schema, `@gym/domain` (`payments.ts`, `freeze.ts`, `access.ts`, `commission.ts`, `time.ts`).

## Service API used by other modules (not HTTP)
- `createFromItem(tx, { invoice, item, member, options })`
- `recompute(tx, subscriptionIds)` : re-derive `status` from facts (called after any payment/refund/freeze/cancel and by the jobs).
- `buildAccessInput(member)` : maps DB rows to `AccessSubscription[]` for `evaluateAccess` (B05).

## createFromItem
1. Snapshot from the plan: `kind, price(net of discount), durationDays, totalSessions, freeze limits (admin may override per sale), minUpfrontPercent (plan ?? gym default), dueAfterDays/Percent (plan ?? gym default), commissionMilestones, maxInvitations, freePtSessions`.
2. **Start date:** `startDate` from the request, else today (gym tz). **Early renewal:** if the member already has a non-cancelled subscription of the same `kind` (and same coach for PT) whose `endDate` is later than the requested start, the new subscription starts the moment the old one ends (no overlap, no lost days). Two consecutive renewals chain (start after the LAST end).
3. `endDate = startDate + durationDays` at end of the gym-local day. `originalEndDate = endDate`.
4. **Activation:** `activationDecision({ total: price, collected: allocated money, minUpfrontPercent })`. Met -> `ACTIVE` + `activatedAt`; else `PENDING_PAYMENT` (cannot enter; shows shortfall). A subscription with a future `startDate` is `ACTIVE` but `evaluateAccess` returns `NOT_STARTED` until then.
5. **Bundles:** items sold together (e.g. GYM + PT in one invoice) share a `bundleId`; each is an independent subscription with its own price share (from the discount split) and its own activation check on ITS allocated collected money.
6. **PT:** requires `coachId` (active COACH of the gym); create `CoachAssignment(fromDate=startDate)`; ensure a `CoachTrainee` row; call B08 `generateMilestones`; set `totalSessions`. If `freePtSessions > 0` add that count to `CoachTrainee.freeSessionsGranted`.
7. **CLASS:** requires `classSlotIds` (count = plan `sessionsPerWeek`, all active, capacity not exceeded -> `CLASS_FULL`); create `SubscriptionClassSlot` rows.
8. **First subscription ever for the member** -> call B07 `FitnessProfileService.createIfFirst` (creates the profile and triggers a rotation recommendation for PT/GYM members as configured in B07).
9. Included services (`PlanService`) become service entitlements (decremented through `ServiceUsage`).

## Status machine (`recompute`) - derived from facts, order matters
`CANCELLED` (cancelledAt set) > `PENDING_PAYMENT` (activation not met) > `FROZEN` (open freeze) > `EXPIRED` (`now > endDate`) > `SUSPENDED_UNPAID` (`isOverdue(...)` using ALLOCATED collected money, `startDate`, `durationDays`, due policy) > `ACTIVE`.
- Suspended days are LOST: `endDate` is never extended for an unpaid suspension. Paying the balance returns the subscription to `ACTIVE` immediately.
- Frozen wins over expired (the end date moves when the freeze ends).

## Endpoints
| Method + path | Roles | Notes |
|---|---|---|
| `GET /subscriptions` | ADMIN, RECEPTION | filters: status, kind, memberId, coachId, expiringInDays, overdue. |
| `GET /members/:id/subscriptions` | staff, coach(own), MEMBER(self) | each with `collected`, `remaining`, `balanceDueDate`, `daysLeft`, `sessionsLeft`, freeze allowance left. |
| `POST /subscriptions/:id/freeze` | ADMIN, RECEPTION, MEMBER(self) | body `{ days?, startsAt? }`. Uses `canFreeze` with remaining count/days; denial codes: `FREEZE_NOT_ALLOWED, ALREADY_FROZEN, NOT_ACTIVE, PAYMENT_OVERDUE, COUNT_EXHAUSTED, DAYS_EXHAUSTED, REQUEST_EXCEEDS_REMAINING`. Creates `SubscriptionFreeze`, `freezeUsedCount += 1` at start. If `days` is given, `plannedEndAt = startsAt + days` and the job auto-ends it; else open-ended (capped at remaining days by the job). |
| `POST /subscriptions/:id/unfreeze` | same | `settleFreeze` -> `days` (overflow lost), `freezeUsedDays += days`, `endDate = endDateAfterFreeze`. B08 `shiftPendingMilestones` moves not-yet-due milestones by the same days. Status recomputed. |
| `POST /subscriptions/:id/cancel` | ADMIN | reason required; refund is a separate B03 call. Commission entries not yet earned -> VOID (B08). |
| `POST /subscriptions/:id/renew` | ADMIN, RECEPTION | convenience: builds the invoice for the same plan using the early-renewal rule (same body as B03 with the plan preselected). |
| `POST /subscriptions/:id/change-coach` | ADMIN | PT only. Body `{ newCoachId, effectiveAt?, reason }`. See below. |
| `POST /subscriptions/:id/log-session` | COACH(own), ADMIN | PT: decrement `totalSessions` left (`usedSessions += 1`), `NO_SESSIONS_LEFT` when none. Prefer going through B07 coach sessions; this is the quick path and creates a completed `CoachSession`. |

## change-coach (one transaction)
1. Reject if `newCoachId` is the current coach or not an active COACH (`INVALID_COACH`).
2. `effectiveAt` defaults to now (gym tz). Close the current `CoachAssignment.toDate = effectiveAt`; open the new one.
3. B08 `splitOnTransfer` over this subscription's current-holder commission entries using `@gym/domain` `splitOnTransfer` (by DAYS; the transfer day belongs to the new coach). Write rows: old coach keeps `oldKeepsBps`; new coach gets `newGetsBps` (new `CommissionEntry` with same milestone fields; status mirrors the milestone). Entries already `PAID` are untouched.
4. Future `PaymentAllocation.coachId` for this item switches to the new coach from now on.
5. Update `CoachTrainee` (old: `endDate`, `isActive=false` if no other active assignment; new: ensure active). Notify both coaches and the member. Audit.

## Invitations
`usedInvitations` is incremented by B05 visitor check-in; here only the snapshot `maxInvitations` is set.

## Jobs (hourly, idempotent)
- `subscriptions.recomputeAll`: recompute status for subscriptions whose derived status changed (use indexed queries: `endDate < now`, overdue candidates by `dueDate`), writes `SUSPENDED_UNPAID` / `EXPIRED`, emits notifications `PAYMENT_OVERDUE` (member + admin broadcast) and `SUBSCRIPTION_EXPIRED`.
- `freezes.autoEnd`: end freezes with `plannedEndAt <= now`, and open-ended freezes that reached their allowance.

## Acceptance (e2e)
- Plan 3 months, min upfront 50%, due after 50% of duration: pay 49% -> `PENDING_PAYMENT`; pay 50% -> `ACTIVE`; day 46 with balance -> `SUSPENDED_UNPAID` and scan denied `PAYMENT_OVERDUE`; pay the rest -> `ACTIVE`, `endDate` unchanged.
- Freeze 15 days over 2 times: first 10 days ok; second request of 6 days -> `REQUEST_EXCEEDS_REMAINING`; a third freeze -> `COUNT_EXHAUSTED`; an overdue member -> `PAYMENT_OVERDUE`.
- Early renewal starts on the old end date; two renewals chain.
- Change coach mid-month 2 of a 3-month PT: month 1 stays with the old coach, month 3 moves, month 2 splits by days; shares per milestone sum to 10000 bps.
- Bundle GYM + PT with only enough money for the GYM item: GYM ACTIVE, PT `PENDING_PAYMENT`.
