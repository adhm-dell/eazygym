# How to use these prompts

1. Put `schema.prisma` and `src/domain/` in the project first.
2. Give `00_PROJECT_RULES.md` to Antigravity as project rules (and attach it again if you open a fresh session).
3. Run the phases IN ORDER, one per session/conversation: `01` ... `09`. Paste the phase file as the prompt.
4. Do not start the next phase until the acceptance list of the current one passes. Review it yourself in the browser first.
5. Anything Antigravity reports under "missing from the schema" comes back to me, so I update the schema and the domain code and re-test before continuing.

Order: 01 design system -> 02 scan + classes -> 03 sell -> 04 shifts -> 05 members -> 06 admin config -> 07 commission/payroll/reports -> 08 coach -> 09 member.
Phases 02-04 decide whether the product feels right, so review them with your reception staff before building the rest.
