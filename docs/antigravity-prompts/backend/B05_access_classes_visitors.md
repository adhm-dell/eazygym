# B05: Access scan, attendance log, classes (reception-started), visitors

Read `B00_BACKEND_RULES.md`, schema, `@gym/domain` (`access.ts`, `class-session.ts`, `coach-ops.ts` invitations).

## Scan endpoint
`POST /access/scan` (RECEPTION, ADMIN) body `{ code | memberId | phone }`.
1. Resolve the member (code first). Not found -> 404 `MEMBER_NOT_FOUND` (still logged with `allowed=false`).
2. Build `AccessSubscription[]` with `SubscriptionsService.buildAccessInput(member)`:
   - `activated` = status not `PENDING_PAYMENT`; `frozen` = open freeze; `overdue` = `isOverdue(...)`; `sessionsLeft` from `totalSessions - usedSessions` (null if unlimited); `grantsFloorAccess` from the plan.
   - For CLASS subscriptions load the member's `SubscriptionClassSlot`s, then for today's date resolve each slot: `ClassScheduleException` (cancelled / new times) -> `todayCancelled`, `todayStartMinutes/EndMinutes`; today's `ClassSession` -> `todayRun {startedAt, endedAt}`.
3. `evaluateAccess({isBlocked, subscriptions}, now, { timeZone, classEntryMode, classEarlyMinutes, expiringSoonDays })` from gym settings.
4. Write `AccessLog` (allowed, reason, subscriptionId, scannedById) in every case. If allowed and the subscription has a **session limit** that is consumed per entry (plans with `totalSessions` and kind GYM), decrement - otherwise entry never consumes sessions (PT sessions are consumed only by coach sessions, B07).
5. Response: `{ allowed, reason, member {name, code, photo?}, subscription {kind, planName, endDate, daysLeft}, expiringSoon, nextAction }` where `nextAction` is a code (`SELL`, `COLLECT_BALANCE`, `UNFREEZE`, `RENEW`, `START_CLASS`, `NONE`) so every client shows the same button.
6. Debounce: the same member scanned again within 10 seconds returns the previous result without a new log row (`duplicate: true`).

## Classes (reception-started)
| Method + path | Roles | Notes |
|---|---|---|
| `GET/POST/PATCH /class-schedules` | ADMIN | weekly template (coach, day, start/end, capacity). Deactivate instead of delete. |
| `POST /class-schedules/:id/exceptions` | ADMIN | `{ date, isCancelled | newStartTime/newEndTime, substituteCoachId? }`. Members registered are notified. |
| `GET /classes/today` | RECEPTION, ADMIN, COACH | today's occurrences with registered members, capacity, and the `ClassSession` state (not started / running / ended). |
| `POST /classes/:scheduleId/start` | RECEPTION, ADMIN | `canStartClass` (weekday, not cancelled, once) -> creates `ClassSession` `{date, startedAt, startedById, actualCoachId?}`; denial codes `NOT_SCHEDULED_TODAY, CANCELLED_TODAY, ALREADY_STARTED`. |
| `POST /classes/:scheduleId/end` | RECEPTION, ADMIN | sets `endedAt`; further scans -> `CLASS_ENDED`. |
Members of a class can enter only after `start`, for the scheduled length counted from the real start (or until `end`). A job closes forgotten sessions: `endedAt = startedAt + length` shown as ended automatically by `evaluateAccess` anyway; the job just persists it nightly.

## Visitors (invitations)
| Method + path | Roles | Notes |
|---|---|---|
| `GET /visitors?q=` | RECEPTION, ADMIN | autocomplete by name/phone. |
| `POST /visitors` | RECEPTION, ADMIN | unique phone per gym. |
| `POST /visitors/check-in` | RECEPTION, ADMIN | body `{ visitorId, invitedByMemberId, subscriptionId }`. `canInviteVisitor({ subscriptionUsable: status ACTIVE and not frozen/overdue/pending, maxInvitations, usedInvitations })`; codes `SUBSCRIPTION_NOT_USABLE, NO_INVITATIONS_LEFT`. Increments `usedInvitations`, creates `VisitorAttendance`. Needs an open shift only if you charge for visitors (not in v1). |
| `GET /visitors/:id` | staff | visit history. |

## Acceptance (e2e) - one test per reason code
`BLOCKED, NO_SUBSCRIPTION, PENDING_PAYMENT, NOT_STARTED, FROZEN, EXPIRED, PT_EXPIRED, PAYMENT_OVERDUE, NO_SESSIONS_LEFT, NO_FLOOR_ACCESS, CLASS_NOT_TODAY, CLASS_NOT_STARTED, CLASS_ENDED, CLASS_CANCELLED, ACTIVE (+expiringSoon)`, plus: coach late scenario (denied, reception starts the class, same member allowed), timezone check (a scan at 21:30 UTC counts as the next weekday in Cairo), duplicate scan within 10 s, invitation quota.
