# Phase 9: Member Portal (phone first, PWA)

Read `00_PROJECT_RULES.md`. Previous phases are done.

## Build
1. **Home:** large QR of the member `code`; current access status using the same Arabic status language; days left; next class today.
2. **Subscriptions:** progress bar by days, sessions left, coach, remaining balance with its due date, payment history.
3. **Freeze:** request a freeze with a days picker limited by `canFreeze`; explain when it is not available (overdue balance, limits used). Freeze history.
4. **Wallet:** balance and transactions.
5. **Classes:** my weekly slots. **Profile and notifications** (expiry reminders).
6. PWA manifest and offline shell for the QR screen.

## Acceptance
- QR screen works offline once opened. A member can only see their own data.
- The freeze flow matches the staff app's rules exactly (same `canFreeze`).

STOP after this phase.
