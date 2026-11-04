# Phase 8: Coach Portal (phone first)

Read `00_PROJECT_RULES.md`. Staff app phases are done.

## Build
1. **Home:** today's sessions/classes, trainees expiring soon, my commission this month (collected revenue so far, current tier, amount so far).
2. **My trainees:** list with sessions left, days left, status badge, last attendance. Trainee detail with subscription and notes.
3. **Log a PT session** (decrements sessions left; shows the result).
4. **My classes:** today's occurrences, registered members, whether reception started the class.
5. **My commission:** per month and milestone, tier progress bar to the next tier. Read-only.
6. Notifications.
7. **Break:** a "Request break" button showing today's allowance (used / max), the denial reasons by code (`NOT_ON_SHIFT`, `ANOTHER_COACH_ON_BREAK`, `DAILY_LIMIT_REACHED`, `COACH_ALREADY_ON_BREAK`), status PENDING / ACTIVE (with a live countdown against `coachBreakDurationMinutes`, turns red when exceeded) and "End break". Shows "come back" notifications prominently.
8. **New member assignments inbox:** pending `FitnessProfileAssignment`s with member info; Accept, or Reject with a required reason. After accepting, the member appears in My trainees with the free session granted.
9. **Sessions:** list/create private and group sessions, add participants (source: PT / free / class), mark attendance (only attended ones are charged; show "will deduct 1 session" before confirming) and no-show.
10. **Fitness profile and assessments** of a trainee (read/write goals, injuries, medical, InBody metrics history with a small trend chart).
11. My working shifts (read only weekly timetable).

## Acceptance
- Works at 360px width, thumb-reachable primary actions, RTL correct.
- A coach sees only their own trainees and commission.

STOP after this phase.
