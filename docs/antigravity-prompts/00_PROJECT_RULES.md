# Project rules (give this to Antigravity ONCE as a project rules file, and re-attach it when a phase starts in a new session)

You are building the **front-end only** of a gym management system for Egyptian gyms. There is no backend yet.

## Sources of truth (read before every phase)
- `prisma/schema.prisma`: the only data model. Use its field names and enums exactly in mock data and types. Do not invent fields.
- `src/domain/`: tested pure business rules (access decision, payments, freeze, promotions, commission, shifts). **Call these functions; never re-implement a rule inside a component.**

## Sources of truth for behavior
- Backend behavior, endpoints, error codes and acceptance numbers: `docs/backend-specs/B00..B09`. Until the API exists, the mock client in `packages/mock-data` must expose the SAME endpoints, shapes and error codes (`{statusCode, code, message}`), so switching to the real API (phase 11) changes nothing in components.
- Errors are shown by `code` through the i18n dictionary (Arabic/English); never display raw server text.

## Fixed decisions
- Monorepo already created by `P00_project_structure.md`: `apps/api`, `apps/staff`, `apps/coach`, `apps/member`, `packages/{domain,db,contracts,ui,i18n,mock-data,config}`. Frontends NEVER import `@gym/db` or Prisma.
- Stack: Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + TanStack Table + React Hook Form + Zod.
- **Arabic first, RTL**, English toggle (LTR). Use logical CSS properties only (`ms-`, `me-`, `ps-`, `pe-`, `start`, `end`). Western digits. Light + dark mode.
- Money is integer piasters everywhere; one shared formatter shows `1,250.00 ج.م`. No floats for math.
- All strings come from an i18n dictionary (`ar`, `en`). No hard-coded text in components.
- All data comes from ONE typed mock client (`packages/mock-data`), so a NestJS API can replace it later without touching components.
- Every cash-affecting action requires an open shift; without one show a blocking "Open shift" dialog.
- Every list has loading, empty and error states. Status is never color-only (icon + text).

## Working agreement
- Do ONLY the current phase. Do not start the next phase.
- Finish with: (1) what you built, (2) how to run it, (3) assumptions, (4) fields/rules you needed that are missing from the schema, (5) what is left out. Then stop and wait.
- If a rule is unclear, ask instead of guessing.
