# Phase 11: Replace the mock client with the real NestJS API

Read `00_PROJECT_RULES.md` and the matching `docs/backend-specs/B0x` for each module. Backend phases B01-B09 are done and green.

## Do, module by module (one PR/commit per module, in this order)
auth + members -> catalog -> invoices/payments/wallet -> subscriptions -> access/classes/visitors -> shifts/expenses -> coach operations -> commissions/payroll -> notifications/reports.
For each module: swap the mock calls for real calls in `lib/api` using `@gym/contracts` types, delete the corresponding mock handlers, run the relevant acceptance scenarios against the real API, fix mismatches in the CLIENT unless the backend spec is wrong (then report it, do not silently change the contract).

## Also
- Tokens: access in memory, refresh via httpOnly cookie; automatic refresh on 401; role-based route guards in middleware.
- Notifications over SSE with polling fallback.
- Error mapping: every `code` returned by the API has an Arabic and English string; add a test that fails when a code from the specs has no translation.
- Idempotency-Key on invoice/payment/voucher submits; disable the submit button while pending.
- Money formatter reads piasters from the API unchanged.

## Acceptance
- The scenarios listed in each B0x acceptance section pass end-to-end from the UI (record a short checklist of which were run).
- No `@gym/mock-data` import remains in app code except in tests/storybook.

STOP after this phase.
