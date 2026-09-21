# VSAS Vulnerability Register

| ID | Severity | Finding | Status |
|---|---|---|---|
| VSAS-SEC-001 | Critical | Manager roles could alter `role`/`is_active` through the service-role management function. | Fixed in source; deploy and live-test required |
| VSAS-SEC-002 | Critical | Legacy profile insert policy used `WITH CHECK (true)`. | Fixed in migration chain |
| VSAS-SEC-003 | High | Authenticated users could upload arbitrary avatar object paths in a public bucket. | Write path fixed; public reads remain |
| VSAS-SEC-004 | High | Privileged Edge Functions disabled platform JWT verification and defaulted to wildcard CORS. | Fixed in source/config |
| VSAS-SEC-005 | High | Attendance rows allowed forged dates/times and state rewrites. | Fixed by database trigger migration |
| VSAS-SEC-006 | Medium | Attendance summary RPC accepted arbitrary dates. | Fixed by current-date restriction |
| VSAS-SEC-007 | High | Temporary passwords were included in plaintext welcome emails. | Fixed; secure invite/recovery flow still recommended |
| VSAS-SEC-008 | High | Department UUID/BIGINT mismatch could abort migrations before security policies applied. | Fixed in migration source |
| VSAS-SEC-009 | Medium | CSP/security headers are not present in repository deployment configuration. | Documented; requires host configuration |
| VSAS-SEC-010 | Medium | Edge throttles are in-memory and per runtime instance. | Partial mitigation; durable limiter required |
| VSAS-SEC-011 | Medium | Avatar reads remain public for legacy URL compatibility. | Residual risk; signed URL migration required |
| VSAS-SEC-012 | Low | Several escaped frontend `innerHTML` templates remain. | No confirmed XSS; DOM-only refactor recommended |

## Regression coverage

`npm run test:security` checks the source-level remediations for policy removal, JWT/CORS settings, storage namespace restrictions, Vertex authorization, attendance integrity, current-date RPC restriction, UUID schema alignment, password-email removal, and unsafe URL protocols.

Live RLS, Storage, Edge Function, CSP, dependency, and production-header tests remain deployment tasks because the local Supabase CLI/Deno runtime is unavailable.
