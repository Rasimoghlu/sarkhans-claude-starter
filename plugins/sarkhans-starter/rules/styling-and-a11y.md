---
paths:
  - "**/*.tsx"
  - "**/*.jsx"
  - "**/*.vue"
  - "**/*.svelte"
  - "**/*.html"
  - "**/*.css"
  - "**/*.scss"
  - "**/*.blade.php"
  - "**/*.twig"
  - "**/templates/**"
  - "tailwind.config.*"
---
# UI, styling & accessibility rules (any frontend / templates)

## Styling
- Use the project's styling system (Tailwind, CSS modules, design tokens). No random hex values, magic pixel values or inline styles unless truly dynamic.
- Reuse existing components/partials before creating new ones; keep the existing visual language. If none exists, ask before inventing one.
- Mobile-first; check layouts at 375px and 1280px. Support dark mode if the project has it.

## Accessibility (WCAG 2.2 AA)
- Semantic HTML first: `button` for actions, links for navigation, real `form` + `label`, headings in order (one `h1` per page).
- Everything works with the keyboard and has a visible focus style.
- Every input has a label; errors are linked with `aria-describedby`. Icon-only buttons have `aria-label`. Images have meaningful `alt` (or `alt=""` if decorative).
- Contrast ≥ 4.5:1 (3:1 large text). Never convey meaning with color alone.
- Dialogs/menus trap focus and close on Escape — prefer accessible primitives.
- Respect `prefers-reduced-motion`.

## States
Every async UI has loading, empty, error and success states designed. Forms show field-level errors and disable submit while pending.

## Templates (Blade, Twig, Jinja/Django)
- Always use auto-escaping output (`{{ }}`); raw output (`{!! !!}`, `|raw`, `|safe`, `mark_safe`) only for sanitized content — and say so.
- No business logic or queries in templates; pass prepared data from the controller/view.
