# Project rules (give this to Antigravity ONCE as a project rules file, and re-attach it when a phase starts in a new session)

You are building the **front-end only** of a gym management system for Egyptian gyms. There is no backend yet.

## Sources of truth (read before every phase)
- `prisma/schema.prisma`: the only data model. Use its field names and enums exactly in mock data and types. Do not invent fields.
- `src/domain/`: tested pure business rules (access decision, payments, freeze, promotions, commission, shifts). **Call these functions; never re-implement a rule inside a component.**

## Fixed decisions
- Monorepo: `apps/staff`, `apps/coach`, `apps/member`, `packages/ui`, `packages/mock-data`, `packages/domain` (copy of `src/domain`).
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
