# Sarkhan’s Claude Starter — rules, agents and hooks

This folder is the part of Sarkhan’s Claude Starter that goes into your projects; the app installs it for you. One install turns any project (any language; extra support for TypeScript/Next.js, Go, PHP, Python, Rust, Java/Kotlin, .NET, Ruby, Dart/Flutter, Swift and Docker) into an Agentic Development Environment for Claude Code: Claude makes small changes itself and splits big work across specialist agents, strict quality rules enforced by hooks, a "third eye" that reports and fixes problems, design and database guardrails, and a catalog of design skills and MCP servers.

## Install

Easiest: install the **Sarkhan’s Claude Starter** app (download link in the [main README](../README.md)), choose your projects folder, select projects and press **Set up**. Projects with older rules show **Update available**.

Terminal (the app keeps a copy of this folder in `~/claude-web-starter`):
```bash
node ~/claude-web-starter/install.mjs ~/projects/my-project                       # install or update
node ~/claude-web-starter/install.mjs ~/projects/my-project --language Azerbaijani # Claude's language for explanations
node ~/claude-web-starter/install.mjs ~/projects/my-project --preset strict        # lite | standard | strict
node ~/claude-web-starter/install.mjs ~/projects/my-project --uninstall           # remove (the starter's CLAUDE.md → CLAUDE.md.bak)
node ~/claude-web-starter/install.mjs --help
```

An install does everything: detects the stacks, writes a short `CLAUDE.md` (project, stack, commands — your own `CLAUDE.md` is never touched), installs rules/skills/agents/hooks, hides `CLAUDE.md` and `.claude/` from git (`--shared` to commit them instead), and updates your personal rules in `~/.claude` (`--no-global` to skip). Re-running is safe; your settings in `.claude/hooks/config.json` are preserved.

Always start Claude Code inside the project folder: `cd ~/projects/my-project && claude`.

## Language
`responseLanguage` (per project, default English) controls the language Claude and its agents use for explanations, questions, plans and reports. Code, identifiers, commit messages, branch names, PR text and report headings stay in English. Set it in the app (default for new projects in the setup screen and Settings; per project under **Claude → Claude replies in**) or with `--language <name>`.

## How it works: three layers
| Layer | What | Guarantee |
|---|---|---|
| Instructions | `.claude/rules/core.md` (always loaded: work mode, third eye, prohibitions, git; the whole starter adds ≈2.8k tokens per session) + rules that load only for matching files (code quality and SOLID/KISS/YAGNI/DRY, testing, security, performance, design, database, stack rules) | The model follows them |
| Workflows | skills (`/orchestrate`, `/kickoff`, `/new-feature`, `/verify`, `/ship`…) and agents | Followed step by step |
| Enforcement | hooks in `.claude/hooks/` | Deterministic — blocks violations |

## Agentic Development Environment
How much the hooks steer Claude is a **preset** (app: project panel → **Claude → Work mode**; terminal: `--preset`):

| Preset | Claude edits code itself | Report required | Agent evidence |
|---|---|---|---|
| **Lite** | always | changes of 80+ lines | off |
| **Standard** (default) | up to 3 code files per request, then it must hand the rest to agents | changes of 30+ lines | on |
| **Strict** | never — every change goes through `/orchestrate` | every change | on |

Bigger work runs through `/orchestrate`: Explore → `architect` plan → specialists in parallel (`backend-dev`, `frontend-dev`, `db-engineer`, `implementer`, `test-writer`) → `reviewer` checks each slice → `/verify` → `data-architect` / `reviewer` / `security-auditor` → fix loop → report with `### Agents` and `### Third eye`. Agents must end with `### Evidence` (hook-enforced). Schema changes always need a `data-architect` review, in every preset except Lite.

`reviewer`, `architect`, `data-architect` and `security-auditor` keep a **project memory** (`.claude/agent-memory/`): conventions, decisions and recurring mistakes they learn carry over to the next session. A hook keeps them read-only everywhere else. `/security-audit` runs in its own agent context, so the long audit doesn't fill your conversation.

`/pentest` tests the running app the way an attacker would: authentication, IDOR, privilege, mass assignment, injection, XSS, SSRF, open redirects, CSRF, rate limits, uploads, error leaks, headers and CORS. It sends real requests and calls a finding confirmed only with the request and response that prove it; every confirmed hole becomes a failing regression test before it is fixed (after you agree). The target is limited by `.claude/scripts/pentest-scope.mjs` and a hook: this computer, or a staging server you name whose host says so (`staging`, `dev`, `test`, `qa`, `preview`, `sandbox`). Security tools (nmap, sqlmap, nuclei, ZAP, ffuf…) are blocked against any other host, and while a pentest runs, HTTP requests go only to the scope. The scope ends by itself after 2 hours.

If the project has an `AGENTS.md` (Cursor, Codex…), the starter's `CLAUDE.md` imports it, so Claude reads both.

