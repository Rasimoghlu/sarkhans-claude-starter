# Team rules example

Copy this folder into a git repository (or a synced folder) that your team shares, edit it, and point the app to it: **Settings → Team rules → Use team rules…**. Terminal: `node ~/claude-web-starter/install.mjs --set-team <folder>`.

- `rules/*.md`: copied into every set-up project as `.claude/rules/team-<name>.md`. They load in every session, so keep them short. Add a `paths:` frontmatter to load a rule only for matching files.
- `team.json` (optional): `name`, and defaults for newly set-up projects: `preset` (`lite`, `standard`, `strict`), `responseLanguage`, `skills` (catalog ids).

When the folder changes (for example after `git pull`), the app notices and updates the projects.
