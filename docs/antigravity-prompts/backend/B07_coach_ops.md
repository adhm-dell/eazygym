# B07: Coach operations: working shifts, breaks, rotation queue, fitness profile, trainees, sessions

Read `B00_BACKEND_RULES.md`, schema, `@gym/domain` (`coach-ops.ts`, `access.ts`). All rules below are implemented in `coach-ops.ts` (88 tests); call them.

## 1. Coach working shifts
`GET/POST/PATCH/DELETE(deactivate) /coach-shifts` (ADMIN write; COACH read own). A row = weekday the shift STARTS + `HH:MM` start/end; `start > end` = overnight. Validate `HH:MM`, no overlap of the same coach. `GET /coaches/on-shift` returns `coachIdsOnShift(now, gymTz)`.

## 2. Coach breaks (request / approve workflow)
Limits come from gym settings: `maxCoachBreaksPerDay` (default 2), `coachBreakDurationMinutes` (default 30). Only ONE coach may be on an ACTIVE break in the gym at a time.
| Method + path | Roles | Logic |
|---|---|---|
| `GET /coach-breaks?coachId=` | ADMIN, RECEPTION, COACH(own) | history + the current active break. |
| `POST /coach-breaks` | COACH (self), RECEPTION, ADMIN | body `{ coachId, reason? }`. Serializable tx. Inputs for `canRequestBreak`: role, coach on shift (`isOnShift` with gym tz), coach has ACTIVE break, any OTHER coach ACTIVE, today's count of the coach's breaks whose status passes `countsTowardDailyLimit` (rejected ones do NOT count), `maxPerDay`. Denial codes: `COACH_CAN_ONLY_REQUEST_FOR_SELF, NOT_ON_SHIFT, COACH_ALREADY_ON_BREAK, ANOTHER_COACH_ON_BREAK, DAILY_LIMIT_REACHED`. Status = `initialBreakStatus(role)`: coach -> `PENDING` (notify `ADMIN_BROADCAST` "BREAK_REQUESTED"), reception/admin -> `ACTIVE` with `startedAt = now`. |
| `POST /coach-breaks/:id/approve` | ADMIN, RECEPTION | `canApproveBreak` (re-checks that nobody else is ACTIVE). `ACTIVE`, `startedAt = now`, notify the coach `BREAK_APPROVED`. |
| `POST /coach-breaks/:id/reject` | ADMIN, RECEPTION | `{ reason }` required. `REJECTED`, notify coach `BREAK_REJECTED` with the reason. |
| `POST /coach-breaks/:id/end` | ADMIN, RECEPTION, COACH(own) | `COMPLETED`, `endedAt`, `endedById`. `NOT_ACTIVE` if not active. |
| `POST /coach-breaks/notify-return` | ADMIN, RECEPTION | `{ coachId }` -> notification `BREAK_INTERRUPT` ("please return to reception"). |
**Monitor job (every minute):** for each ACTIVE break, `isBreakOverdue({startedAt, now, maxMinutes})` (measured from `startedAt`, NOT from creation) and `shouldNotifyOverdue({lastNotifiedAt})` (repeat every 15 min) -> notify the coach (`BREAK_EXCEEDED`) and `ADMIN_BROADCAST`; store `lastOverdueNotifiedAt`.
While a coach is on break he is excluded from the rotation queue (below).

## 3. Rotation queue + fitness profile (assigning new members to coaches)
Trigger: on a member's FIRST subscription ever (B04) -> `FitnessProfileService.createIfFirst(memberId, subscriptionId)` creates the `FitnessProfile` (once per member) and calls `triggerRotation(profileId)`.
`triggerRotation`:
1. Gather active COACH staff; for each: `onShift` (`isOnShift`, gym tz), `onBreak` (ACTIVE break), plus `rejectedCoachIds` = coaches who REJECTED an assignment of THIS profile, plus the gym's `CoachRotationQueue`.
2. `recommendCoach(...)`: eligible = active, not on break, not rejected before; prefer coaches on shift; a coach missing from the queue goes first; else lowest `position`; fallback to eligible coaches off shift when nobody is on shift.
3. No coach -> no assignment, notify `ADMIN_BROADCAST` `NO_COACH_AVAILABLE` (reception then assigns manually).
4. Else create `FitnessProfileAssignment { source: ROTATION, status: PENDING, coachId }`, `moveToBack(queue)` immediately (persist positions), notify the coach `NEW_MEMBER_ASSIGNMENT`.
| Method + path | Roles | Logic |
|---|---|---|
| `GET /fitness-assignments?status=pending` | COACH (own), ADMIN, RECEPTION | pending list. |
| `POST /fitness-assignments/:id/accept` | COACH (own assignment) | must be `PENDING` (`NOT_PENDING`), must be his (`NOT_YOUR_ASSIGNMENT`). Status `ACCEPTED`, `respondedAt`; create/activate `CoachTrainee` and add `Gym.freeSessionsOnFitnessProfile` (default 1) to `freeSessionsGranted`; notify reception. |
| `POST /fitness-assignments/:id/reject` | COACH (own) | `{ reason }` required. Status `REJECTED`; then run `triggerRotation` again automatically (the rejecting coach is now excluded for this profile). |
| `POST /fitness-profiles/:id/assign` | RECEPTION, ADMIN | `{ coachId }` manual choice: all PENDING assignments of the profile become `SUPERSEDED`; create `MANUAL` assignment already `ACCEPTED`; same CoachTrainee + free sessions; `moveToBack` for that coach. |
| `GET/PATCH /members/:id/fitness-profile` | COACH(trainee), ADMIN, RECEPTION | goals, medicalConditions, injuries, previousGymExperience, notes. |
| `GET/POST /members/:id/assessments` | COACH(trainee), ADMIN, RECEPTION | `metrics` validated with Zod: weight, bodyFatPercent, muscleMass, waterPercent, visceralFatLevel, bmr, notes; history ordered by date. |
`GET/PUT /coach-rotation-queue` (ADMIN) to view/reorder the queue.

