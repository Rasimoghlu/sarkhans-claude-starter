---
paths:
  - "**/*.rs"
  - "**/Cargo.toml"
---
# Rust rules (stable toolchain; Axum / Actix / Tokio / SQLx / Diesel aware)

## Language
- Follow the crate's edition and existing module layout. Small modules by feature/domain; `pub` only what other modules need, `pub(crate)` over `pub`.
- Model the domain in types: newtypes for IDs and units, enums for states, `Option` for absence. Make invalid states unrepresentable instead of checking at runtime.
- Borrow by default (`&str`, `&[T]`, `&T` in parameters); clone only when ownership is really needed. No `.clone()` just to calm the borrow checker without understanding why.
- No `unsafe` without the user's approval; when approved, keep it in one small function with a `// SAFETY:` line that names the invariant.
- No `dbg!`, no `println!`/`eprintln!` for logging in library or server code — use `tracing` (or the project's logger). A hook flags `dbg!`.
- No `todo!()`/`unimplemented!()` in finished code (a hook flags them outside tests).
- Lint silencing needs a reason: `#[allow(clippy::too_many_arguments, reason = "...")]` or `#[expect(...)]`, never a crate-wide `#![allow(...)]`.

## Errors
- Library code returns `Result<T, E>` with typed errors (`thiserror`); application edges may use `anyhow` with `.context("what failed")`. Follow what the crate already uses.
- No `.unwrap()`/`.expect()` on anything that can fail at runtime (I/O, parsing, input, locks, network). `.expect("reason")` only for real invariants, and the reason says why it can't fail.
- Propagate with `?`; never `let _ = fallible();` to drop an error. Map errors to HTTP responses in one place (`IntoResponse` / `ResponseError`), never leak internal messages.
- No `panic!` in request handlers or library code.

## Async and concurrency
- Never block inside async code: no `std::thread::sleep`, blocking file/network I/O or heavy CPU work on the runtime — use async APIs or `tokio::task::spawn_blocking`.
- Don't hold a `std::sync::Mutex` guard across `.await`; use `tokio::sync::Mutex` or restructure. Prefer message passing or `Arc<RwLock<_>>` with short critical sections.
- Every spawned task has an owner: keep the `JoinHandle`/`JoinSet`, handle its result, support shutdown. Timeouts on every outbound call (`tokio::time::timeout`, client timeouts).

## HTTP / data
- Handlers: extract → validate (`validator`/`garde` or explicit checks) → call service → typed response. Shared state via `State<Arc<AppState>>`, not globals.
- SQL only with bind parameters (`sqlx::query!`/`query_as!` with `$1`, Diesel DSL). Never `format!` values into SQL.
- `serde` structs for input with `#[serde(deny_unknown_fields)]` where the API is strict; never deserialize into `serde_json::Value` and pick fields by hand.
- `reqwest` and TLS: never `danger_accept_invalid_certs(true)` (a hook flags it).

## Tests
- Unit tests in `#[cfg(test)] mod tests` next to the code; integration tests in `tests/`. `#[tokio::test]` for async. Table-driven with arrays of cases; `rstest` only if the project already has it.
- `.unwrap()` is fine in tests. Never `#[ignore]` a failing test to get a green run (a hook flags it).

## Tooling (/verify)
`/verify` runs `cargo build`, `cargo clippy -- -D warnings` (when clippy is installed) and `cargo test`. The hook formats edited files with `rustfmt` using the crate's edition.
New crates (`cargo add`) and new feature flags on existing crates need the user's approval.
