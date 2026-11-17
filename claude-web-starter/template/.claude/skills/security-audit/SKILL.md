---
name: security-audit
description: Full security audit of this codebase (any stack: TypeScript/Next.js, Go, PHP, Python) (OWASP Top 10 focused) producing a prioritized report with file:line evidence and fixes. Run manually before releases or after big changes.
argument-hint: "[optional: path or area to focus on]"
---
# Security audit

> **ADE:** the Orchestrator follows this playbook for planning and verification and hands the implementation steps to the specialist agents (security-auditor; fixes go to the owning specialists) inside their briefs. The main session never edits code itself.

Scope: $ARGUMENTS (empty = whole project)

Use the `security-auditor` subagent for the deep code read if it is available, so the audit runs with fresh context. Do NOT modify code during the audit — report first, fix only after the user picks what to fix.

## 1. Map the attack surface
- List every Route Handler (`app/**/route.ts`), Server Action (`"use server"`), middleware, webhook, file upload, and external integration.
- Identify auth library and where sessions are checked.

## 2. Check each item (record file:line evidence)
**Access control (A01)** — every route/action authenticates *and* checks resource ownership/role; no IDOR (IDs from client used without ownership check); middleware not the only guard; admin routes protected.
**Injection (A03)** — raw SQL with interpolation; `dangerouslySetInnerHTML`; `eval`/`new Function`; shell commands with user input; unsanitized markdown/HTML rendering.
**Validation** — every external input parsed with the project's validator (zod, Pydantic/serializers, FormRequest/Validator, Go validation): body, params, query, forms, headers, webhooks, env.
**Secrets & data exposure (A02)** — secrets in code or git history hints; `NEXT_PUBLIC_` vars containing secrets; server-only modules imported in client components; responses returning sensitive fields; stack traces leaking.
**Auth & session (A07)** — cookie flags; rate limiting on login/signup/reset/OTP; password reset token expiry and single use; account enumeration in error messages.
**SSRF / redirects** — server fetches to user URLs; open redirects to user-supplied `next`/`return_to` parameters.
**Uploads** — type/size validated server-side, storage location, generated file names.
**Security headers / config (A05)** — CSP, `frame-ancestors`, `Referrer-Policy`, HSTS, CORS policy, debug mode off in production (`APP_DEBUG`, `DEBUG`), framework CSRF on, TLS verification on.
**Dependencies (A06)** — run the audit tools that are installed: `npm audit --omit=dev` / `pnpm audit --prod`, `govulncheck ./...`, `composer audit`, `pip-audit`; list high/critical with upgrade path. Do not install new tools without approval.
**Webhooks** — signature verification, replay protection.
**AI features (if any)** — prompt injection paths, user content reaching tools, missing rate limits/cost caps.

## 3. Report
Write `reports/security-audit-<YYYY-MM-DD>.md`:

| # | Severity | Category | Location | Issue | Exploit scenario | Fix |
|---|----------|----------|----------|-------|------------------|-----|

- Severity: Critical / High / Medium / Low / Info. Only include findings with concrete evidence; mark uncertain ones as "Needs manual check".
- End with: top 3 fixes to do first, and what was out of scope.

## 4. Then
Show the summary to the user and ask which findings to fix. Also suggest running Claude Code's built-in `/security-review` on the current branch as a second pass.

End with the `### Third eye` section if any code changed.
