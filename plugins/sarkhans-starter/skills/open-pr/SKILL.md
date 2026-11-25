---
name: open-pr
description: 'Use when the user asks to commit, push, open a PR or ship a change: branch off main, run /sarkhans-starter:verify and the reviewer, clean commits, push, open a PR. Never merges.'
argument-hint: "[optional: short description of the change]"
---
# Open PR

Change: $ARGUMENTS

Follow every step in order. Stop and report if any step fails — never skip one.

## 1. Inspect
- `git status` and `git diff --stat`. Make sure no `.env*` (except `.env.example`), keys, build output, logs or unrelated files are in the change. If there are, stop and tell the user.
- `git branch --show-current`.

## 2. Branch
- If the current branch is `main` or `master`: create a branch now — `git switch -c <type>/<short-kebab-description>` (types: feat, fix, refactor, perf, security, chore, docs, test). The name describes the change, in English, with no mention of AI/Claude.
- If already on a feature branch, stay on it.

## 3. Quality gate
- Run `/sarkhans-starter:verify` (full, without `--quick`). Everything must pass. Fix failures at the root cause — directly when small, otherwise through the owning specialist; never weaken checks.
- Run the `reviewer` agent in review mode on the whole diff. Fix every `blocker` and `major` finding (directly or through the owning specialist), then re-run `/sarkhans-starter:verify`.

## 4. Commit
- Group changes into logical commits. Third-eye side-fixes get their own commit (`fix:` / `perf:` / `security:` / `refactor:`).
- Stage explicit paths (`git add <paths>`), never `git add -f`.
- Conventional Commits, English, imperative, subject ≤ 72 chars, optional body explaining *why*.
- **No** `Co-Authored-By`, no "Generated with", no 🤖, no mention of Claude/Claude Code/Anthropic/AI anywhere in the message.

## 5. Push
- `git push -u origin <current-branch>`. Never push to `main`/`master`, never force-push.

## 6. Pull request
- If `gh` is available and authenticated: `gh pr create --head <branch> --title "<conventional title>" --body "<body>"`.
  The base is the repository's default branch. Body sections: `## Summary`, `## Changes`, `## How to test`, `## Risks / notes`. No AI/tool mentions.
- If `gh` is not available, print the compare URL from the push output instead.
- Never merge the PR.

## 7. Report (in the response language)
Branch name, commits (hash + subject), PR link, verify summary, `### Agents` (if agents fixed anything) and `### Third eye`.
