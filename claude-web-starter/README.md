# Claude Code Starter v4.4 — Agentic Development Environment

One install turns any project (TypeScript/Next.js, Go, PHP/Laravel/Symfony, Python/Django/FastAPI, Docker) into an Agentic Development Environment for Claude Code: an orchestrator that plans and delegates to specialist agents, strict quality rules enforced by hooks, a "third eye" that reports and fixes problems, design and database guardrails, and a catalog of design skills and MCP servers.

## Install

Easiest: open **ClaudeStarter** on your Desktop, select projects, press **Install / Update**.

Terminal:
```bash
node ~/claude-web-starter/install.mjs ~/www/my-project                       # install or update
node ~/claude-web-starter/install.mjs ~/www/my-project --language Azerbaijani # Claude's language for explanations
node ~/claude-web-starter/install.mjs ~/www/my-project --uninstall           # remove (CLAUDE.md → CLAUDE.md.bak)
node ~/claude-web-starter/install.mjs --help
```

An install does everything: detects the stacks, installs rules/skills/agents/hooks, hides `CLAUDE.md` and `.claude/` from git (`--shared` to commit them instead), and updates your personal rules in `~/.claude` (`--no-global` to skip). Re-running is safe; your settings in `.claude/hooks/config.json` are preserved.

Always start Claude Code inside the project folder: `cd ~/www/my-project && claude`.

## Language
`responseLanguage` (per project, default English) controls the language Claude and its agents use for explanations, questions, plans and reports. Code, identifiers, commit messages, branch names, PR text and report headings stay in English. Set it in the app (global default for new installs + per-project in the project tag popover) or with `--language <name>`.

## How it works: three layers
| Layer | What | Guarantee |
|---|---|---|
| Instructions | `CLAUDE.md`, `.claude/rules/*` — third eye, prohibitions, SOLID/KISS/YAGNI/DRY, testing, security, performance, git, design, database | The model follows them |
| Workflows | skills (`/orchestrate`, `/kickoff`, `/new-feature`, `/verify`, `/ship`…) and agents | Followed step by step |
| Enforcement | hooks in `.claude/hooks/` | Deterministic — blocks violations |

## Agentic Development Environment
The main session is the **Orchestrator** and never edits code (a hook blocks it). Pipeline: intake → Explore → `architect` plan → specialists in parallel (`backend-dev`, `frontend-dev`, `db-engineer`, `implementer`, `test-writer`) → supervision of every result (scope via git diff, evidence re-checked, `verifier`) → `/verify` → `data-architect` / `code-reviewer` / `security-auditor` → fix loop → report with `### Agents` and `### Third eye`. Agents must end with `### Evidence` (hook-enforced). `orchestratorMode: "advisory"` lets the main session edit code.

## Design policy
- **Existing project** (more than 3 commits): design is **locked** — Claude doesn't change colors, fonts, spacing, layout or component styles unless your message asks for it. A hook blocks style files (CSS/SCSS, Tailwind config, theme/tokens, `components/ui`); reviewers reject unrequested visual changes.
- **New project**: `/kickoff` first — Claude discusses goals, users, features, look & feel and constraints with you, proposes design directions, picks and installs the fitting design skill, and writes `.claude/KICKOFF.md`. Code edits are blocked until then.
- Change in the app (click the project tag) or: `--design locked|open`, `--phase new|existing`.

## Database
`database.md` makes 3NF the default, requires real foreign keys with `ON DELETE`, junction tables for M:N, constraints, correct types (no floats for money), indexes on every FK, safe migrations and an ERD for schema changes. `data-architect` reviews every schema change (hook-enforced). A migration lint (Laravel, SQL, Django, Alembic, Prisma, Drizzle) catches floats for money, `*_id` columns without FKs, unindexed FKs on PostgreSQL, lists stored in one column and repeating column groups.

## Docker
With a compose file, the installer maps services (e.g. Laravel Sail `laravel.test` → PHP, `pgsql` → postgres). Hooks and `/verify` run checks inside running containers (`docker compose exec -T`); destructive Docker commands (`down -v`, `volume rm`, `system prune`) are blocked.

