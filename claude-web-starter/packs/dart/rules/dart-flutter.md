---
paths:
  - "**/*.dart"
  - "pubspec.yaml"
  - "analysis_options.yaml"
---
# Dart / Flutter rules (Dart 3, sound null safety)

## Language
- `dart analyze`/`flutter analyze` stays clean with the project's `analysis_options.yaml`; never add `// ignore:` or `// ignore_for_file:` to hide a real issue.
- No `!` to silence null safety — handle null (`?.`, `??`, pattern matching, early return) or fix the type. No `dynamic` where a real type, generic or `Object?` + type check works. No `late` in place of proper initialization.
- `final` by default, `const` constructors and widgets wherever possible. Sealed classes + `switch` patterns for states and results; records for small grouped returns.
- Immutable models (`final` fields, `copyWith`, `freezed` only if the project already uses it). JSON via typed `fromJson`/`toJson` (`json_serializable` if present), never maps passed around the app.
- No `print` (a hook flags it in app code) — use the project's logger or `debugPrint` only in debug-only paths.

## Errors and async
- Never swallow: no empty `catch` (a hook flags it), no `catch (_) {}`. Catch specific types (`on SocketException catch (e)`), rethrow with `rethrow`, or return a typed failure.
- Every `Future` is awaited or explicitly handled; no fire-and-forget without `unawaited(...)` and a reason. Cancel `StreamSubscription`s and dispose controllers in `dispose()`.
- After an `await` in a widget, check `if (!context.mounted) return;` before using `BuildContext`.

## Flutter
- Follow the project's state management (Riverpod, Bloc, Provider...) — never introduce a second one. Business logic and I/O stay out of widgets.
- Small widgets: split big `build` methods into widget classes (not helper methods returning widgets). No heavy work in `build`; `ListView.builder` for long lists; `const` subtrees.
- Layout that works on small and large screens and with large text (no fixed heights for text, `MediaQuery`/`LayoutBuilder` where needed). Every tappable element has a semantic label and at least 48×48 tap target.
- Colors, text styles and spacing from the app's `ThemeData`/design tokens, never hardcoded in widgets. User-facing strings through the project's localization (`AppLocalizations`/ARB) when it has one.
- Platform channels and plugins behind an interface so they can be faked in tests.
- Secrets never in the app bundle — anything shipped to the client is public. Store tokens with `flutter_secure_storage` (or the project's secure store), not `SharedPreferences`.

## Tests
- `flutter_test` widget tests for UI behaviour, plain `test` for logic, `mocktail`/`mockito` as the project uses. Integration tests in `integration_test/`.
- Never `skip:` a failing test to get a green run (a hook flags it).

## Tooling (hooks and /verify)
The hook formats edited files with `dart format`. `/verify` runs `flutter analyze` + `flutter test` (or `dart analyze` + `dart test` for pure Dart).
New packages (`flutter pub add`, `dart pub add`) need the user's approval.
