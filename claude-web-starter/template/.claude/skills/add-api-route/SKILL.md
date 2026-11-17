---
name: add-api-route
description: Add an API endpoint / route / controller action / handler / server action / webhook in any stack (Next.js, Go, Laravel/Symfony, Django/FastAPI) with authentication, authorization, validation, consistent errors and tests. Use when the user asks for a new endpoint, route, handler, controller action or webhook.
argument-hint: "[METHOD /path – what it does]"
---
# Add an API endpoint

> **ADE:** the Orchestrator follows this playbook for planning and verification and hands the implementation steps to the specialist agents (backend-dev) inside their briefs. The main session never edits code itself.

Request: $ARGUMENTS

## 1. Find the house style first
Open 1–2 existing endpoints of the same kind in this repo and copy their structure: routing registration, auth middleware/guards, validation approach, service layer, response/error shape, test style. Cite them (file:line) in your plan. If there is no existing endpoint, use the stack defaults below.

## 2. Required flow (every stack)
authenticate → authorize (this user, this resource) → validate input → call service → map to response DTO → correct status code. See `.claude/rules/api-and-server.md`.

| Stack | Routing | Validation | Authorization | Response |
|---|---|---|---|---|
| Next.js | `app/**/route.ts` or Server Action | zod `safeParse` | session check + ownership in service | `NextResponse.json` / typed result |
| Go | router used in repo (net/http, chi, gin, echo) | decode + validator / explicit checks | middleware for authn + check in service | encoder helper of the repo |
| Laravel | `routes/api.php` + controller | FormRequest | Policy / Gate (`authorize`) | API Resource |
| Symfony | attribute routes | DTO + Validator constraints | Voter (`denyAccessUnlessGranted`) | serializer/normalizer |
| Django / DRF | `urls.py` + view/ViewSet | Serializer | permission classes + object permissions | Serializer |
| FastAPI | `APIRouter` | Pydantic model | `Depends` auth + ownership check | `response_model` |

## 3. Checklist before finishing
- [ ] Authentication and per-resource authorization enforced server-side
- [ ] Input validated; unknown/extra fields handled; output contains only needed fields
- [ ] Error shape and status codes match the project convention
- [ ] Rate limiting considered for public/expensive endpoints; webhook signatures verified
- [ ] No business logic or raw queries in the handler; dependencies injected
- [ ] Tests: success, invalid input, 401, 403 (and 404 where relevant), run and green
- [ ] Every API/package used verified to exist in the installed version — no guessed imports or methods
- [ ] `/verify` passes; `### Third eye` written
