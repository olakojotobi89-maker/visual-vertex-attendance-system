# VSAS Adversarial Security Audit

## Executive Summary

This repository was reviewed as an authorized defensive assessment. The assessment covered browser code, authentication, authorization, Supabase migrations and RLS, Edge Functions, Storage, Vertex AI, deployment configuration, secrets, error handling, and security tests.

The assessment found and remediated several high-impact issues, including manager privilege escalation, permissive legacy profile insertion, unrestricted avatar object paths, disabled Edge Function JWT verification, wildcard CORS defaults, a department UUID/type migration mismatch, attendance tampering, historical attendance aggregate enumeration, and plaintext temporary-password delivery by email.

The fixes were re-attacked with static assertions, source-level regression checks, syntax checks, dangerous-pattern searches, and deterministic input tests. Live Supabase RLS/Storage/Edge execution could not be performed because the Supabase CLI and Deno runtime are unavailable in this workspace.

No absolute-security claim is made. Deployment configuration and live database verification remain required.

## Scope

Reviewed:

- HTML, CSS, browser JavaScript, authentication, dashboard, attendance, profile, notifications, reports, staff management, departments, and PWA code.
- Vertex AI UI, local tools, research, conversation storage, provider/orchestration, URL rendering, and role checks.
- Supabase migrations, RLS policies, Storage policies, RPCs, triggers, Edge Functions, shared validation, CORS, body limits, and service-role use.
- Deployment documentation, `supabase/config.toml`, package manifest, secret patterns, redirects, external URLs, and browser storage.

## Threat Model

Assumed attacker capabilities:

- Anonymous visitor who can load public pages and modify browser code.
- Authenticated staff member who can call Supabase APIs directly with their own session.
- Authenticated manager who attempts to escalate privileges or modify another user.
- Malicious uploader or user-controlled text author.
- Attacker supplying JSON keys, URLs, filenames, dates, IDs, roles, and notification content.
- Malicious web content returned by research sources.

Out of scope:

- Destructive production requests.
- Credential theft from real users.
- Live Supabase execution from this workspace because required tooling was unavailable.

## Attack Surface

| Surface | Input | Boundary | Control status |
|---|---|---|---|
| Auth | credentials, session, redirect | Supabase Auth and `requireAuth` | Implemented, live verification pending |
| Profile | UUID, phone, avatar URL | RLS, column grants, browser URL validation | Implemented |
| Attendance | date, timestamps, row IDs | RLS, trigger integrity checks | Implemented in migration, live verification pending |
| Staff management | multipart fields, avatar file, role | Edge Auth/RBAC, allowlists, body/file checks | Implemented |
| Management API | JSON action/IDs/roles | JWT, origin, allowlist, validation, RBAC, rate limit | Implemented |
| Storage | object path, MIME, bytes | Storage RLS, path policy, server signature checks | Implemented, public reads remain |
| Vertex AI | prompts, research content, links | input validation, safe DOM, HTTPS link validation, role check | Implemented, external research remains client-side |
| Browser cache | conversations, response cache | user-scoped keys and logout cleanup | Partial; browser-local data is readable to local attackers |
| Deployment | CSP and security headers | static host/reverse proxy | Required deployment action |

## Attack and Remediation Results

### VSAS-SEC-001: Manager-to-admin privilege escalation

- **Severity:** Critical
- **Status:** Fixed in source
- **Reproduction:** Call `manage-vsas` directly as an HR/manager/CEO with `action=update_staff`, a target UUID, and `role=admin` or `is_active=false`.
- **Root cause:** The function authorized manager-class roles but allowed privileged profile fields for all of them while using the service-role client.
- **Impact:** Vertical privilege escalation and account tampering.
- **Remediation:** Role and account-status changes now require `auth.role === 'admin'`; staff deletion is admin-only.
- **Regression:** `tests/security-smoke.mjs` asserts admin-only deletion and source-level RBAC guards.

### VSAS-SEC-002: Permissive profile insertion policy

- **Severity:** Critical
- **Status:** Fixed in migration chain
- **Reproduction:** Authenticated client attempts direct `profiles` insertion with an arbitrary user ID and role.
- **Root cause:** Legacy migration used `WITH CHECK (true)`.
- **Impact:** Potential profile impersonation or role injection if the policy remained active.
- **Remediation:** Fresh legacy migration now denies browser inserts; hardening migration drops the policy and revokes browser insert/delete/update grants except approved columns.
- **Regression:** Smoke test checks for removal of the permissive policy and presence of restricted policy/grants.

### VSAS-SEC-003: Avatar object namespace abuse

- **Severity:** High
- **Status:** Fixed for writes; public reads remain
- **Reproduction:** Authenticated user attempts upload/update/delete under another user's folder or with a non-UUID object name.
- **Root cause:** Legacy Storage insert policy checked only authentication and bucket name.
- **Impact:** Storage abuse, overwrite attempts, and arbitrary public object creation.
- **Remediation:** Owner-folder and UUID filename policies; server-side size, MIME, and magic-byte validation.
- **Residual:** Existing public avatar URLs remain publicly readable for compatibility.
- **Regression:** Storage policy and filename assertions are in the smoke suite; live RLS execution remains pending.

