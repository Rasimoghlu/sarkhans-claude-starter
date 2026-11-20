# Docker rules (this project runs in Docker — always loaded)

## Running things
- The app runs in containers. Run project commands **inside the right service**, not on the host: `docker compose exec <service> <command>` (Laravel Sail: `./vendor/bin/sail <command>`). The services are listed in `CLAUDE.md` → Stack.
  - tests: `docker compose exec app php artisan test` · `docker compose exec web python -m pytest` · `docker compose exec api go test ./...`
  - migrations: `docker compose exec app php artisan migrate` · `docker compose exec web python manage.py migrate`
  - DB shell: `docker compose exec db psql -U <user> <db>` / `mysql -u <user> -p <db>` (credentials from env, never printed)
- Hooks and `/sarkhans-starter:verify` already run checks inside the running containers. If a service is down, start it with `docker compose up -d` — don't install language runtimes on the host instead.
- Use `-T` for non-interactive exec in scripts. Never `docker exec -it` in automation.

## Never (hook-enforced)
- `docker compose down -v` / `--volumes`, `docker volume rm|prune`, `docker system prune` — they delete the database volume (all local data).
- Destructive DB commands inside containers (`migrate:fresh`, `db:wipe`, `flush`, `DROP`) — same rules as on the host.

## Dockerfile standards
- Pin base images to a specific version (`php:8.3-fpm-alpine`, `python:3.12-slim`, `golang:1.22-alpine`), never `latest`.
- Multi-stage builds: build tools and dev dependencies stay in the builder stage; the runtime image contains only what runs.
- Run as a non-root user (`USER app`); minimal packages; `--no-install-recommends`; clean package caches in the same layer.
- Order layers for caching: dependency manifests (`composer.json`/`package.json`/`go.mod`/`requirements.txt`) and install first, source code after.
- A `.dockerignore` that excludes `.git`, `node_modules`, `vendor`, `.venv`, `.env*`, build output, logs.
- No secrets in images: no `COPY .env`, no `ARG`/`ENV` with secret values, no tokens in `RUN` lines. Use runtime env vars or build secrets (`--mount=type=secret`).
- `HEALTHCHECK` for long-running services; exec-form `CMD`/`ENTRYPOINT`.

## Compose standards
- Every service that others depend on has a `healthcheck`; dependents use `depends_on: { service: { condition: service_healthy } }`.
- Database data in a **named volume**; never bind-mount over it.
- Configuration via `env_file`/environment variables referencing `.env` (which is git-ignored); commit an `.env.example` with names only.
- Don't publish database ports beyond what local development needs; never use default/weak passwords outside local dev.
- Keep dev-only services/overrides in `compose.override.yml` (or profiles), not in the production compose file.
