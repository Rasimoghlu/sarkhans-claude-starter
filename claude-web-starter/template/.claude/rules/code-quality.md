---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
  - "**/*.mjs"
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
# Professional code standard (all languages)

## Self-documenting code, no comments
- Names carry the meaning: `calculateInvoiceTotal` / `calculate_invoice_total`, not `calc`. No abbreviations except universal ones (`id`, `url`, `db`, `ctx`, `err`).
- Booleans read as questions (`isActive`, `has_access`, `CanEdit`). Functions start with a verb.
- If you feel the need to write a comment, rename or extract a well-named function instead.
- Allowed only: one short line (≤ 100 chars) explaining *why* in genuinely complex logic. A hook rejects doc blocks, docstrings, block comments, TODO/FIXME, commented-out code, multi-line comment runs and comment-heavy files.
- Tool directives are not comments and are allowed with a reason/code: `@ts-expect-error -- why`, `eslint-disable-next-line rule -- why`, `# noqa: E501`, `# type: ignore[attr-defined]`, `//nolint:errcheck`, `//go:build`, PHP `@var`/`@param`/`@return` type-only docblocks needed by static analysis.

## Structure
- Functions ≤ ~40 lines, ≤ 3–4 parameters (options object/struct/dataclass beyond that), nesting ≤ 3 levels. Early returns / guard clauses over nested `if/else`.
- Files ≤ 300 lines as a target; a hook rejects new files over 400 lines. Split by responsibility.
- No magic numbers or strings: named constants.
- Exhaustive handling of every case: enums/unions, error paths, empty and loading states.
- Consistent with the surrounding code: same patterns, naming, folder structure, import style, error style.

## Errors
- Never swallow errors (empty catch/except, `_ = err`, `@` suppression, `.catch(() => {})`).
- Add context when propagating (`fmt.Errorf("load user %d: %w", id, err)`, `raise X from e`, `new Exception(..., previous: $e)`, `new Error(..., { cause })`).
- Expected failures are typed results/errors, not generic exceptions or strings.
- User-facing messages are generic; details go to logs (never secrets or PII in logs).

## Hygiene
- No dead code, unused imports/variables/exports, leftover debug output (`console.log`, `print`, `var_dump`, `dd`, `fmt.Println`).
- No duplicate utilities: search before writing a helper.
- Every change leaves touched code at least as clean as before — and you report what you improved in the Third-eye section.
