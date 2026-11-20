---
paths:
  - "**/api/**"
  - "**/server/**"
  - "**/actions/**"
  - "**/handlers/**"
  - "**/handler/**"
  - "**/controllers/**"
  - "**/Controllers/**"
  - "**/routes/**"
  - "**/routers/**"
  - "**/views.py"
  - "**/internal/**"
  - "**/cmd/**"
---
# Server code: endpoints, handlers, controllers, actions (all languages)

Every endpoint / handler / controller action / server action follows this order — no exceptions:

1. **Authenticate** — no session/token → 401.
2. **Authorize** — the user may act on *this specific resource* (ownership / role / policy) → otherwise 403. Never trust IDs, roles, prices or flags sent by the client.
3. **Validate** — parse the input with the project's validator (zod, go-playground/validator or explicit checks, Laravel FormRequest / Symfony Validator, Pydantic / DRF serializers). Unknown fields rejected where it matters. Invalid → 400/422 with field errors.
4. **Execute** — call a service/use-case; handlers/controllers stay thin (no business logic, no raw queries).
5. **Respond** — only the fields the client needs (DTO/resource/serializer). Never leak stack traces, DB errors, internal IDs or secrets.

## Conventions
- One consistent error shape for the whole API, e.g. `{ "error": { "code": "...", "message": "...", "fields": {...} } }` — follow the project's existing shape if it has one.
- Correct status codes: 200/201/204, 400/422, 401, 403, 404, 409, 429, 500.
- Config and secrets come from one validated config/env module, never scattered env reads.
- Rate-limit login, signup, password reset, OTP, email/SMS sending and expensive endpoints.
- Webhooks verify signatures and handle replays/idempotency.
- Outbound calls: timeout, error handling for non-2xx, no secrets in logs.
- Long-running work goes to a job/queue; the endpoint returns quickly.
- Every handler has tests for success, 400/422, 401, 403 (see `testing.md`).
