# Phase 10 (Staff App): Coach operations: working shifts, breaks, rotation queue, fitness profile, sessions

Read `00_PROJECT_RULES.md`, `docs/backend-specs/B07_coach_ops.md`. Phases 1-9 are done.

## Build
1. **Coach working shifts:** weekly grid per coach (day, start, end; overnight shifts shown as crossing midnight), validation of overlaps, "who is on shift now" badge.
2. **Breaks board (reception/admin):** top strip shows the coach currently on break with a live timer against `coachBreakDurationMinutes` (turns red when exceeded) and buttons End break and **Notify to return**. Pending requests list with Approve / Reject (reason required). Start a break directly for a coach (becomes ACTIVE at once). Denial codes shown in Arabic (`ANOTHER_COACH_ON_BREAK`, `NOT_ON_SHIFT`, `DAILY_LIMIT_REACHED`, ...). History table per coach per day (used / max).
3. **Rotation queue and assignments:** ordered queue with each coach's state (on shift / on break / inactive), reorder (admin). Inbox of new members awaiting a coach: recommended coach and status PENDING / ACCEPTED / REJECTED (with reason) / SUPERSEDED, and a **Assign manually** dialog (picks any coach, explains that it supersedes the pending recommendation and grants the free sessions). "No coach available" alert state.
4. **Fitness profile + assessments** in the member profile (new tab): editable profile, InBody metrics history with trend charts.
5. **Coach sessions calendar:** day/week view, create private/group session, participants with source, attendance and no-show, session capacity.
6. **Gym settings additions:** `maxCoachBreaksPerDay`, `coachBreakDurationMinutes`, `freeSessionsOnFitnessProfile`, `manualDiscountLimitPercent`.
7. Mock data: coaches on shift / off shift / on break, an overnight shift, pending and rejected assignments, a group session with a no-show.

## Acceptance
- With one coach on an active break, requesting a second break shows the exact denial message and the board never shows two active breaks.
- Rejecting an assignment immediately shows a NEW recommendation that is not the rejecting coach.
- Marking attendance for 3 participants with 1 no-show shows 2 deductions in the confirmation, 0 for the no-show.

STOP after this phase.
