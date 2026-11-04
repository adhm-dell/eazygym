# Task P00: Create the monorepo structure ONLY (no features)

You are setting up the project skeleton for a gym management system. Read the attached `schema.prisma` and the `src/domain/` folder first; they already exist and are tested (88 tests). Move them to their final places, create empty, correctly wired packages and apps. **Do not build screens or business features.** Stop when the acceptance checks pass.

## Tooling
pnpm workspaces + Turborepo, TypeScript strict. Scope `@gym/*`. Root scripts: `dev`, `build`, `test`, `typecheck`, `lint` (through turbo).

## Target structure
```
gym-system/
├── package.json, pnpm-workspace.yaml, turbo.json, tsconfig.base.json
├── .env.example, docker-compose.yml (postgres only), .github/workflows/ci.yml
├── docs/ (business-rules.md, architecture.md, backend-specs/ (B00..B09), antigravity-prompts/ (UI phases 00..11))
├── packages/
│   ├── domain/    (@gym/domain)   MOVE src/domain here. Pure rules + tests. Zero dependencies.
│   ├── db/        (@gym/db)       MOVE schema.prisma to packages/db/prisma/schema.prisma; src/index.ts exports PrismaClient + Decimal<->piasters helpers; seed.ts
│   ├── contracts/ (@gym/contracts) Zod schemas + DTO types (the API shape shared by api and frontends)
│   ├── ui/        (@gym/ui)       design system (empty for now)
│   ├── i18n/      (@gym/i18n)     ar.json, en.json
│   ├── mock-data/ (@gym/mock-data) typed mock client + seed (temporary)
│   └── config/    (@gym/config)   eslint, tailwind preset, tsconfig presets
└── apps/
    ├── api/    (NestJS)  src/{main.ts, app.module.ts, common/ (guards, decorators, filters, interceptors), prisma/, modules/*, test/}
    ├── staff/  (Next.js App Router)   admin + reception + cashier
    ├── coach/  (Next.js, mobile-first)
    └── member/ (Next.js PWA, mobile-first)
```
API modules (empty module/controller/service wired into AppModule): `auth, gyms, staff, members, wallet, plans, services, products, promotions, invoices, subscriptions, access, classes, visitors, shifts, expenses, vouchers, coach-ops (shifts, breaks, rotation, fitness, sessions), commissions, payroll, notifications, reports, audit, jobs`.
Each frontend: `src/app/` (login + placeholder home), `src/features/<feature>/{components,hooks,api.ts}`, `src/lib/` (api client stub, auth stub, money formatter using `@gym/domain`), `middleware.ts` (role guard stub). Staff features: scan, sell, shift, members, plans, promotions, classes, coach-ops, payroll, reports. Coach: home, trainees, sessions, break, commission. Member: home, subscriptions, freeze, wallet, classes.

## Dependency rules (enforce with eslint `no-restricted-imports` / `eslint-plugin-boundaries`)
| Package | May import | Must NOT import |
|---|---|---|
| `@gym/domain` | nothing | anything (no Prisma, Nest, React, Node APIs) |
| `@gym/db` | Prisma | any app |
| `@gym/contracts` | zod, `@gym/domain` (types/enums) | `@gym/db`, Prisma client |
| `apps/api` | domain, db, contracts | any frontend, `@gym/ui` |
| frontends + `@gym/ui` | domain, contracts, i18n, ui | **`@gym/db`, `@prisma/client`** |

## Write into `docs/architecture.md`
1. Business rules live only in `@gym/domain` (pure functions + tests). Controllers, services, components never re-implement a rule.
2. API pattern: controller validates (Zod from contracts) and delegates; service loads with Prisma, calls the domain, persists.
3. Money-moving operations run in ONE `prisma.$transaction`.
4. Money = integer piasters in domain and JSON; Prisma Decimal(12,2); conversion only in `@gym/db`.
5. Every tenant query is scoped by `gymId` from the JWT.
6. Frontends talk to the backend only through `@gym/contracts` and one typed client in `lib/` (mock-data until the API exists).
7. User-facing text comes from `@gym/i18n` (ar + en), RTL-safe logical CSS only.

## Acceptance (run and show output)
1. `pnpm install` ok. 2. `pnpm typecheck` ok. 3. `pnpm test` runs the 88 domain tests, all pass. 4. `pnpm --filter @gym/db exec prisma validate` ok. 5. `pnpm dev` starts api + 3 apps (placeholder pages, `/health`). 6. Lint fails when a frontend imports `@gym/db` (prove with a temporary violation, then remove). 7. `docs/` contains the specs and prompts.

## Report
Final tree (depth 3), decisions not in this prompt, what you did NOT do. Then stop.
