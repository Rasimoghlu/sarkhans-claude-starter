---
name: new-feature
description: 'Build a feature, page, form, module or CRUD flow end to end: verify facts, plan, data, server, UI, tests, verify, third-eye report.'
argument-hint: "[feature description]"
---
# New feature workflow

Feature request: $ARGUMENTS

Size it first. One area and a few files → do it yourself, step by step. Several areas (data + server + UI) or many files → run it inside `/orchestrate`: steps 1–3 feed the `architect`, step 4 becomes specialist slices, step 5 is supervision + `reviewer`.

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

Self-explanatory code, no comments. While working, note serious problems in code you read (third eye: security, data loss, wrong results, crashes, serious performance) and fix the safe ones.

## 5. Finish
- `/verify` (full) until green. For non-trivial changes run the `reviewer` agent on the diff.
- Summarize in the response language: what was built, files changed, how to try it, what is left open.
- End with `### Third eye`.
