---
name: verify
description: Run the full quality gate for every stack in the repo (typecheck, lint, tests, build). Required before saying a task is done.
allowed-tools: Bash(node ${CLAUDE_PROJECT_DIR}/.claude/scripts/verify.mjs *), Bash(node ${CLAUDE_PROJECT_DIR}/.claude/scripts/verify.mjs)
---
# Verify

1. Run `node ${CLAUDE_PROJECT_DIR}/.claude/scripts/verify.mjs`.
   - It detects every stack (package.json, go.mod, composer.json, pyproject/requirements) and runs the checks whose tools exist in the project.
   - Pass `--quick` to skip the build when iterating: `node ${CLAUDE_PROJECT_DIR}/.claude/scripts/verify.mjs --quick`. A final verification before "done" or a commit always runs without `--quick`.
2. If a step fails:
   - Read the error, fix the **root cause** in the code.
   - Never "fix" by adding `any`, `@ts-ignore`, `eslint-disable`, `.skip`, or by deleting/loosening tests or lint rules.
   - Re-run until everything passes.
3. If a check is skipped because a tool or script is missing (no tests, no PHPStan, no ruff, no `typecheck` script), tell the user and suggest adding it — don't install tools or edit project config without asking.
4. Report in one short block:
   ```
   node:typecheck ✅ | node:test ✅ (42 passed) | go:vet ✅ | python:pytest ✅ (18 passed)
   ```
   If something could not be run, say exactly what and why. Never claim a step passed if you didn't see it pass.
