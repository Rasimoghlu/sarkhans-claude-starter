---
paths:
  - "**/*.py"
  - "pyproject.toml"
  - "requirements*.txt"
---
# Python rules (3.10+; Django / FastAPI / Flask aware)

## Language
- Type hints on every function signature and public attribute; the project's type checker (mypy/pyright) stays green. No `Any` (a hook flags it) — use precise types, `Protocol`, `TypedDict`, generics.
- No docstrings or comments (project rule) — names and types document the code. Tool directives need a code: `# type: ignore[attr-defined]`, `# noqa: E501`.
- `is None` / `is not None`, never `== None`. No bare `except:`; no `except ...: pass`. Catch the narrowest exception and add context (`raise DomainError(...) from exc`).
- No mutable default arguments, no `from x import *`, no `print()` in app code (use `logging`), no `eval`/`exec`, no `shell=True`, no `pickle`/`yaml.load` on untrusted data, never `verify=False`.
- Data containers: `dataclass(frozen=True, slots=True)` or Pydantic models — not loose dicts across boundaries.
- `pathlib` over `os.path`; f-strings for text, never for SQL.
- Settings only from one settings/config module (Django `settings.py`, pydantic-settings `config.py`) — no scattered `os.environ`.

## Architecture
- Views/routers stay thin: validate (serializer / Pydantic schema) → service function → response schema.
- Django: `select_related`/`prefetch_related` against N+1, `QuerySet` methods over Python loops, `transaction.atomic` for multi-step writes, permissions classes/decorators for authorization, migrations via `makemigrations` (never edit applied ones).
- FastAPI: dependency injection with `Depends` for DB sessions/auth, async endpoints must not call blocking I/O (use async drivers or `run_in_threadpool`), response models on every route, Alembic for migrations.
- Outbound HTTP (`httpx`/`requests`) always with `timeout=`.

## Tests
- pytest with fixtures/factories (factory_boy if present), `pytest.mark.parametrize` for input tables, `pytest-django`'s `client`/`db`, FastAPI `TestClient`/`httpx.AsyncClient`. No real network.

## Tooling (run by hooks and /verify)
`ruff format` + `ruff check --fix` (or black) and `py_compile` on edit; `ruff check`, type checker, `pytest` in `/verify`. Uses `.venv`/`venv` if present.
New packages (`pip install`, `uv add`, `poetry add`) need the user's approval. Never `manage.py flush` or drop databases (hook-blocked).
