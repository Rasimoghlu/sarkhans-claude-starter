---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
  - "**/*.go"
  - "**/*.php"
  - "**/*.py"
  - "**/*.sql"
  - "**/*.rs"
  - "**/*.java"
  - "**/*.kt"
  - "**/*.cs"
  - "**/*.swift"
  - "**/*.dart"
  - "**/*.rb"
  - "**/*.scala"
  - "**/*.c"
  - "**/*.cpp"
  - "**/*.h"
  - "**/*.hpp"
---
# Performance rules (all languages)

Every change must not make latency, memory, query count or bundle size worse without a stated reason.

## Data access (biggest wins)
- No N+1: no DB/API calls inside loops. Use joins, eager loading (`with()`, `select_related`/`prefetch_related`, `include`), `IN` queries or batching.
- Every list endpoint is paginated with a max page size; select only needed columns.
- Indexes for columns used in `WHERE`, `ORDER BY`, `JOIN` of hot queries — add them in the migration.
- Multi-step writes in a transaction; keep transactions short.
- Cache deliberately (what, where, TTL, invalidation) — state it in the plan.

## Concurrency & I/O
- Independent I/O runs in parallel (`Promise.all`, goroutines + `errgroup`, `asyncio.gather`, Laravel concurrency/queues).
- Every outbound network call has a timeout; retries only with backoff and only for idempotent operations.
- Slow or non-critical work (emails, webhooks, reports, image processing) goes to a queue/background job.
- Go: pass `context.Context`, respect cancellation, never leak goroutines. Python async: never call blocking I/O inside async code.

## Memory & CPU
- Stream large files/results instead of loading them fully into memory.
- Avoid repeated work in loops (hoist invariants, precompute maps for lookups instead of nested scans: O(n²) → O(n)).
- No premature micro-optimization — but no obviously quadratic algorithms on unbounded input.

## Frontend (when present)
- Minimal client JavaScript; heavy widgets lazy-loaded; images sized and optimized; no layout shift.
- Targets: LCP < 2.5s, INP < 200ms, CLS < 0.1.

## In your Third-eye report
Mention any performance problem you noticed (N+1, missing pagination/indexes, missing timeouts, blocking I/O, oversized bundles) even if outside the task.
