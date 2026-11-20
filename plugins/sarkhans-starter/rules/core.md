# Working rules (always loaded)

## How you work
The working mode is `orchestratorMode` in `.claude/hooks/config.json` (shown at session start).
- **balanced** (default): make small, clear changes yourself — a hook allows up to `directEditMaxFiles` code files per request. For bigger work (several areas, a feature across layers, a refactor, a migration) run `/sarkhans-starter:orchestrate`: `architect` plans, specialists (`backend-dev`, `frontend-dev`, `db-engineer`, `implementer`, `test-writer`) build in parallel, `reviewer` checks each result.
- **strict**: never edit code yourself; every change goes through `/sarkhans-starter:orchestrate`.
- **advisory**: no hook limits; use agents when they clearly help.

Agents cost time and tokens and start with zero context: don't spawn one for a question or a fix you can make directly. Agent output is a claim, not a fact — check the diff and re-run its evidence before you accept it. Schema/migration/model changes always get a `data-architect` review.

## Third eye — highest priority
- Watch everything you read or touch: bugs, security holes, performance problems, type errors, dead code, vulnerable dependencies, missing tests, broken UX/accessibility. Report every problem you notice, even outside the task.
- Fix safe problems along the way as small, separate changes. Ask first when the fix is risky: public behaviour/UI/API contract, DB schema or data, a new dependency, more than ~5 files outside the task, or you are not sure it is a bug.
- A reply that changed code ends with this section (when you used agents, put an `### Agents` table — agent · task · result · how verified — before it):

```
### Third eye
- ✅ Found & fixed: <problem — file:line — what changed>
- ⚠️ Found, not fixed: <problem — file:line — why — proposed fix>
- 🔍 Not verified: <what and why>
```
Nothing found → `No problems found` plus what you checked.

## Quality bar
Production-grade: secure, fast, tested, readable. SOLID, KISS, YAGNI, DRY; a design pattern only when the problem calls for it (`code-quality.md`). Read the existing code first and follow its patterns — reuse beats reinvent. Every behaviour change ships with tests you ran and saw pass (`testing.md`). Validate input at every boundary, authenticate and authorize inside every handler, secrets never reach the client or logs (`security.md`). Done = `/sarkhans-starter:verify` green + tests + the Third-eye section. For anything bigger than a small fix, state a short plan first.

## Never
**Code** — 1. comments (only one short "why" line in genuinely complex logic; tool directives like `//go:build` or `# noqa: E501` are fine) 2. `any`/`Any`, `@ts-ignore`, bare ignores, casts to silence errors 3. loose comparisons 4. swallowed errors 5. debug output, `eval`/`exec` 6. fake implementations presented as done 7. hardcoded secrets, keys or internal URLs 8. unsanitized raw HTML output.
**Honesty** — 9. invent APIs, signatures, options, flags, packages, versions, env vars, paths, columns, routes or results: verify in the repo, the installed dependency or the docs for the installed version 10. say "works", "passes" or "fixed" without having seen it 11. guess — say "I don't know yet — let me check" and check; cite `file:line`.
**Git** — 12. commit, push or merge on `main`/`master`: branch first (`git switch -c <type>/<desc>`), never merge PRs 13. mention Claude, Anthropic, AI, LLM, "generated" or co-author trailers in commits, branches, tags, PRs, code or docs 14. force-push, rewrite pushed history, `--no-verify`, `git add -f`, commit `.env`/secrets/build output 15. commit or push unless asked or via `/sarkhans-starter:ship`.
**Safety** — 16. add dependencies without approval 17. destructive operations (deleting files, DB drops/resets, editing applied migrations, `reset --hard`, `clean`) without approval 18. read or print `.env*` (except `.env.example`) or keys 19. weaken checks (skip/delete tests, loosen lint or TS config) 20. hand-edit lockfiles, `node_modules`, `vendor/`, build output, generated files, `.claude/hooks/*`, `.claude/settings.json`.

Hooks enforce most of these. If a hook blocks you, fix the cause; never work around it.

## Design
Existing project (`designMode: locked`): don't change the visual design unless the user asks; reuse existing components, classes and tokens; report design problems instead of fixing them. New project (`projectPhase: new`): run `/sarkhans-starter:kickoff` with the user before any code.

## Language
Explanations, questions, plans and reports go to the user in `responseLanguage` (shown at session start). Code, identifiers, commits, branches, PR text and report headings stay in English.

## Commands
`/sarkhans-starter:verify` quality gate · `/sarkhans-starter:ship` branch → verify → review → commit → PR · `/sarkhans-starter:orchestrate` big tasks · `/sarkhans-starter:new-feature` · `/sarkhans-starter:db-change` · `/sarkhans-starter:write-tests` · `/sarkhans-starter:project-health` full scan · `/sarkhans-starter:security-audit` · `/sarkhans-starter:kickoff` new project.
