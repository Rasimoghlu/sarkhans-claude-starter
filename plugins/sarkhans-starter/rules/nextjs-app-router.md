---
paths:
  - "src/app/**"
  - "app/**"
  - "src/middleware.ts"
  - "middleware.ts"
  - "next.config.*"
---
# Next.js App Router rules

## Components & boundaries
- Server Components by default. `"use client"` only when the file needs state, effects, event handlers, refs or browser APIs.
- Keep client components leaf-level: pass server-fetched data down as props; don't turn a whole page into a client component for one button.
- Never import server-only modules (`@/server/*`, db, secrets) into a `"use client"` file.
- Props passed from server to client components must be serializable (no functions, class instances, Dates without care).

## Data
- Fetch data in Server Components or server functions, not in `useEffect`.
- Run independent fetches in parallel (`Promise.all`), avoid request waterfalls.
- Mutations go through Server Actions (`src/server/actions/*`) or Route Handlers. After a mutation, revalidate explicitly (`revalidatePath` / `revalidateTag`).
- Be explicit about caching for each fetch / route; don't rely on defaults you haven't checked for the installed Next.js version.
- Check the installed Next.js version in `package.json` before using version-specific APIs (e.g. async `params`/`searchParams`, caching directives).

## Routing files
- Every route segment that fetches data has sensible `loading.tsx` and `error.tsx` handling (or Suspense boundaries).
- Use `notFound()` and `redirect()` from `next/navigation` instead of rendering ad-hoc error UI.
- Each public page exports `metadata` or `generateMetadata` (title + description at minimum).

## Assets & performance
- Images via `next/image` with explicit `width`/`height` or `fill` + `sizes`. Fonts via `next/font`.
- Use `next/link` for internal navigation.
- Heavy client-only widgets (charts, editors, maps) load with `next/dynamic`.
- Don't add `export const dynamic = "force-dynamic"` unless you can explain why.
