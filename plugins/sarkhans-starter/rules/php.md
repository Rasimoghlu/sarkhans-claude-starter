---
paths:
  - "**/*.php"
  - "composer.json"
---
# PHP rules (PHP 8.x; Laravel / Symfony aware)

## Language
- Every PHP file starts with `declare(strict_types=1);` (except Blade templates and framework-generated config the project keeps without it). A hook checks new files.
- Full type declarations: parameter, return and property types everywhere; `readonly` properties and constructor promotion for value objects/DTOs; `enum` instead of string/int constants.
- Strict comparisons only (`===`, `!==`) — a hook rejects `==`, `!=`, `<>`.
- No error suppression `@`, no `extract()`, no `eval()`, no `global`, no debug output (`var_dump`, `print_r`, `dd`, `dump`, `die`, `exit`).
- PSR-12 / the project's formatter (Pint or PHP-CS-Fixer); PSR-4 autoloading — one class per file, namespace matches path.
- Docblocks only when they carry type information static analysis needs (`@param array<string, int>`, `@return list<User>`, `@template`) — never prose.

## Architecture
- Thin controllers: FormRequest/validator → service/action class → resource/DTO. No queries or business logic in controllers or templates.
- Constructor dependency injection via the container; depend on interfaces for external services (payment, mail, storage).
- Laravel: Eloquent relationships + eager loading (`with()`) to avoid N+1 (enable `Model::preventLazyLoading()` in dev if the project allows); policies/gates for authorization; jobs for slow work; config via `config()` — `env()` only inside `config/*.php`.
- Symfony: services autowired, voters for authorization, Validator constraints on DTOs, Messenger for async work.
- Mass assignment: explicit `$fillable` (never `$guarded = []` on user-facing models).
- Raw SQL only with bindings (`DB::select('... where id = ?', [$id])`), never string concatenation.

## Tests
- Pest or PHPUnit (whatever the project uses). Laravel: feature tests with `RefreshDatabase`, factories for data, `actingAs()` for auth, assert status codes + JSON structure + DB state.
- Static analysis: PHPStan/Larastan or Psalm at the project's level must stay green.

## Tooling (run by hooks and /sarkhans-starter:verify)
`php -l` + Pint/PHP-CS-Fixer on edit; composer scripts or `vendor/bin/phpunit|pest`, `vendor/bin/phpstan analyse` in `/sarkhans-starter:verify`.
New packages (`composer require`) need the user's approval. Never run `migrate:fresh`, `migrate:reset`, `db:wipe` (hook-blocked).
