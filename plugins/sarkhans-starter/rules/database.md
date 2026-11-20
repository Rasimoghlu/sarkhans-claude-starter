---
paths:
  - "**/db/**"
  - "**/database/**"
  - "**/migrations/**"
  - "**/models/**"
  - "**/Models/**"
  - "**/Entity/**"
  - "**/entities/**"
  - "**/models.py"
  - "**/repository/**"
  - "**/repositories/**"
  - "**/Repositories/**"
  - "**/schema.*"
  - "**/*.sql"
  - "**/*.prisma"
  - "drizzle/**"
  - "prisma/**"
  - "alembic/**"
---
# Database design & data rules (all ORMs, all engines) — mandatory

Every schema change is designed by `architect`, built by `db-engineer`, and **reviewed by `data-architect` before it is accepted** (a hook blocks finishing without that review). A migration lint hook rejects the common mistakes below.

## 1. Normalization (default: 3NF)
- **1NF:** atomic values only. No comma-separated lists, no arrays/JSON used to hold related rows, no repeating column groups (`phone1`, `phone2`, `phone3`).
- **2NF:** every non-key column depends on the whole key (watch composite keys).
- **3NF:** no transitive dependencies — a fact is stored once, in the table it describes (customer's email lives in `customers`, not copied into `orders`).
- **Denormalization only with a written reason** in the plan (measured read hot-path, reporting table, cache column with a defined sync strategy) — never by default.
- Snapshot values that must not change later (price at time of order, address on an invoice) are **intentional copies** — name them clearly (`unit_price_at_purchase`) and say why.

## 2. Keys & relationships
- Every table has a primary key (bigint identity/auto-increment or UUID/ULID — follow the project's convention).
- Every reference to another table is a **real foreign key constraint** with an explicit `ON DELETE` (`RESTRICT` by default; `CASCADE` only for owned children; `SET NULL` only for optional links).
- One-to-many: FK on the "many" side. One-to-one: FK + `UNIQUE`. **Many-to-many: a junction table** with two FKs and a composite primary key or `UNIQUE(a_id, b_id)` — never ID lists in a column.
- Polymorphic relations (`*_type` + `*_id`) only if the framework requires it, and documented; prefer separate FKs or separate tables.
- No EAV (entity–attribute–value) designs for structured data.

## 3. Constraints — the database enforces integrity, not only the app
- `NOT NULL` unless null has a real meaning; sensible defaults.
- `UNIQUE` for natural uniqueness (emails per tenant, slugs, external IDs); `CHECK` for ranges/states (`quantity > 0`, `status IN (...)`) where the engine supports it.
- Enum-like values: DB enum/check constraint or a lookup table — not free text.

## 4. Types
- Money: integer minor units (`bigint` cents) or `DECIMAL(19,4)` — **never float/double/real**.
- Timestamps: timezone-aware (`timestamptz` on Postgres) stored in UTC; `created_at`/`updated_at` on business tables.
- Right-sized types: `boolean` not `tinyint` strings, `date` for dates, `uuid` type for UUIDs, `text`/`varchar(n)` with a real limit.
- JSON columns only for genuinely unstructured/external payloads — never for data you filter, join or validate.

## 5. Indexes
- Index every foreign key column (PostgreSQL does **not** create these automatically).
- Index columns used in `WHERE`, `JOIN`, `ORDER BY` of real queries; composite index column order = equality columns first, then range/sort.
- Unique indexes for uniqueness rules; partial indexes for soft-delete/status filters where supported.
- No duplicate or unused indexes; every index has a query that needs it (state it in the plan).

## 6. Naming
- Tables: plural `snake_case` (`order_items`); columns `snake_case`; FKs `<singular>_id` (`order_id`); junction tables `a_b` alphabetical or a domain name (`memberships`).
- Constraint/index names follow the framework convention or `<table>_<columns>_<type>` (`orders_customer_id_idx`).
- Columns ending in `_id` are foreign keys. External/third-party identifiers use a clear name (`stripe_customer_id` is fine with a `UNIQUE` constraint and no FK).

## 7. Migrations & safety
- Always a **new** migration from the project's tool; never edit an applied one (hook-blocked); never reset/wipe/drop databases or volumes (hook-blocked).
- Backwards-compatible steps for live data: add nullable/defaulted → backfill → add constraint; renames/drops in two deploys.
- Large tables: create indexes concurrently where supported; avoid long locks.
- Down/rollback migrations where the tool supports them.

## 8. Queries
- Parameterized only. Owner/tenant scoping on every user-data query. Pagination on lists. No N+1 (eager loading). Transactions for multi-step writes. Select only needed columns.

## 9. Required in the plan for any schema change
An ER diagram (Mermaid `erDiagram`) of the affected tables, the normal-form reasoning, keys/FKs/`ON DELETE`, constraints, indexes with the queries they serve, and the migration/backfill steps.
