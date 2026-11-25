---
name: fix-bug
description: 'Use when something is broken, wrong, crashing or failing: reproduce it, prove it with a failing test, find the root cause, fix it minimally, verify, report.'
argument-hint: "[what is broken, error message or steps]"
---
# Fix a bug

Bug: $ARGUMENTS

Follow every step in order. Never claim a fix you didn't watch work.

## 1. Understand — no code yet
- Restate the bug: expected behaviour, actual behaviour, where it happens.
- Collect the evidence that exists: error message, stack trace, logs, failing test, request/response, the steps the user gave.
- Missing something you can't find yourself (steps, input, environment)? Ask now — max 3 focused questions.

## 2. Reproduce
- Make it happen: run the failing test, the command, the request or the page — the real thing, not a guess.
- Can't reproduce it? Stop and report what you tried and what you saw. Don't fix code blindly.

## 3. Prove it with a test
- Write the smallest regression test that fails because of this bug, following `/write-tests` and `.claude/rules/testing.md`.
- Run it and show it failing for the right reason (the bug, not a typo in the test).
- No test framework, or the bug can't be tested (pure styling, environment)? Say so and keep an exact manual reproduction instead.

## 4. Find the root cause
- Trace from the symptom to the cause: read the code path, check the inputs and state at each step, check recent changes (`git log -p`, `git blame`) on the lines involved.
- Confirm the cause before fixing: state it in one or two sentences and point to the file and line.
- Look for the same mistake elsewhere (same pattern, copied code, other callers). Fix those too if they are in the same scope; otherwise list them.

## 5. Fix
- The smallest change that removes the cause, not the symptom. No try/catch that hides the error, no special case for the one input, no disabled test.
- Don't refactor or restyle unrelated code in the same change.
- Touches the database schema → `/db-change`. Touches auth, input handling or secrets → apply `.claude/rules/security.md`.

## 6. Verify
- The regression test now passes; show the runner's summary line.
- Repeat the original reproduction from step 2 and confirm the bug is gone.
- `/verify` (full) until green. For a non-trivial fix, run the `reviewer` agent on the diff.

## 7. Report
In the response language: the cause (file:line), the fix, the test that guards it, other places with the same problem, anything left open. End with `### Third eye`.
