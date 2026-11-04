# Phase 6 (Staff App, admin only): Plans, services, products, promotions, classes, settings

Read `00_PROJECT_RULES.md`. Phases 1-5 are done.

## Build
1. **Plans:** CRUD for GYM / PT / CLASS: price, duration, grants floor access, sessions, freeze policy (max count + total days), payment policy (min upfront %, due after days and/or % of the duration), commissionable + milestones, included services.
2. **Services and products** CRUD (dynamic services such as entrance, sauna, single session).
3. **Promotions** CRUD with all fields from the schema, usage count and total discount given.
4. **Classes:** weekly timetable, exceptions (cancel / reschedule / substitute coach), registered members, capacity.
5. **Gym settings:** defaults, `classEntryMode`, early minutes, expiry notification days, timezone.
6. **Staff management and roles.**

## Acceptance
- Creating a plan with invalid combinations (negative days, percent over 100) shows field errors.
- A promotion with a code, a date window and a per-member limit can be created and then behaves correctly in the Sell screen from Phase 3.

STOP after this phase.
