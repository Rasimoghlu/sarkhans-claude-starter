# Git rules (always loaded)

## Branches
- **Never commit, push or merge on `main` / `master`.** Before the first commit of a task, if the current branch is `main`/`master`, create a branch: `git switch -c <type>/<short-kebab-description>`.
- Branch types: `feat/`, `fix/`, `refactor/`, `perf/`, `security/`, `chore/`, `docs/`, `test/`. Example: `feat/employee-access-log-export`.
- Never push to `main`/`master` (also not via `HEAD:main`). Never merge PRs — that is my decision.

## Commits
- Conventional Commits, English, imperative mood, subject ≤ 72 chars: `fix: prevent duplicate invoice numbers on retry`.
- Body (optional) explains *why*, not *what*.
- One logical change per commit. Third-eye side-fixes go in their own `fix:` / `perf:` / `security:` commits.
- **Absolutely no mention of Claude, Claude Code, Anthropic, AI, LLM, "generated", 🤖, or `Co-Authored-By` trailers** in commit messages, branch names, tags, or PR titles/bodies. A hook blocks these. Write as if I wrote it myself.
- Never commit `.env*` (except `.env.example`), keys, build output (`.next/`, `dist/`), logs, or large binaries. Check `git status` before committing.

## Forbidden
- `git push --force` / `--force-with-lease`, rewriting pushed history, `git reset --hard`, `git clean -f`, `git checkout -- .`, `--no-verify`, `git add -f`, `git branch -D`.
- Committing or pushing unless I asked or `/ship` is running.

## Pull requests
- Created with `gh pr create --base main` from the feature branch (via `/ship`).
- Title: same format as a commit subject. Body: Summary, Changes, How to test, Risks/notes. No AI/tool mentions.
