---
paths:
  - "**/*.rb"
  - "**/*.erb"
  - "**/*.rake"
  - "Gemfile"
---
# Ruby rules (Ruby 3.2+; Rails aware)

## Language
- Follow the project's RuboCop config; `# frozen_string_literal: true` at the top when the project uses it.
- Small objects with one job. Service/query/form objects in the project's existing folders (`app/services`, `app/queries`...) instead of growing models and controllers.
- No monkey-patching core classes, no `method_missing` without `respond_to_missing?`, no `send` with user input, no `eval`/`instance_eval` on strings, no `constantize` on params.
- No `puts`/`p`/`pp` for logging, no `binding.pry`, `byebug` or `debugger` left in code (a hook flags debuggers) — use `Rails.logger` with context.
- Keyword arguments for anything beyond two parameters; return values, not `nil` for errors.

## Errors
- Never swallow: no `rescue => e; end`, no bare `rescue` or `rescue Exception`. Rescue specific errors, add context, re-raise or return a result.
- Map domain errors to responses in one place (`rescue_from` in a base controller). Never render exception messages to users.
- Bang methods (`save!`, `create!`, `update!`) inside transactions and jobs so failures aren't silent; check the return value of non-bang ones.

## Rails
- Strong parameters on every write (`params.require(...).permit(...)`); never `permit!`. Authorization in every action (Pundit/CanCanCan/the project's own) — authentication alone isn't enough.
- N+1: `includes`/`preload` for associations you render; `find_each` for batches; pagination on every list. Turn on `strict_loading` where the project uses it.
- SQL only with placeholders: `where(status: s)`, `where("created_at > ?", t)`. Never interpolate into `where`, `order`, `find_by_sql` or `pluck` strings; whitelist column names for sorting.
- `html_safe`/`raw` only on sanitized content (`sanitize`). Never `render inline:` with user input.
- Model callbacks only for the model's own consistency — side effects (emails, HTTP calls, jobs) go in services, enqueued `after_commit`.
- Migrations: reversible, safe on large tables (`algorithm: :concurrently` for Postgres indexes, add columns without defaults that rewrite the table), never edit one that has run. Use `strong_migrations` rules if the gem is present.
- Background jobs are idempotent and take IDs, not objects. Secrets via `Rails.application.credentials` or ENV read in one initializer.
- Outbound HTTP always with open and read timeouts; never `verify_mode = OpenSSL::SSL::VERIFY_NONE` (a hook flags it).

## Tests
- RSpec or Minitest as the project already uses; factories (FactoryBot) over fixtures if present; request specs for endpoints, model/service specs for logic; `travel_to` for time.
- Never `xit`, `skip` or `pending` a failing test to get a green run (a hook flags it).

## Tooling (/verify)
`/verify` runs `bundle exec rubocop` (when `.rubocop.yml` exists) and `bundle exec rspec` or `bundle exec rake test`.
New gems need the user's approval. Never `db:drop`, `db:reset` or `db:schema:load` on a real database.
