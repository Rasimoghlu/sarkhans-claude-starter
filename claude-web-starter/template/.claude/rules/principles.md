# Engineering principles (always loaded, every language)

These apply to TypeScript, Go, PHP, Python — any language in this repo. Apply them with judgment: the goal is code that is simple to read, safe to change and hard to misuse.

## SOLID
- **S — Single Responsibility:** a function/class/module has one reason to change. If you describe it with "and", split it.
- **O — Open/Closed:** add behaviour by adding code (a new strategy, handler, implementation), not by growing `if/switch` chains in stable code.
- **L — Liskov Substitution:** an implementation must honour its interface's contract — no surprising exceptions, no ignored methods, no narrower inputs.
- **I — Interface Segregation:** small, focused interfaces defined by the consumer. No "god" interfaces that force empty implementations.
- **D — Dependency Inversion:** business logic depends on abstractions (interfaces/ports), not on concrete DB clients, HTTP clients or frameworks. Inject dependencies at the edges (constructor/function params); no hidden globals or singletons for I/O.

## KISS — Keep It Simple
- The simplest solution that fully meets the requirement wins. Prefer plain functions and data over class hierarchies, flat over nested, explicit over clever.
- If a reviewer needs more than a minute to understand a block, simplify it.

## YAGNI — You Aren't Gonna Need It
- Build only what the task requires now. No speculative options, flags, extension points, generic "frameworks" or layers "for later".
- KISS and YAGNI win ties: when unsure whether to abstract, don't.

## DRY — Don't Repeat Yourself (with judgment)
- One source of truth for business rules, validation schemas, constants and types.
- Extract on the third repetition, not the first. Duplicated *knowledge* is a bug; similar-looking code with different reasons to change is not duplication.

## Other non-negotiables
- **Separation of concerns:** transport (HTTP/CLI) → application/service → domain → infrastructure (DB, APIs). Handlers stay thin.
- **Composition over inheritance.** Inheritance only for true "is-a" with shared behaviour, max one level deep.
- **Law of Demeter:** don't reach through objects (`a.b().c().d()`); ask the direct collaborator.
- **Fail fast:** validate at boundaries, reject invalid state early with clear typed errors.
- **Immutability by default; pure core, side effects at the edges.**
- **Explicit error handling:** never swallow errors; add context when propagating.
- **Least surprise:** names, return types and side effects do exactly what they say.

## Design patterns — use when the problem calls for it, never for its own sake
| Problem | Pattern |
|---|---|
| Several interchangeable algorithms/behaviours chosen at runtime (payment providers, export formats) | **Strategy** (map/registry of implementations instead of `switch`) |
| Complex or conditional object creation | **Factory** / factory function |
| Third-party SDK or legacy API behind your own interface | **Adapter** (port & adapter) |
| Data access separated from business logic | **Repository** (only if the ORM alone leaks into domain logic) |
| Cross-cutting concerns (auth, logging, caching, retries) | **Decorator** / **Middleware** |
| Side effects that should not couple modules (send email after signup) | **Observer** / domain **events** |
| Objects with many optional parts | **Builder** or options object |
| Expected failures as values | **Result / Either** type (or Go's `(value, error)`) |
| Multi-step workflow with states | **State machine** (explicit states + transitions) |

Rules: name the pattern in your plan/PR description (not in code comments); prefer the language's idiomatic form (Go interfaces + functions, Python protocols/callables, PHP interfaces + DI container, TS functions/objects); if a pattern adds more code than the problem it solves, don't use it.

## Before you write code
1. Find the existing pattern in this codebase for the same kind of thing and follow it.
2. State the plan: responsibilities, boundaries, which principle/pattern applies and why.
3. Write the tests that prove the behaviour (see `testing.md`).