## Design policy
- **Existing project** (more than 3 commits): design is **locked** — Claude doesn't change colors, fonts, spacing, layout or component styles unless your message asks for it. A hook blocks style files (CSS/SCSS, Tailwind config, theme/tokens, `components/ui`); reviewers reject unrequested visual changes.
- **New project**: `/kickoff` first — Claude discusses goals, users, features, look & feel and constraints with you, proposes design directions, picks and installs the fitting design skill, and writes `.claude/KICKOFF.md`. Code edits are blocked until then.
- Change it in the app (project panel → **Design**: "Protect the current design" and Existing/New) or with `--design locked|open`, `--phase new|existing`.

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
- **Built-in (always on):** the skills in `template/.claude/skills` — `/orchestrate`, `/kickoff`, `/new-feature`, `/add-api-route`, `/db-change`, `/write-tests`, `/verify`, `/ship`, `/ui-review`, `/security-audit`, `/pentest`, `/project-health`.
- **Catalog** (`skills-catalog.json`): `frontend-design`, `impeccable`, `ui-ux-pro-max`, `design-taste-frontend`, `web-design-guidelines`, `emil-design-eng`, `vercel-react-best-practices`, `modern-web-guidance` (Google Chrome, on by default for web projects: anything with a `package.json`, an `index.html` or a `composer.json`), plus the `playwright` and `context7` MCP servers.
- **Recommended:** on a first install these are switched on automatically, based on the stack (skip with `--no-recommended`):
  - `context7` for every project;
  - `playwright` and `web-design-guidelines` when there is a `package.json`;
  - `vercel-react-best-practices` for React/Next.js projects.
- **Design skills are not switched on all at once:** each one gives a different visual direction, so several at once give Claude conflicting instructions. In a new project `/kickoff` agrees the style with you and turns on the one that fits; in an existing project you pick one yourself when you want design work.
- **In the app:** the project panel lists the built-in skills, a **Recommended for this project** section with a "Turn on recommended" button, the other catalog items as switches, and **My skills** with **Add your own skill…**.
- **Your own skills:** register a skill once (GitHub repo, a skill folder URL or a local folder with `SKILL.md`). It is stored in `~/.claude-starter/my-skills.json`, survives starter updates, and can be toggled per project like any catalog item.

```bash
node ~/claude-web-starter/install.mjs ~/projects/my-project --list-skills
node ~/claude-web-starter/install.mjs ~/projects/my-project --add-skill impeccable
node ~/claude-web-starter/install.mjs ~/projects/my-project --remove-skill impeccable
node ~/claude-web-starter/install.mjs --register-skill https://github.com/owner/repo/tree/main/skills/my-skill
node ~/claude-web-starter/install.mjs --register-skill ~/my-skills/deploy-check
node ~/claude-web-starter/install.mjs --register-skill owner/repo --pick skill-name   # repo with several skills
node ~/claude-web-starter/install.mjs --unregister-skill deploy-check
```
Skills are copied into `.claude/skills/<name>` (review bundled scripts); MCP servers go into `.mcp.json` and Claude Code asks you to approve them.

## Guardrail report
Every time a hook blocks Claude, it's logged in `.claude/logs/guardrails.jsonl` (time, hook, category, short text) inside the project. The app shows the last 7 days per project and the weekly total on its overview. Turn it off with `"logGuardrails": false`. Nothing leaves the machine.

## Team rules
A team folder holds `rules/*.md` and an optional `team.json` (`name`, plus defaults for new projects: `preset`, `responseLanguage`, `skills`). A computer can know several teams; one can be the default.

- `--teams`: show the teams, the default and which projects made their own choice.
- `--set-team <folder>` / `--clear-team`: set or clear the default team (used by every project without its own choice).
- `--add-team <folder>` / `--remove-team <folder>`: remember or forget a team. The folder itself is never changed.
- `<project> --team <folder>`, `<project> --no-team`, `<project> --default-team`: choose for one project, then update it.

Choices live in `~/.claude-starter/settings.json`. The project gets the team's rules as `.claude/rules/team-*.md` on every install and update. `--rules-hash` prints `{"base": …, "teams": {folder: hash}}`; a project's `.claude/starter-hash` is `base` or `base-teamhash`, so the app sees exactly which projects need an update.

## Settings — `.claude/hooks/config.json`
`responseLanguage`, `projectPhase`, `designMode`, `preset`, `logGuardrails`, `orchestratorMode` (`balanced` / `strict` / `advisory`), `directEditMaxFiles`, `reportMinChangedLines`, `checkDbDesign`, `docker`, `enforceCommentPolicy`, `checkImports`, `enforceEnvModule`, `requireThirdEyeReport`, `requireSubagentEvidence`, `blockNewDependencies`, `protectedBranches`, `maxNewFileLines`, `extraProtectedPaths`. Claude cannot edit this file.

## Honest limits
Instructions are not guarantees; hooks enforce what is measurable (regex and the project's own tools). Missing tools are skipped and shown as ⏭️ in `/verify`. Agent supervision is strengthened by evidence checks and the reviewer, but your review is the final word.
