---
name: orchestrate
description: The full ADE pipeline for a task — intake, explore, architect plan, parallel specialist slices (backend-dev, frontend-dev, db-engineer, implementer, test-writer), supervision of every result, verifier, code review, fix loop and report. Use for every non-trivial coding task, and always for multi-area features, refactors and migrations.
argument-hint: "[the task]"
---
# ADE pipeline (you are the Orchestrator)

Task: $ARGUMENTS

You do not edit code. You plan, delegate, supervise, verify and report. Rules: `.claude/rules/agents.md`.

## 1. Intake
Restate the goal and acceptance criteria in 2–4 lines. Ask the user (max 3 questions) only if something important is ambiguous.

## 2. Explore
Launch `Explore` agents in parallel (one per area: data model, server, UI, tests…). Ask each for `path:line` evidence. Open the most important cited files yourself to confirm.

## 3. Design
Launch `architect` with the goal, the acceptance criteria and the Explore findings. Review its plan critically:
- contracts exact and consistent; slices don't share files; schema/contracts first; parallelism maximized;
- design follows SOLID/KISS/YAGNI; pattern only where justified; security and performance covered; tests per slice.
- schema changes: Mermaid ERD, normal-form reasoning, FKs with ON DELETE, constraints and indexes per `database.md`. For big data-model work you may have `data-architect` review the design before db-engineer builds it.
Fix the plan (re-run architect if needed). For non-trivial work show the plan to the user and continue unless they object.

## 4. Build
Delegate each slice to its specialist with a full brief (goal, acceptance, exact scope, contracts verbatim, patterns with `path:line`, rules, required `### Evidence`). Run independent slices in parallel in one turn; dependent slices after their dependencies are verified.

## 5. Supervise each slice as it returns
1. `git status` / `git diff --stat` → out-of-scope changes reverted (`git restore <file>`) and re-briefed.
2. Evidence: open cited lines, re-run cited commands. Unreproducible → rejected.
3. New imports/APIs/config/env/routes/tables exist or are created in this change.
4. `verifier` on the slice → FAIL goes back to the owner with exact findings.

## 6. Integrate and verify
Integration gaps (wiring, contract mismatches) go to the owning specialist as a new small slice. Then run `/verify` yourself (full). Failures → owner → re-verify.

## 7. Review
`data-architect` first if schema/migrations/models changed (mandatory — normalization, FKs, indexes, constraints, types; findings go to db-engineer). Then `code-reviewer` on the whole diff; `security-auditor` if auth, input handling, data access, uploads, payments or secrets changed. Every blocker/major → owner → re-verify. Max 3 rounds, then escalate to the user with the open findings.

## 8. Report (in the response language)
What was built and how to try it, then:
- `### Agents` table: agent, slice, result (✅ / ❌ redone), how it was verified (verifier verdict, commands + real output).
- What you rejected or redid and why.
- `### Third eye`.
