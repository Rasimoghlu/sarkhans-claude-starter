---
name: write-tests
description: Write or improve behaviour-focused tests for a module, endpoint, feature or bug (regression test) with the project's existing test framework.
argument-hint: "[what to test]"
---
# Write tests

Target: $ARGUMENTS

1. **Find the existing setup:** test framework, config, folder layout, naming, helpers/factories/fixtures, how the DB/HTTP is handled in tests. Follow it exactly; never add a new test library without approval.
2. **List behaviours** of the target (show the list): happy path; validation failures; edge cases (empty, zero, max, unicode, duplicates, time boundaries); error paths; for handlers 400/422, 401, 403, 404; for permissions every role that matters.
3. **Write the tests** following `${CLAUDE_PLUGIN_ROOT}/rules/testing.md`:
   - one behaviour per test, descriptive names, Arrange–Act–Assert, no comments;
   - table-driven / parametrized for input variations;
   - mock only at external boundaries; real logic inside; deterministic time/random.
4. **Run them** with the project's runner. For a bug: show the regression test failing before the fix and passing after.
5. **Check quality:** would the test fail if the behaviour broke? Remove tests that only assert mocks.
6. Run `/sarkhans-starter:verify`. Report: tests added (names), the real runner summary line, behaviours still uncovered, bugs found. End with `### Third eye`.

For a large test effort across many modules, use `/sarkhans-starter:orchestrate` with `test-writer` agents.
