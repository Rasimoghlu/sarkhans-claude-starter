# Sarkhan’s Claude Starter — plugin

The rules, agents, skills and guardrail hooks of Sarkhan’s Claude Starter as a Claude Code plugin, for people who don't use the Mac app.

```bash
claude plugin marketplace add sarkhandigitech/sarkhans-claude-starter
claude plugin install sarkhans-starter@sarkhans-claude-starter
```

- Skills are namespaced: `/sarkhans-starter:verify`, `/sarkhans-starter:ship`, `/sarkhans-starter:orchestrate`, …
- The core rules are added at the start of every session; detailed rules are read from the plugin's `rules/` folder when Claude works on matching files.
- `/sarkhans-starter:pentest http://localhost:3000` tests your running app like an attacker, only on this computer or a staging server you name. Every confirmed hole comes with the request that proves it and a regression test.
- In a project set up with the app, the project's own copy wins and the plugin's hooks stay out of the way.
- Settings: create `.claude/hooks/config.json` in a project (same keys as the full install) to change the work mode, design lock or language.

## Team rules
Your team's own conventions, kept in a shared folder (`rules/*.md` and an optional `team.json`). Choose where they apply with `/sarkhans-starter:team`:

- `/sarkhans-starter:team` shows the team of this project and all teams on this computer.
- `/sarkhans-starter:team use <folder>` uses a team in this project only.
- `/sarkhans-starter:team set-default <folder>` uses a team in every project that has no choice of its own.
- `/sarkhans-starter:team none` turns team rules off in this project; `/sarkhans-starter:team default` follows the default again.

You can also describe it in your own words after the command. The choice is saved on your computer only; nothing is written into the project. Team rules load when a session starts, so start a new session or run `/clear` after a change. The `preset` and `responseLanguage` from `team.json` apply in projects without their own `.claude/hooks/config.json`.

This folder is generated from `claude-web-starter/template` by `scripts/build-plugin.mjs`. Don't edit it by hand.
