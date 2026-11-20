---
paths:
  - "**/*.go"
  - "go.mod"
---
# Go rules

## Idioms
- Follow Effective Go and the project's existing layout (typically `cmd/<app>/main.go`, `internal/...` for private packages, `pkg/...` only for truly reusable code).
- Package names: short, lowercase, no underscores, no `util`/`common`/`helpers` dumping grounds. Package by feature/domain, not by layer type.
- Accept interfaces, return concrete types. Define small interfaces in the consuming package (Interface Segregation + Dependency Inversion).
- Constructor functions (`NewService(deps...)`) with explicit dependencies; no package-level mutable globals, no `init()` side effects for I/O.
- `context.Context` is the first parameter of every function doing I/O; respect cancellation and deadlines. Never store contexts in structs. No `context.TODO()` in finished code.

## Errors
- Always check errors. Never `_ = err` or ignore a returned error; a hook flags common cases, `errcheck` catches the rest.
- Wrap with context: `fmt.Errorf("create order %s: %w", id, err)`. Use `errors.Is/As`; define sentinel or typed errors for expected cases.
- No `panic` in library/handler code — only for truly impossible states at startup. No `os.Exit`/`log.Fatal` outside `main`.
- No debug `fmt.Println`; use the project's structured logger (`log/slog` or the existing one).

## Concurrency
- Every goroutine has a clear owner and exit path; use `errgroup` for fan-out with cancellation. No goroutine leaks.
- Protect shared state (`sync.Mutex`) or communicate via channels — run tests with `-race`.
- Close what you open (`defer rows.Close()`, `defer resp.Body.Close()`), check `rows.Err()`.

## HTTP / data
- Handlers: decode → validate → call service → encode; set timeouts on `http.Server` and every `http.Client`.
- SQL with placeholders only (`$1`/`?`), never `fmt.Sprintf` into queries.
- Use generics only when they remove real duplication; prefer concrete types otherwise (KISS).

## Tests
- `_test.go` next to the code, table-driven tests with `t.Run`, `t.Parallel()` where safe, `httptest` for handlers, fakes via small interfaces.
- `go test -race ./...` must pass.

## Tooling (run by hooks and /sarkhans-starter:verify)
`gofmt`/`goimports` on edit; `go build ./...`, `go vet ./...`, `go test ./...`, `golangci-lint run` (if installed) in `/sarkhans-starter:verify`.
New modules (`go get`) need the user's approval.
