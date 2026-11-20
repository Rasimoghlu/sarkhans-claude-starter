---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
  - "**/*.mjs"
  - "**/*.vue"
  - "**/*.svelte"
  - "**/*.go"
  - "**/*.php"
  - "**/*.py"
  - "**/*.rs"
  - "**/*.java"
  - "**/*.kt"
  - "**/*.cs"
  - "**/*.swift"
  - "**/*.dart"
  - "**/*.rb"
  - "**/*.scala"
  - "**/*.c"
  - "**/*.cpp"
  - "**/*.h"
  - "**/*.hpp"
---
# Security rules

Security is never traded for speed or convenience. When in doubt, choose the safer option and tell me.

## Secrets
- Never read, print, log, or commit secrets. `.env*` files are off-limits except `.env.example` (names only, no values). A hook enforces this.
- Never hardcode API keys, tokens, passwords, connection strings or private URLs. A hook rejects common key formats.
- Env vars are read only in the project's validated config module (TS: `src/env.ts`; Go: `internal/config`; PHP: `config/*.php` via `env()` only there; Python: `settings.py`/`config.py` with pydantic-settings). Client-exposed vars (`NEXT_PUBLIC_*`, `VITE_*`) never contain secrets.

## Input & output
- Validate every external input at the boundary with the project's validator (zod, Pydantic, FormRequest/Validator, Go validator). Reject unknown fields where it matters.
- Never use `dangerouslySetInnerHTML` with user-controlled content; if HTML must render, sanitize it (DOMPurify) — a hook checks.
- No `eval`/`exec`/`new Function`, no dynamic imports/includes from user input, no shell commands built from user input (`shell=True`, `exec()`, `system()`, `os/exec` with `sh -c`). No unsafe deserialization (`pickle`, `unserialize`, `yaml.load`) of untrusted data.
- SQL only via ORM / parameterized queries.
- Responses return only the fields the client needs. Never leak stack traces, DB errors, or internal IDs.

## Access control
- Every Route Handler and Server Action: authenticate → authorize (ownership/role on *this* resource) → validate → execute. Middleware alone is never enough.
- Never trust IDs, roles, prices or flags sent by the client.
- Admin functionality is protected server-side, not just hidden in the UI.
- CSRF protection stays on for cookie-authenticated forms (framework defaults: Laravel/Django/Symfony middleware).

## Web
- Redirects to user-provided URLs are validated against an allowlist (open redirect).
- Server-side fetches to user-provided URLs block internal IPs/localhost/metadata endpoints (SSRF).
- Uploads: validate type (magic bytes, not just extension) and size server-side, generate own file names, store outside `public/`.
- Cookies: `httpOnly`, `secure`, `sameSite=lax` or stricter. Never store tokens in `localStorage`.
- Security headers configured (CSP, `frame-ancestors`, `Referrer-Policy`, HSTS, `X-Content-Type-Options`).
- Rate-limit login, signup, password reset, OTP, email/SMS sending, AI calls and other expensive endpoints.
- Webhooks verify signatures and handle replays.
- Passwords and sessions are handled only by the auth library/framework — never custom crypto. Never `md5`/`sha1` for passwords.
- Never disable TLS verification (`verify=False`, `InsecureSkipVerify: true`, `rejectUnauthorized: false`, `CURLOPT_SSL_VERIFYPEER => false`).

## Dependencies
- New packages need my approval; check maintenance, downloads and exact name (typosquatting).
- Report vulnerable dependencies you notice in the Third-eye section.

## Never
- Disable CSRF protection, auth checks, TLS verification, CSP, or validation to "make it work". Ask instead.

For a full review: `/security-audit`, plus Claude Code's built-in `/security-review` on the branch.