### VSAS-SEC-004: Edge Function boundary weakening

- **Severity:** High
- **Status:** Fixed in configuration/source
- **Reproduction:** Directly call privileged functions without relying on the frontend.
- **Root cause:** `verify_jwt=false`, wildcard CORS fallback, and no shared origin/rate guard.
- **Impact:** Larger attack surface and easier abuse of privileged endpoints.
- **Remediation:** Enabled platform JWT verification, explicit origin checks, secure response headers, request validation, and per-user throttles.
- **Residual:** In-memory throttling is not distributed.

### VSAS-SEC-005: Attendance business-logic tampering

- **Severity:** High
- **Status:** Fixed in migration source
- **Reproduction:** Directly insert future dates, future timestamps, alter `staff_id`, rewrite `check_in`, set checkout before check-in, or reopen a completed row.
- **Root cause:** RLS checked ownership but not temporal/state integrity.
- **Impact:** Forged attendance and unreliable reports.
- **Remediation:** `validate_attendance_event` trigger rejects future values, invalid ordering, identity/check-in rewrites, and completed-record reopening for non-managers.
- **Regression:** Smoke test asserts the trigger exists; live SQL tests remain pending.

### VSAS-SEC-006: Historical attendance aggregate enumeration

- **Severity:** Medium
- **Status:** Fixed in migration source
- **Reproduction:** Authenticated user calls `today_attendance_summary('2020-01-01')` or a future date.
- **Root cause:** RPC accepted arbitrary dates and was executable by every authenticated user.
- **Impact:** Workforce activity inference across historical/future dates.
- **Remediation:** RPC rejects any date other than `current_date`, revokes public execution, and grants only authenticated execution.

### VSAS-SEC-007: Plaintext temporary password email

- **Severity:** High
- **Status:** Fixed in source
- **Reproduction:** Inspect the generated welcome-email HTML or a recipient mailbox.
- **Root cause:** The Edge Function interpolated the temporary password into email HTML.
- **Impact:** Credential disclosure through mail systems and forwarding.
- **Remediation:** Password is no longer included; credentials must use an approved secure delivery or recovery flow.
- **Residual:** A future invite/recovery flow should eliminate admin-supplied passwords entirely.

### VSAS-SEC-008: Department UUID/BIGINT migration mismatch

- **Severity:** High
- **Status:** Fixed in migration source
- **Reproduction:** Apply the migration sequence to a schema where `departments.id` is UUID.
- **Root cause:** Later migration declared `profiles.department_id` and notification department IDs as BIGINT.
- **Impact:** Migration failure, leaving later security policies unapplied.
- **Remediation:** Aligns department references to UUID and restores UUID validation in the Edge Function.
- **Regression:** Smoke test asserts UUID schema alignment; live migration execution remains pending.

## Other Tests

- Dangerous-key patterns: existing recursive guard reviewed; shared JSON path rejects dangerous keys and deep nesting.
- XSS: AI and research rendering uses safe DOM construction; reviewed escaped HTML sinks remain candidates for DOM-only refactoring.
- URL protocols: browser security tests reject `javascript:`, `data:`, and `file:` protocols; Vertex links require HTTP(S).
- Secrets: repository scan found no frontend service-role, private-key, or literal secret assignments.
- SQL injection: browser Supabase queries use SDK query builders; no unsafe user-composed SQL was found in application code.
- Conversation isolation: Vertex conversation storage is keyed by authenticated user ID; logout removes the user-scoped store. Local browser storage remains readable by a local attacker.
- Prompt injection/tool abuse: no privileged AI tool executor exists; research is informational and local tools are deterministic. External content must remain untrusted.

## Verification

Passed:

- `npm run test:security`
- JavaScript syntax checks across the repository
- Patch whitespace validation
- Secret-pattern and active-policy searches

Not verified locally:

- Supabase SQL execution and RLS behavior with real anonymous/staff/manager/admin sessions.
- Storage policy behavior against real object uploads.
- Edge Function deployment/runtime compilation because Supabase CLI and Deno are unavailable.
- Production CSP, HSTS, frame protection, and proxy headers.
- Dependency vulnerability database results; the repository has no installed lockfile-driven audit environment.

## Required Next Steps

1. Install Supabase CLI/Deno and apply migrations in an isolated project.
2. Run anonymous, staff, manager, and admin RLS/storage tests against that project.
3. Configure CSP, HSTS, `frame-ancestors`, Referrer-Policy, and Permissions-Policy at the static host.
4. Set an explicit production `ALLOWED_ORIGIN` and `ALLOWED_ORIGINS` secret.
5. Migrate public avatars to private storage and signed URLs.
6. Replace temporary-password creation with Supabase invite/recovery links.
7. Add distributed rate limiting at the gateway or durable database layer.
8. Review repository/deployment history and rotate any secret ever exposed outside secret storage.
