# VSAS Security Architecture

## Scope

VSAS uses defense in depth. Browser checks improve user experience, but authentication, Edge Function authorization, Supabase RLS, and Storage policies are the security boundaries.

## Implemented layers

- Supabase Auth session validation on protected pages and Edge Functions.
- Supabase Edge Function JWT verification enabled for privileged functions.
- Server-side role checks in `create-staff` and `manage-vsas`.
- Request origin, method, content type, body-size, UTF-8, JSON-shape, dangerous-key, allowlist, and field validation.
- Per-user Edge Function request throttles for staff creation and management operations.
- Database RLS for profiles, attendance, announcements, notifications, recipients, logs, and storage objects.
- Removal of the legacy permissive profile insert policy.
- Storage object path ownership checks and image signature validation.
- Safe browser URL and error helpers; logout clears session storage and user-scoped Vertex state.
- Vertex AI renders untrusted responses and research content through safe DOM APIs and restricts external links to HTTP(S).
- Audit records are append-only from browser roles and readable only by staff managers.
- Attendance trigger rejects future timestamps, invalid ordering, identity/check-in rewrites, and reopening completed records.
- The attendance summary RPC only serves the current date.
- Welcome emails no longer contain temporary passwords.

## Authentication and authorization

The client calls `VSASAuth.requireAuth()` for navigation. This is not trusted authorization. Privileged writes go through Edge Functions or database policies. `manage-vsas` independently checks the caller profile and only administrators may change roles or account status.

The application uses bearer-token Supabase requests rather than cookie-authenticated application endpoints, so traditional CSRF tokens are not the primary control. Origin validation and Supabase Auth/RLS remain required.

## Headers and deployment

Configure these at the static host or reverse proxy. Do not rely on JavaScript for headers:

```text
Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' https://*.supabase.co data:; font-src 'self' https://fonts.gstatic.com; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; script-src 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; connect-src 'self' https://*.supabase.co https://api.resend.com https://en.wikipedia.org https://*.wikipedia.org; frame-src 'none'; upgrade-insecure-requests
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

The current HTML has legacy inline scripts and styles, so `unsafe-inline` remains a compatibility compromise. Move those blocks to external files and use nonces before removing it. `frame-ancestors` must be delivered as an HTTP header, not a meta tag.

## Storage

The current hardening migration restricts avatar writes to UUID-named objects in the caller's folder but preserves public reads for compatibility with existing stored URLs. Public avatar reads are a remaining privacy risk. The next migration should store object paths instead of public URLs, make the bucket private, and issue short-lived signed URLs to authorized viewers.

## Status boundaries

### Implemented

The controls listed above exist in source and are covered by repository smoke assertions. Browser JavaScript checks are not treated as authorization boundaries.

### Partially implemented

- Security headers/CSP are documented but require production host configuration.
- In-memory Edge Function throttles mitigate bursts per runtime but are not distributed.
- Avatar writes are owner-scoped, but legacy public avatar reads remain enabled.
- Live Supabase RLS, Storage, and Edge Function behavior has not been executed from this workspace because the Supabase CLI/Deno runtime is unavailable.

### Planned

- Private avatar bucket with path storage and short-lived signed URLs.
- Gateway/database-backed distributed rate limiting.
- Password invite/recovery flow instead of admin-supplied temporary passwords.
- Replace remaining escaped `innerHTML` templates with DOM construction and remove CSP `unsafe-inline`.

## Audit findings and remaining risks

- Existing frontend rendering uses `innerHTML` in several places. User-controlled text is escaped in the reviewed announcement, notification, staff, and dashboard paths, but replacing these sinks with DOM construction is recommended.
- In-memory Edge Function rate limits are per runtime instance and are not a distributed abuse control. Add a durable limiter at the Supabase/API gateway layer for production.
- Existing Supabase anon/publishable credentials are browser-visible by design; RLS is mandatory and must be verified after every schema change.
- Dependency audit and secret rotation still require access to the deployment and repository history. Rotate any service-role or Resend key ever exposed outside Supabase secrets.
- Browser storage can be inspected by the local user. Do not place secrets or sensitive staff records in it.

No application can honestly guarantee absolute security. Re-run RLS, storage, dependency, secret, and incident-response reviews before production changes.
