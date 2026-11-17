---
name: ship
description: Use ONLY when the user asks to commit, push, open a pull request or ship. Creates a feature branch if on main/master, runs the full quality gate and review, makes clean conventional commits, pushes the branch and opens a PR. Never pushes to main, never merges, never mentions AI or Claude.
argument-hint: "[optional: short description of the change]"
---
# Ship

Change: $ARGUMENTS

Follow every step in order. Stop and report if any step fails — never skip one.

## 1. Inspect
- `git status` and `git diff --stat`. Make sure no `.env*` (except `.env.example`), keys, build output, logs or unrelated files are in the change. If there are, stop and tell the user.
- `git branch --show-current`.

## 2. Branch
- If the current branch is `main` or `master`: create a branch now — `git switch -c <type>/<short-kebab-description>` (types: feat, fix, refactor, perf, security, chore, docs, test). The name describes the change, in English, with no mention of AI/Claude.
- If already on a feature branch, stay on it.

## 3. Quality gate
- Run `/verify` (full, without `--quick`). Everything must pass. Failures go to the owning specialist agent to fix at the root cause; never weaken checks.
- Use the `code-reviewer` subagent on the diff. Every `blocker` and `major` finding goes to the owning specialist; re-run `/verify` after fixes.

## 4. Commit
- Group changes into logical commits. Third-eye side-fixes get their own commit (`fix:` / `perf:` / `security:` / `refactor:`).
- Stage explicit paths (`git add <paths>`), never `git add -f`.
- Conventional Commits, English, imperative, subject ≤ 72 chars, optional body explaining *why*.
- **No** `Co-Authored-By`, no "Generated with", no 🤖, no mention of Claude/Claude Code/Anthropic/AI anywhere in the message.

## 5. Push
- `git push -u origin <current-branch>`. Never push to `main`/`master`, never force-push.

## 6. Pull request
- If `gh` is available and authenticated: `gh pr create --base main --head <branch> --title "<conventional title>" --body "<body>"`.
  Body sections: `## Summary`, `## Changes`, `## How to test`, `## Risks / notes`. No AI/tool mentions.
- If `gh` is not available, print the compare URL from the push output instead.
- Never merge the PR.

## 7. Report (in the response language)
Branch name, commits (hash + subject), PR link, verify summary, `### Agents` (if agents fixed anything) and `### Third eye`.