## 4. Trainees
`GET /coaches/:id/trainees` (COACH own, ADMIN): for each active trainee: member, PT subscription status, `sessionsLeft`, `daysLeft`, free sessions left, last attendance, pending balance flag. `PATCH /coach-trainees/:id` deactivate/reactivate (ADMIN).
The old per-trainee `commissionRate` / `fixedSalary` are NOT carried over: commission is governed by B08 tiers and base salary by `Staff.baseSalary`.

## 5. Coach sessions (private PT / group)
| Method + path | Roles | Logic |
|---|---|---|
| `POST /coach-sessions` | COACH(own), ADMIN, RECEPTION | `{ coachId, type, startTime, endTime, capacity? (GROUP) }`; coach must not have an overlapping session. |
| `POST /coach-sessions/:id/participants` | same | `{ memberId, source, subscriptionId? }` -> `canAddParticipant` with capacity, current count, `ptSessionsLeft` (`totalSessions - usedSessions`), `freeSessionsLeft` (`granted - used`). Codes: `ALREADY_IN_SESSION, SESSION_FULL, SUBSCRIPTION_REQUIRED, NO_PT_SESSIONS_LEFT, NO_FREE_SESSIONS_LEFT`. The subscription must be the member's, PT kind, ACTIVE and with this coach. |
| `POST /coach-sessions/:id/attendance` | COACH(own), ADMIN, RECEPTION | `{ attendedMemberIds[] }`. ONE transaction: `consumptionOnAttendance` -> `usedSessions += n` on PT subscriptions (never beyond total), `freeSessionsUsed += n` on `CoachTrainee`, set `attended = true`, session `COMPLETED`. Idempotent: participants already attended are not charged twice. No-shows are NEVER charged. |
| `POST /coach-sessions/:id/no-show` | same | nobody attended -> status `NO_SHOW`, no deductions. |
| `POST /coach-sessions/:id/cancel` | same | status `CANCELLED`, participants notified. |
| `GET /coach-sessions?coachId=&date=` | COACH(own), staff | calendar. |
GROUP sessions tied to a class: when reception starts a class (B05), create (or reuse) the `CoachSession` GROUP for that schedule/date with the registered members as `CLASS_LINKED` participants; when the class ends mark `attended` = members who had an allowed scan during the class window. CLASS_LINKED never deducts sessions (class subscriptions are time-based).
The quick path `POST /subscriptions/:id/log-session` (B04) creates a completed private session with that single participant.

## Notifications raised here
`BREAK_REQUESTED, BREAK_APPROVED, BREAK_REJECTED, BREAK_INTERRUPT, BREAK_EXCEEDED, NEW_MEMBER_ASSIGNMENT, NO_COACH_AVAILABLE, ASSIGNMENT_ACCEPTED, ASSIGNMENT_REJECTED, SESSION_CANCELLED`.

## Acceptance (e2e)
- Coach requests a break while off shift -> `NOT_ON_SHIFT`; on shift -> PENDING + admin broadcast; admin approves -> ACTIVE; a second coach requests -> `ANOTHER_COACH_ON_BREAK`; third request of the same coach in a day (max 2, one rejected) counts correctly.
- Overnight shift 21:00-05:00: break allowed at 02:00 the next day.
- Break overrun: at +31 min one notification pair; at +40 none; at +46 one more.
- Rotation: coaches A(pos1), B(pos2), C(pos3) on shift, B on break -> recommend A; A rejects -> next recommendation is C (A excluded for this profile), A and C are pushed back; nobody on shift -> fallback; nobody eligible -> `NO_COACH_AVAILABLE`.
- Manual assignment supersedes the pending one and grants the free sessions exactly once.
- Group session with 3 participants, 2 attend: two PT deductions, none for the no-show; calling attendance twice does not double charge.
