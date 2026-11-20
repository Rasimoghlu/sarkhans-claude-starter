# Team rules example

Copy this folder into a git repository (or a synced folder) that your team shares and edit it.

- `rules/*.md`: your conventions, one short file per topic. Claude reads them in every session, so keep them brief. Add a `paths:` frontmatter to a rule to use it only for matching files.
- `team.json` (optional): `name`, plus defaults for newly set-up projects: `preset` (`lite`, `standard`, `strict`), `responseLanguage`, `skills` (catalog ids).

Then choose where it applies. One team can be the default for every project, and any project can pick another team or none:

- **Mac app**: Settings → Team rules → Add team…, then pick it as the Default team, or choose it on a project's page under Team.
- **Claude Code plugin**: `/sarkhans-starter:team set-default <folder>` for every project, or `/sarkhans-starter:team use <folder>` for the current project. `/sarkhans-starter:team` shows what is set.
- **Installer in a terminal**: `node ~/claude-web-starter/install.mjs --set-team <folder>` for every project, or `node ~/claude-web-starter/install.mjs <project> --team <folder>` for one. `--teams` shows what is set.

When the folder changes (for example after `git pull`), the app updates the projects by itself and the plugin uses the new rules from the next session.
