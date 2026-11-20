---
name: team
description: Show or change which team rules this project uses (a shared folder with your team's rules).
argument-hint: "[empty | use <folder> | none | default | set-default <folder> | clear-default | forget <folder>]"
disable-model-invocation: true
---
# Team rules

The user asked: $ARGUMENTS

Team rules are a shared folder (often a git repository) with `rules/*.md` and an optional `team.json` (name, preset, responseLanguage, skills). The choice is stored on this computer only; nothing is written into the project.

Run exactly one command and show the user its output in plain words. Map what the user wrote, in any language, to one action:

| The user wants | Action |
|---|---|
| to see what is set (empty request) | `status` |
| this project to use a team folder | `use <folder>` |
| no team rules in this project | `none` |
| this project to follow the default team again | `default` |
| a team for every project on this computer | `set-default <folder>` |
| no default team | `clear-default` |
| to remove a team from this computer | `forget <folder>` |

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/team.mjs" <action> [folder] --project "${CLAUDE_PROJECT_DIR}"
```

Rules:
- Use only the folder the user named. If the request needs a folder and none was given, ask for it; don't guess or search for one.
- If the request is unclear, run `status` and explain the options with the examples below instead of changing anything.
- Don't create, edit or delete files in the team folder.

Examples the user can type:
- `/sarkhans-starter:team` shows the current team and all teams on this computer
- `/sarkhans-starter:team use ~/work/team-rules` this project only
- `/sarkhans-starter:team none` no team rules in this project
- `/sarkhans-starter:team set-default ~/work/team-rules` every project, unless it has its own choice

After a change, tell the user to start a new session or run `/clear`, because team rules load when a session starts.
