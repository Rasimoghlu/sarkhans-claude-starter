---
paths:
  - "src/components/**"
  - "components/**"
  - "**/*.tsx"
---
# React component rules

- One component per file; file name in kebab-case (`user-card.tsx`), component in PascalCase (`UserCard`).
- Before creating a component, check `src/components/ui` and the feature folder for an existing one to reuse or extend.
- Props are typed with a named `type XxxProps`. Avoid boolean-prop explosions (`isLarge isPrimary isGhost`) — use a `variant`/`size` union or composition.
- Keep components small: if a component passes ~150 lines or mixes data fetching with complex UI, split it.
- No business logic in JSX. Derive values above the `return`, move non-trivial logic to `src/lib` or a hook.
- `useEffect` is a last resort: don't use it to derive state from props or to fetch data. Compute during render or fetch on the server.
- Lists use stable keys from data (`id`), never array index for dynamic lists.
- Forms: validate with the shared zod schema from `src/schemas`; show field-level errors; disable submit while pending (`useActionState` / `useFormStatus`).
- Every async UI has all states designed: loading, empty, error, success.
- Accessibility is not optional — see `styling-and-a11y.md`.
