---
name: ui-review
description: Review UI code and pages for accessibility (WCAG 2.2 AA), responsive layout, UI states, design consistency and front-end performance.
argument-hint: "[page route or component path]"
---
# UI review

Target: $ARGUMENTS

## 1. Code review (always)
If the `modern-web-guidance` skill is installed, look up the guides for the patterns in the target (dialogs, forms, layout, images, CSP…) first and judge the code against them, not against older habits.

Read the target files and check against `${CLAUDE_PLUGIN_ROOT}/rules/styling-and-a11y.md` and `${CLAUDE_PLUGIN_ROOT}/rules/react-components.md`:
- **Semantics & a11y** — headings order, buttons vs links, labels, `alt`, `aria-*` correctness, focus-visible styles, keyboard traps, color contrast of token pairs.
- **States** — loading, empty, error, success, disabled/pending for every async piece.
- **Responsive** — mobile-first classes, overflow on 375px, long text / long words, tables on small screens.
- **Consistency** — uses design tokens and `src/components/ui` primitives; no one-off colors/spacing; matches neighbouring pages.
- **Performance** — large client bundles, unnecessary client-side rendering, unoptimized/unsized images (layout shift), fonts without dimensions, heavy widgets not lazy-loaded.
- **Templates** (Blade/Twig/Django) — auto-escaping used, no logic or queries in templates.

## 2. Visual check (if possible)
Use the installed design skills in `.claude/skills/` (e.g. `web-design-guidelines` for the audit, `impeccable` for critique) and the Playwright MCP when available.

If the dev server can run and Playwright (or the `webapp-testing` skill) is available: open the page at 375px and 1280px, take screenshots, check console errors, tab through the page with the keyboard.
If not possible, say so and rely on the code review.

## 3. Report
Group findings as **Must fix** (a11y blockers, broken states, layout bugs) / **Should fix** / **Nice to have**, each with file:line and the concrete change. Ask before applying fixes unless the user already asked for them.

If you applied fixes, run `/sarkhans-starter:verify` and end with the `### Third eye` section.
