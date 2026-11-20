---
name: project-health
description: Full third-eye scan of the whole project (checks, dependencies, security, performance, code quality) with a prioritized report, then safe fixes.
argument-hint: "[optional: area to focus on]"
---
# Project health scan (third eye)

Focus: $ARGUMENTS (empty = whole project)

Read-only until step 4. Collect evidence (`file:line`, command output) for every finding — never report something you did not actually see.

## 1. Quality gate
- `node ${CLAUDE_PROJECT_DIR}/.claude/scripts/verify.mjs` — record each step's result.

## 2. Dependencies
- Vulnerabilities (installed tools only): `npm audit --omit=dev` / `pnpm audit --prod`, `govulncheck ./...`, `composer audit`, `pip-audit`.
- Outdated: `npm outdated`, `go list -u -m all`, `composer outdated --direct`, `pip list --outdated` — flag major versions behind for framework, auth, ORM.
- Declared but unused / used but undeclared: if `knip` or `depcheck` is already installed, run it; otherwise grep imports vs `package.json`. Do not install new tools.

## 3. Code scan (grep across the source directories of every stack)
- Type safety: `any`/`Any`, `as unknown as`, `@ts-ignore`, bare `# type: ignore`/`# noqa`, `@phpstan-ignore` without identifier, missing type declarations (PHP/Python), loose comparisons.
- Error handling: empty `catch`/`except: pass`, `.catch(() => {})`, `_ = err`, `@` suppression, unhandled promises, panics in library code.
- Comments policy: doc blocks/docstrings, block comments, TODO/FIXME/HACK, commented-out code.
- Design: violations of SOLID/KISS/YAGNI/DRY (god classes, fat controllers, duplicated business rules, speculative abstractions).
- Debug leftovers: `console.log`, `print`, `var_dump`/`dd`, `fmt.Println`, `debugger`.
- Security: raw HTML output (`dangerouslySetInnerHTML`, `{!! !!}`, `|safe`), `eval`/`exec`, SQL built by interpolation, `shell=True`/`system()`, unsafe deserialization, env reads outside the config module, secrets in client-exposed vars, handlers/controllers/actions without authentication or authorization, missing validation, missing rate limits on auth endpoints, disabled TLS/CSRF, debug mode in production config.
- Performance: queries in loops (N+1) / missing eager loading, unpaginated list queries, missing indexes, sequential I/O that could be parallel, missing timeouts on outbound calls, blocking I/O in async code, goroutine leaks; frontend: oversized client bundles, unoptimized images.
- Structure: files > 300 lines, functions > 40 lines, duplicated helpers, dead exports.
- Framework-specific (per stack rule file): e.g. Next.js routes without `loading`/`error` states, Laravel controllers without FormRequests/Policies, Django views without permission classes, Go handlers without context/timeouts.
- Tests: critical server logic (auth, payments, permissions) without tests.

## 4. Report
Write `reports/health-<YYYY-MM-DD>.md` and show the summary:

| # | Priority | Area | Location | Problem | Fix | Risk of fix |
|---|----------|------|----------|---------|-----|-------------|

Priority: P0 (security/data loss/broken build) → P1 (bugs, serious perf) → P2 (quality) → P3 (nice to have).

## 5. Fix
- Fix the low-risk items immediately (types, empty catches, debug leftovers, comments, obvious bugs), each group in its own focused change, then run `/verify`.
- For risky items (behaviour/API changes, schema, dependencies, large refactors) list the proposed fix and ask the user.
- End with the `### Third eye` section.