## Hooks per language
| Check | TS/JS | Go | PHP | Python |
|---|---|---|---|---|
| No comments (docblocks/docstrings/TODO/commented-out code) | ✅ | ✅ | ✅ (type docblocks allowed) | ✅ |
| Hallucinated imports | package.json + files | go.mod + packages | composer autoload | project env + modules |
| Type escapes | `any`, `@ts-ignore` | bare `//nolint` | bare `@phpstan-ignore` | `Any`, bare `# type: ignore` |
| Swallowed errors | empty `catch` | `_ = err`, empty `if err` | empty `catch`, `@` | `except: pass` |
| Debug output | `console.log` | `fmt.Println` (outside main) | `var_dump`, `dd` | `print` |
| Security | `eval`, XSS | TLS off, SQL `Sprintf` | SQL concat, `{!! !!}` | `eval`, `shell=True`, `pickle`, SQL f-strings |
| Format & lint | Prettier, ESLint | gofmt/goimports | `php -l`, Pint/CS-Fixer | ruff/black, py_compile |
| Before "done" | `tsc` | `go build` + `go vet` | `php -l` + PHPStan | py_compile + mypy |

Plus everywhere: secrets, env reads only in the config module, new files ≤ 400 lines, git rules (no commits on main/master, no AI mentions, no force push), no unapproved dependencies, no destructive DB/Docker commands, report sections.

## Skills
- **Built-in (always on):** the skills in `template/.claude/skills` — `/orchestrate`, `/kickoff`, `/new-feature`, `/add-api-route`, `/db-change`, `/write-tests`, `/verify`, `/ship`, `/ui-review`, `/security-audit`, `/project-health`.
- **Catalog** (`skills-catalog.json`): `frontend-design`, `impeccable`, `ui-ux-pro-max`, `design-taste-frontend`, `web-design-guidelines`, `emil-design-eng`, `vercel-react-best-practices`, plus the `playwright` and `context7` MCP servers.
- **Recommended:** on a first install these are switched on automatically, based on the stack (skip with `--no-recommended`):
  - `context7` for every project;
  - `playwright` and `web-design-guidelines` when there is a `package.json`;
  - `vercel-react-best-practices` for React/Next.js projects.
- **Design skills are not switched on all at once:** each one gives a different visual direction, so several at once give Claude conflicting instructions. In a new project `/kickoff` agrees the style with you and turns on the one that fits; in an existing project you pick one yourself when you want design work.
- **Your own skills:** register a skill once (GitHub repo, a skill folder URL or a local folder with `SKILL.md`). It is stored in `~/.claude-starter/my-skills.json`, survives starter updates, and can be toggled per project like any catalog item.

```bash
node ~/claude-web-starter/install.mjs ~/www/my-project --list-skills
node ~/claude-web-starter/install.mjs ~/www/my-project --add-skill impeccable
node ~/claude-web-starter/install.mjs ~/www/my-project --remove-skill impeccable
node ~/claude-web-starter/install.mjs --register-skill https://github.com/owner/repo/tree/main/skills/my-skill
node ~/claude-web-starter/install.mjs --register-skill ~/my-skills/deploy-check
node ~/claude-web-starter/install.mjs --register-skill owner/repo --pick skill-name   # repo with several skills
node ~/claude-web-starter/install.mjs --unregister-skill deploy-check
```
Skills are copied into `.claude/skills/<name>` (review bundled scripts); MCP servers go into `.mcp.json` and Claude Code asks you to approve them.

## Settings — `.claude/hooks/config.json`
`responseLanguage`, `projectPhase`, `designMode`, `orchestratorMode`, `checkDbDesign`, `docker`, `enforceCommentPolicy`, `checkImports`, `enforceEnvModule`, `requireThirdEyeReport`, `requireSubagentEvidence`, `blockNewDependencies`, `protectedBranches`, `maxNewFileLines`, `extraProtectedPaths`. Claude cannot edit this file.

## Honest limits
Instructions are not guarantees; hooks enforce what is measurable (regex and the project's own tools). Missing tools are skipped and shown as ⏭️ in `/verify`. Agent supervision is strengthened by evidence checks and the verifier, but your review is the final word.
