# Phase 1: Monorepo, design system, mock data foundation

Read `00_PROJECT_RULES.md`, `schema.prisma`, `src/domain`.

## Build
1. Monorepo scaffold with the three apps as empty shells (login page only) and the shared packages.
2. `packages/domain`: copy of `src/domain`, with its tests passing.
3. `packages/ui` design system:
   - Tokens: one strong accent color, neutral scale, semantic colors (success, warning, danger, info), type scale (Arabic font IBM Plex Sans Arabic or Cairo + a Latin pair), spacing, radius, shadows. Light and dark.
   - RTL/LTR switch and language toggle working across the app.
   - Components: Button, Input/Select/Combobox, MoneyInput + Money display, DataTable (sort, filter, pagination, empty/loading/error), StatusBadge (subscription statuses and access reasons, icon + text), StatCard, Dialog/Sheet, Toast, FullScreenResult (green/amber/red scan result), DateRange, Tabs, ConfirmDialog with required reason field.
4. `packages/mock-data`: typed client + seed with the main entities only: Gym, Staff (one per role), Members (about 12), Plans (GYM, PT, CLASS), Subscriptions, Invoices, Payments, Wallets. Include one member for each of these states: active, expiring in 3 days, expired, frozen, overdue balance, pending payment, blocked.
5. A `/design` page in the staff app that shows every component in light/dark and ar/en.

## Acceptance
- Typecheck and domain tests pass. `/design` page renders in all 4 combinations (ar/en x light/dark) with no layout breakage in RTL.
- A search for `left`/`right`/`ml-`/`mr-`/`pl-`/`pr-` in app code finds nothing.

STOP after this phase.
