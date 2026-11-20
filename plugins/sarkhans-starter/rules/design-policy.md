---
paths:
  - "**/*.css"
  - "**/*.scss"
  - "**/*.sass"
  - "**/*.less"
  - "**/*.tsx"
  - "**/*.jsx"
  - "**/*.vue"
  - "**/*.svelte"
  - "**/*.html"
  - "**/*.twig"
  - "**/*.blade.php"
  - "**/tailwind.config.*"
  - "**/templates/**"
---
# Design policy

The project's phase and design mode are shown at session start (from `.claude/hooks/config.json`: `projectPhase`, `designMode`).

## Existing project (`designMode: "locked"`) — don't touch the design unless the user asks
- The current visual design is the user's decision. **Do not change it on your own**: no new colors, fonts, spacing scales, shadows, radii, animations, layouts, restyled components, theme or token changes, no "while I'm here" visual polish.
- Functional UI work (a new field, button, page, state) **reuses the existing look exactly**: existing components, existing classes/utilities, existing tokens, the same patterns as neighbouring screens.
- Do not run design skills (`frontend-design`, `impeccable`, `ui-ux-pro-max`, `design-taste-frontend`, `emil-design-eng`) unless the user asked for a design change.
- If you notice a design problem (contrast, broken layout, inconsistency), **report it in the Third-eye section and ask** — don't fix it silently. Accessibility *bugs* that break usage can be proposed as a fix, still with approval.
- A hook blocks edits to style files (CSS/SCSS, Tailwind config, theme/token files, UI primitive folders) until the user's message asks for a design change. The reviewer rejects unrequested visual changes in markup (class names, inline styles).
- When the user explicitly asks for a design change ("change the design", "make the buttons blue", "redesign", "make it look …" — in any language), the lock opens for that request: do exactly what was asked, nothing more.

## New project (`projectPhase: "new"`) — plan with the user first
- **No code before kickoff.** Run `/sarkhans-starter:kickoff`: discuss the product with the user (goal, users, core features, platforms, brand/look, references, constraints), agree on the scope and the design direction, and write the decisions to `.claude/KICKOFF.md`. A hook blocks code edits until that file exists.
- **Choose the design skill yourself, based on the project**, explain why, and install it after the user agrees:
  | Project | Design skill |
  |---|---|
  | Marketing / landing / brand-led site | `frontend-design` (+ `design-taste-frontend` for a bolder look) |
  | SaaS app, dashboard, admin panel, internal tool | `ui-ux-pro-max` (design system: palette, typography, UX rules) |
  | Content site / blog / docs | `frontend-design` |
  | Motion-heavy / interactive product | `frontend-design` + `emil-design-eng` |
  | Always for UI work (when available) | `web-design-guidelines` for audits, `playwright` MCP to see the result |
  Install with `node ~/claude-web-starter/install.mjs . --add-skill <id>` (and `--add-skill playwright`).
- Record the chosen direction (palette, typography, spacing, component library, references) in `.claude/KICKOFF.md` / `DESIGN.md` so every later task stays consistent with it.
