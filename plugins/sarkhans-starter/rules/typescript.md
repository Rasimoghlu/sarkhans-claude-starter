---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---
# TypeScript rules

- No `any` (explicit or `as any`). Use `unknown`, generics, or a proper type. A hook rejects new `any`.
- No `@ts-ignore` / `@ts-nocheck`, no `as unknown as X`. `@ts-expect-error` only with `-- <reason>` on the same line.
- `===` / `!==` only, never `==` / `!=`.
- Derive types from schemas: `type User = z.infer<typeof userSchema>` instead of duplicating shapes.
- No non-null assertions (`!`) on data that comes from outside (DB, API, params). Narrow it instead.
- Prefer `type` for unions/props, `interface` only when declaration merging or `extends` chains are needed. Be consistent within a file.
- Exhaustive `switch` on unions: end with `const _exhaustive: never = value`.
- Functions exported from a module have explicit return types when the return is non-trivial.
- No default exports except where Next.js requires them (`page.tsx`, `layout.tsx`, `route.ts` handlers are named, `loading.tsx`, `error.tsx`, `not-found.tsx`, config files).
- Use `import type` for type-only imports.
- Use the `@/` path alias instead of long relative imports (`../../../`).
- No floating promises: `await` them or explicitly `void` them with a reason.
- Dates: store/transfer as ISO strings or `Date`; never do manual timezone math — use a library if needed.
