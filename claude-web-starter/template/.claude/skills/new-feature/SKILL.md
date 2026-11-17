---
name: new-feature
description: End-to-end workflow for building a new feature, page, endpoint set or user flow in any stack (verify facts → plan with principles/patterns → data → server → UI → tests → verify → third-eye report). Use when the user asks to add, build or implement a feature, page, form, module or CRUD flow.
argument-hint: "[feature description]"
---
# New feature workflow

> **ADE:** the Orchestrator follows this playbook for planning and verification and hands the implementation steps to the specialist agents (architect, db-engineer, backend-dev, frontend-dev, test-writer) inside their briefs. The main session never edits code itself.

Feature request: $ARGUMENTS

Run it inside the `/orchestrate` pipeline: steps 1–3 are yours + Explore/architect, step 4 is split into specialist slices, step 5 is supervision + verifier.

## 1. Understand — no code yet
- Restate the feature in 2–3 sentences and list acceptance criteria.
- Find related code: similar features, existing components/partials, validation schemas, services, repositories, config module, tests.
- If anything is ambiguous (who can access it, error behaviour, empty states), ask now — max 3 focused questions.

## 2. Verify facts — never guess
- Check installed versions (package.json / go.mod / composer.json / pyproject or requirements) for every library you will use.
- Confirm every API you plan to call exists in that version (dependency source/types, existing usage, official docs for that version).
- Confirm every path, table, column, env var and route you will reference exists — or plan to create it.

## 3. Plan — show it before implementing anything non-trivial
- Responsibilities and boundaries (handler → service → domain → data), and which principle/pattern applies and why (SOLID, KISS, YAGNI; Strategy/Adapter/Repository/... only if the problem calls for it).
- Files to create / modify.
- Data changes (→ `/db-change`), endpoints (→ `/add-api-route` rules), authorization rule for each action.
- UI states (loading/empty/error/success) if there is a UI.
- Performance: queries, pagination, indexes, N+1, timeouts.
- Tests to add.

## 4. Implement
1. Validation schemas / DTOs / types.
2. Domain + service logic (pure where possible, dependencies injected).
3. Data access + migration if needed.
4. Handlers/controllers/actions following `api-and-server.md`.
5. UI (if any) following `styling-and-a11y.md` and the stack rules.
6. Tests (follow `/write-tests` steps).

Self-explanatory code, no comments. While working, note every problem you see in code you read (third eye) and fix the safe ones.

## 5. Finish
- `/verify` (full) until green. For non-trivial changes run the `verifier` agent on the diff.
- Summarize in the response language: what was built, files changed, how to try it, what is left open.
- End with `### Third eye`.
