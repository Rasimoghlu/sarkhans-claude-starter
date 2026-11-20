# Sarkhans Claude Starter — plugin

The rules, agents, skills and guardrail hooks of Sarkhans Claude Starter as a Claude Code plugin, for people who don't use the Mac app.

```bash
claude plugin marketplace add sarkhandigitech/sarkhans-claude-starter
claude plugin install sarkhans-starter@sarkhans-claude-starter
```

- Skills are namespaced: `/sarkhans-starter:verify`, `/sarkhans-starter:ship`, `/sarkhans-starter:orchestrate`, …
- The core rules are added at the start of every session; detailed rules are read from the plugin's `rules/` folder when Claude works on matching files.
- In a project set up with the app, the project's own copy wins and the plugin's hooks stay out of the way.
- Settings: create `.claude/hooks/config.json` in a project (same keys as the full install) to change the work mode, design lock or language.

This folder is generated from `claude-web-starter/template` by `scripts/build-plugin.mjs`. Don't edit it by hand.
