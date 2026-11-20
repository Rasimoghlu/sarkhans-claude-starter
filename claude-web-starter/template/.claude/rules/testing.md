---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
  - "**/*.mjs"
  - "**/*.vue"
  - "**/*.svelte"
  - "**/*.go"
  - "**/*.php"
  - "**/*.py"
  - "**/*.rs"
  - "**/*.java"
  - "**/*.kt"
  - "**/*.cs"
  - "**/*.swift"
  - "**/*.dart"
  - "**/*.rb"
  - "**/*.scala"
  - "**/*.c"
  - "**/*.cpp"
  - "**/*.h"
  - "**/*.hpp"
---
# Testing rules

**No behaviour change without a test.** New feature → tests for it. Bug fix → a regression test that fails before the fix and passes after. Refactor → existing tests stay green (add characterization tests first if coverage is missing).

## What to test
- Business logic and services: happy path, validation failures, edge cases (empty, zero, max, unicode, duplicates, concurrency where relevant), error paths.
- Every endpoint / handler / action: success, invalid input (400/422), unauthenticated (401), unauthorized (403), not found (404).
- Permissions and money/data-integrity code get the most thorough tests.
- UI: critical user flows end-to-end (if an e2e tool exists in the project).

## How
- Test behaviour through the public interface, not implementation details or private state.
- Arrange–Act–Assert, one behaviour per test, descriptive names (`returns 403 when user does not own the post`, `TestCreateOrder_RejectsEmptyCart`, `test_refund_fails_when_already_refunded`).
- Deterministic: no real network, no real clock/random without control, no order dependence. Mock/fake only at boundaries (HTTP, email, payment, queue) — use real logic inside.
- Prefer table-driven / parametrized tests for input variations.
- Test data via factories/builders/fixtures, not copy-pasted literals.
- Integration tests against a real test database where the project supports it.

## Tools — use what the project already has (check before adding anything)
| Stack | Unit / integration | E2E |
|---|---|---|
| TypeScript / Next.js | Vitest or Jest, Testing Library | Playwright |
| Go | `testing` + table-driven tests, `httptest`; testify only if already in go.mod | — |
| PHP | PHPUnit or Pest; Laravel: feature tests with `RefreshDatabase` | Laravel Dusk if present |
| Python | pytest (+ pytest-django / httpx `AsyncClient` for FastAPI) | Playwright if present |

## Never
- Delete, skip (`.skip`, `.only`, `t.Skip`, `@pytest.mark.skip`, `markTestSkipped`) or weaken a test to make the suite pass. Fix the code, or explain why the test is wrong and ask.
- Report test results you did not see in actual command output. Paste the summary line (e.g. `42 passed`).
- Write tests that only assert mocks were called, or that pass regardless of the implementation.

Use `/write-tests` for a structured test-writing workflow; `/verify` runs the suites.
