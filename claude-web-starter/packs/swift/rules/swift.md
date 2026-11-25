---
paths:
  - "**/*.swift"
  - "Package.swift"
---
# Swift rules (Swift 5.9+ / Swift 6; SwiftUI, UIKit, Vapor aware)

## Language
- Value types first: `struct` and `enum` for models, `final class` when reference semantics are needed. `let` by default; `private`/`fileprivate` unless wider access is needed.
- No force unwraps (`!`), `try!` or `as!` in app code — use `guard let`, `if let`, `??`, `try` with handling, `as?`. Allowed only for compile-time-known values (e.g. a literal `URL(string:)` constant) and in tests.
- Implicitly unwrapped optionals only for `@IBOutlet`s. No `fatalError`/`preconditionFailure` for situations that can happen at runtime.
- Protocols for seams (networking, storage, clock) so code can be tested with fakes; inject dependencies through initializers, not singletons reached from everywhere.
- No `print`/`debugPrint`/`dump` left in code — use `os.Logger` (or the project's logger) with privacy annotations for user data. A hook flags `print` in app code.

## Errors and concurrency
- Throwing functions with typed `Error` enums; never `try?` that silently drops an error you should handle. No empty `catch` blocks (a hook flags them).
- Swift concurrency: `async`/`await` over completion handlers in new code; UI updates on `@MainActor`. Mutable shared state in an `actor`. Types crossing concurrency domains are `Sendable` — fix warnings, don't silence them with `@unchecked Sendable` or `nonisolated(unsafe)`.
- Cancel long-running `Task`s you start (store the handle, check `Task.isCancelled`). Avoid retain cycles: `[weak self]` in escaping closures that outlive the owner.

## SwiftUI / UIKit
- Views stay small and declarative; logic in an `@Observable` model (or the project's `ObservableObject` view models). `@State` only for view-local state; no work in `body`.
- Every interactive element is reachable with VoiceOver (labels on icon-only buttons) and works with Dynamic Type; no fixed sizes for text.
- Colors, fonts and spacing from the asset catalog / design system; user-facing strings localizable (`String(localized:)` / String Catalogs).
- Network calls with timeouts and a cancellable `Task`; no networking or disk I/O on the main actor.
- Secrets never in the app bundle. Tokens go in the Keychain, never `UserDefaults`. Never disable ATS or accept any certificate in `URLSessionDelegate`.

## Server (Vapor)
- Validate request content (`Validatable`), authorize every route, Fluent queries with bound parameters (never interpolate into `SQLQueryString` raw parts), migrations for schema changes.

## Tests
- Swift Testing (`@Test`, `#expect`, parameterized `arguments:`) or XCTest, whatever the project uses. Fakes via protocols; no real network in unit tests.
- Never disable or skip a failing test (`.disabled`, `XCTSkip`) to get a green run.

## Tooling (hooks and /verify)
The hook formats edited files with `swift-format` or `swiftformat` when installed; follow `.swiftlint.yml` if the project has one. `/verify` runs `swift build` and `swift test` for Swift packages. Xcode app projects: build and test with `xcodebuild -scheme <scheme> test` (ask for the scheme and simulator if unclear).
New packages (SwiftPM dependencies, CocoaPods, Carthage) need the user's approval.
