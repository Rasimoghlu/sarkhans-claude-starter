---
name: db-change
description: 'Change the database schema (tables, columns, indexes, relations) safely: new migration, updated models, data-architect review and tests.'
argument-hint: "[what to change]"
---
# Database schema change

Change requested: $ARGUMENTS

1. **Detect the migration tool** from the repo (Drizzle `drizzle.config.*`, Prisma `prisma/schema.prisma`, Go `migrations/` + goose/migrate/atlas, Laravel `database/migrations`, Doctrine `migrations/`, Django `*/migrations`, Alembic `alembic/`). Read the current schema/models of the affected tables.
2. **Design per `${CLAUDE_PLUGIN_ROOT}/rules/database.md` and show it before editing** (Mermaid ERD, normal-form reasoning, keys/FKs/ON DELETE, constraints, types, indexes with their queries):
   - exact change (columns, types, nullability, defaults, indexes, FKs, `ON DELETE`);
   - backwards compatibility (NOT NULL on a populated table needs a default or a two-step migration; renames/drops in two steps for live systems);
   - data loss? (drop/rename/type narrowing) → explicit user confirmation required.
3. **Change the model/schema source**, then **generate a new migration** with the project's command (`drizzle-kit generate`, `prisma migrate dev --create-only`, `php artisan make:migration`, `bin/console make:migration`, `manage.py makemigrations`, `alembic revision --autogenerate`, `goose create`/`migrate create`). Never edit an applied migration (hook-blocked), never reset/wipe the DB.
4. **Review the generated migration/SQL** and show the important part. Add indexes for new filter/sort/join columns.
5. **Update dependent code:** models, validation schemas/DTOs, services, queries, factories/seeders/fixtures, tests.
6. Run `/sarkhans-starter:verify`. If the project has a local test DB, run the migration there and the tests.
7. Give the user the exact command to apply it in each environment — never apply it to any non-local database yourself.
8. **`data-architect` review is mandatory** — run it on the diff; fix every blocker/major (yourself or through db-engineer) and repeat until APPROVE (a hook blocks finishing without it).
9. End with `### Agents` and `### Third eye`.
