---
name: write-tests
description: Write or improve behaviour-focused tests for a module, endpoint, feature or bug (regression test) using the project's existing test framework — in any language (Vitest/Jest/Playwright, Go testing, PHPUnit/Pest, pytest). Use when the user asks for tests, coverage, or a regression test, and after implementing behaviour that has no tests.
argument-hint: "[what to test]"
---
# Write tests

> **ADE:** the Orchestrator follows this playbook for planning and verification and hands the implementation steps to the specialist agents (test-writer) inside their briefs. The main session never edits code itself.

Target: $ARGUMENTS

1. **Find the existing setup:** test framework, config, folder layout, naming, helpers/factories/fixtures, how the DB/HTTP is handled in tests. Follow it exactly; never add a new test library without approval.
2. **List behaviours** of the target (show the list): happy path; validation failures; edge cases (empty, zero, max, unicode, duplicates, time boundaries); error paths; for handlers 400/422, 401, 403, 404; for permissions every role that matters.
3. **Write the tests** following `.claude/rules/testing.md`:
   - one behaviour per test, descriptive names, Arrange–Act–Assert, no comments;
   - table-driven / parametrized for input variations;
   - mock only at external boundaries; real logic inside; deterministic time/random.
4. **Run them** with the project's runner. For a bug: show the regression test failing before the fix and passing after.
5. **Check quality:** would the test fail if the behaviour broke? Remove tests that only assert mocks.
6. Run `/verify`. Report: tests added (names), the real runner summary line, behaviours still uncovered, bugs found. End with `### Third eye`.

For a large test effort across many modules, use `/orchestrate` with `test-writer` agents.
