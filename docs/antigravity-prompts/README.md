# Prompts index (run IN ORDER, one per conversation; each ends with STOP)

Keep `00_PROJECT_RULES.md` (UI) and `backend/B00_BACKEND_RULES.md` (API) as project rules.
Attach `schema.prisma` and `src/domain/` (in gym-system.zip) to the first prompt; later prompts read them from the repo.

| Step | File | What it builds |
|---|---|---|
| 0 | `P00_project_structure.md` | monorepo skeleton, dependency rules |
| API | `backend/B01..B09` | the NestJS backend, module by module, with endpoints, transactions, jobs, error codes and numeric acceptance tests |
| UI | `01..10` | the three apps against the mock client (same endpoints as the real API) |
| Join | `11_integration_real_api.md` | swap mock for the real API |

Suggested order: P00 -> B01 -> B02 -> B03 -> B04 -> B05 -> B06 -> (UI 01-04 can run in parallel with the backend) -> B07 -> B08 -> B09 -> UI 05-10 -> 11.
Anything reported as "missing from schema/domain" comes back to the owner so the schema/domain are updated and re-tested first.
