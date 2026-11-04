# Phase 4 (Staff App): Shifts, expenses, close shift, admin close-all

Read `00_PROJECT_RULES.md`. Phases 1-3 are done.

## Build
1. **Current shift page:** opening cash, cash payments, receipt vouchers, expenses, disbursements, **expected cash** (`expectedCash`), and instapay/card/wallet totals shown separately (they never enter the drawer). Live breakdown of every record on the shift.
2. **Expenses:** add an operational expense (category, amount, description), attached to the current shift, reduces expected cash. List by shift/day.
3. **Close shift:** enter counted cash, show variance (`shiftVariance`, negative = shortage), confirm, produce a printable shift report. Staff can close only their own shift (`canCloseShift`).
4. **Admin:** all open shifts across staff; close one, or **Close all**, with a note; record who closed it. Shift history with variance filter.
5. Block every cash-affecting action when the shift is closed (`requireOpenShift`).

## Acceptance
- Scenario: opening 500, cash sales 2000, receipt 300, expense 150, disbursement 100 => expected 2550; counted 2500 => variance -50.
- A reception user cannot close another user's shift; an admin can.
- After closing, no new payment/expense can be attached to that shift.

STOP after this phase.
