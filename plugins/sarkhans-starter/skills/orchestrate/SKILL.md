---
name: orchestrate
description: 'Run a big task through the agent team: architect plan, parallel specialist slices, reviewer checks, review, fix loop, report. For multi-area features, refactors, migrations.'
argument-hint: "[the task]"
---
# Agent pipeline (you plan, delegate, supervise, verify and report)

Task: $ARGUMENTS

## The team
| Agent | Role | Writes |
|---|---|---|
| `Explore` (built-in) | find code, map how things work | nothing |
| `architect` | design + slice plan: scopes, contracts, acceptance criteria | nothing (keeps project memory) |
| `backend-dev` | APIs, handlers, services, domain logic, jobs | server code + tests |
| `frontend-dev` | pages, components, templates, client state, a11y | UI code + tests |
| `db-engineer` | schema, migrations, models, queries, indexes | data code + tests |
| `implementer` | scripts, config, CLI, infra, glue | its scope |
| `test-writer` | tests only | test files |
| `data-architect` | reviews every schema change | nothing (keeps project memory) |
| `reviewer` | checks a slice, or reviews the whole diff | nothing (keeps project memory) |
| `security-auditor` | security review | nothing |

## 1. Intake
Restate the goal and acceptance criteria in 2–4 lines. Ask (max 3 questions) only if something important is ambiguous.

## 2. Explore
Launch `Explore` agents in parallel, one per area, asking for `path:line` evidence. Open the most important cited files yourself. Skip this when you already know the code.

## 3. Design
Launch `architect` with the goal, the criteria and the findings. Check its plan: contracts exact; slices never share files; schema and contracts first; parallelism maximized; SOLID/KISS/YAGNI; patterns only where justified; security, performance and tests per slice. Schema changes need a Mermaid ERD and normal-form reasoning (`database.md`). Show the plan to the user for non-trivial work and continue unless they object.

## 4. Build
Every brief (agents start with zero context):
1. Goal + testable acceptance criteria.
2. Exact scope: the files/directories it may change.
3. What it can't know: decisions, contracts verbatim, patterns to copy (`path:line`), relevant rule files.
4. Constraints: no comments, no invented APIs, tests required, no new dependencies, no git operations.
5. It must end with `### Evidence` (a hook rejects reports without it).

Run independent slices in parallel in one turn; dependent slices after their dependencies are checked.

## 5. Supervise each slice
1. `git status` / `git diff --stat`: out-of-scope changes → `git restore <file>` and re-brief.
2. Open cited lines, re-run cited commands. Can't reproduce → rejected.
3. New imports, APIs, config keys, env vars, routes, tables exist or are created in this change.
4. `reviewer` in check mode on the slice; FAIL → back to the owner with the exact findings.
Never accept "should work" or "tests pass" without output.

## 6. Integrate and verify
Wiring gaps and contract mismatches go to the owner as a small new slice. Then run `/sarkhans-starter:verify` yourself; failures → owner → re-verify.

## 7. Review
`data-architect` first when schema, migrations or models changed (findings → `db-engineer`). Then `reviewer` in review mode on the whole diff; `security-auditor` when auth, input handling, data access, uploads, payments or secrets changed. Blockers and majors → owner → re-verify. Max 3 rounds, then escalate to the user with the open findings.

## 8. Report (in the response language)
What was built and how to try it, what you rejected or redid and why, then:

```
### Agents
| Agent | Task | Result | How it was verified |
|---|---|---|---|
| backend-dev | ... | ✅ / ❌ redone | reviewer PASS, `go test ./...` 24 passed |
```
and `### Third eye`.
