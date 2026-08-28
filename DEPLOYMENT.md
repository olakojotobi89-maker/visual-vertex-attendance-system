# VSAS — Staff Creation Backend: Deployment Guide

This delivers the `create-staff` Supabase Edge Function plus the schema/storage
it depends on, and the updated frontend that calls it.

## Files in this delivery

```
supabase/
  functions/create-staff/index.ts        # the Edge Function
  migrations/20260724000000_staff_schema_and_storage.sql
js/
  staff-management.js                    # updated frontend logic
```

Copy `js/staff-management.js` over your existing `js/staff-management.js`.
The HTML file does not need any changes.

---

## 1. Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli) installed (`npm i -g supabase` or via Homebrew).
- A Supabase project (note its **Project Ref**, found in Project Settings → General).
- You must be an **Owner/Admin** of the project to deploy functions and run migrations.

```bash
supabase login
```

---

## 2. Link your local project

From the root of this delivery (the folder containing `supabase/`):

```bash
supabase link --project-ref <your-project-ref>
```

---

## 3. Apply the SQL migration

This adds any missing `profiles` columns, sets up Row Level Security, and
creates the public `avatars` storage bucket.

```bash
supabase db push
```

If you'd rather run it by hand, the SQL file is plain and idempotent — you
can paste `supabase/migrations/20260724000000_staff_schema_and_storage.sql`
directly into the Supabase SQL Editor instead.

> **Note:** This migration assumes a `profiles` table already exists (e.g.
> created by your Auth scaffolding) with at least an `id uuid primary key`
> column referencing `auth.users(id)`. It only *adds* columns/policies —
> it won't create the table from scratch.

---

## 4. Deploy the Edge Function

```bash
supabase functions deploy create-staff
```

The function needs three environment variables at runtime. When deployed
via the CLI, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` are **automatically injected** by Supabase —
you don't need to set them yourself for the standard deploy flow.

If you ever need to set/check secrets manually:

```bash
supabase secrets list
supabase secrets set SUPABASE_URL=https://<ref>.supabase.co
supabase secrets set SUPABASE_ANON_KEY=<your-anon-key>
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

⚠️ **Never** put `SUPABASE_SERVICE_ROLE_KEY` in any frontend file, `.env`
shipped to the browser, or client-side build config. It only belongs in
the Edge Function's server-side environment.

---

## 5. Frontend: no new secrets needed

`staff-management.js` calls the function through the existing
`window.supabaseClient` (already configured with your **anon** key), using:

```js
window.supabaseClient.functions.invoke("create-staff", { body: formData });
```

`supabase-js` automatically:
- Routes this to `https://<ref>.functions.supabase.co/create-staff`
- Attaches the signed-in admin's session as `Authorization: Bearer <token>`
- Sends `formData` as a `multipart/form-data` body (so the profile picture
  travels in the same request — no separate upload step needed client-side)

No changes are needed to `js/supabase.js` or `js/auth.js`.

---

## 6. Local testing

Run the full stack locally (Auth, Postgres, Storage, Edge Functions):

```bash
supabase start
supabase functions serve create-staff --env-file ./supabase/.env.local
```

Create `supabase/.env.local` for local testing only (never commit it):

```
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=<local-anon-key-from-`supabase status`>
SUPABASE_SERVICE_ROLE_KEY=<local-service-role-key-from-`supabase status`>
```

Get an access token for a test admin user (via your app's login flow, or
`supabase.auth.signInWithPassword` in a quick script), then test with curl:

```bash
curl -i -X POST http://localhost:54321/functions/v1/create-staff \
  -H "Authorization: Bearer <ADMIN_ACCESS_TOKEN>" \
  -F "firstName=Ada" \
  -F "lastName=Lovelace" \
  -F "email=ada@example.com" \
  -F "phone=+2348012345678" \
  -F "department=Engineering" \
  -F "position=Software Engineer" \
  -F "role=staff" \
  -F "staffId=VV-1001" \
  -F "tempPassword=TempPass123" \
  -F "profilePicture=@/path/to/photo.jpg"
```

Expected responses:
- `201` with `{ "profile": { ... } }` on success
- `400` for validation errors (missing/invalid fields, bad avatar type/size)
- `401` if the token is missing/invalid
- `403` if the caller's profile role isn't `admin`
- `409` if the email or Staff ID is already taken
- `500` for unexpected server/storage errors (fully rolled back — no orphaned Auth user)

Then confirm through the UI: open **Staff Management → Add Staff**, submit
the form, and verify the new row appears instantly, stat cards update, and
the position/department filters include the new values without a page reload.

---

## 7. Production deployment checklist

1. `supabase link --project-ref <prod-ref>` (point the CLI at your **production** project).
2. `supabase db push` — apply the migration to production.
3. `supabase functions deploy create-staff` — deploy the function to production.
4. In `supabase/functions/create-staff/index.ts`, tighten
   `CORS_HEADERS["Access-Control-Allow-Origin"]` from `"*"` to your actual
   production domain (e.g. `"https://vsas.yourcompany.com"`) and redeploy.
5. Confirm in the Supabase Dashboard → Edge Functions → `create-staff` →
   Logs that a test creation succeeds end-to-end.
6. Confirm in Dashboard → Storage that the `avatars` bucket exists and is
   public, and that a test avatar renders in the table.
7. Confirm in Dashboard → Authentication that the test user was created
   with `email_confirm = true` (no confirmation email required).
8. Rotate/regenerate the Service Role Key if it was ever pasted anywhere
   outside Supabase secrets (Slack, a `.env` committed to git, etc.) before
   going live.

---


## 8. Automatic welcome emails (Resend)

The `create-staff` Edge Function now sends a branded welcome email automatically after a staff account and profile are created. The email contains the staff member's email, temporary password, Staff ID, department, position, role, VSAS login link, and the company logo.

The Resend API key must remain server-side. In Supabase Dashboard → Edge Functions → `create-staff` → Secrets, add:

```text
RESEND_API_KEY=<your Resend API key>
```

Optional secrets:

```text
RESEND_FROM_EMAIL=Visual Vertex Technology Company <onboarding@resend.dev>
APP_URL=https://visual-vertex-attendance-system.onrender.com
```

Until a custom sending domain is verified in Resend, the function defaults to `onboarding@resend.dev`. Once your company domain is verified, replace `RESEND_FROM_EMAIL` with your company address (for example `HR <hr@yourdomain.com.ng>`).

The email is sent through Resend's HTTPS API from the Edge Function; the API key is never placed in `js/staff-management.js` or any other browser code.

If Resend temporarily rejects a recipient because of your account/domain verification status, VSAS still keeps the newly created staff account. The function returns `welcome_email.sent = false` and the admin UI shows a warning instead of falsely claiming that the email was sent.

### Deploying without the Supabase CLI

If the Supabase CLI is not installed on your Windows machine, open Supabase Dashboard → Edge Functions → `create-staff`, replace the function source with the updated `supabase/functions/create-staff/index.ts`, deploy/save the function, and make sure the `RESEND_API_KEY` secret is present. The frontend file `js/staff-management.js` must also be deployed with the project.

## 9. Security summary

| Concern | How it's handled |
|---|---|
| Service Role Key exposure | Used only inside the Edge Function's server-side runtime; never sent to or readable by the browser. |
| Privilege escalation | The function independently verifies the caller's session token and re-checks their `profiles.role === 'admin'` server-side using the Service Role client — the frontend's role check is UX only, not trusted. |
| Orphaned accounts | If avatar upload or profile insert fails after the Auth user is created, the function deletes the Auth user (and any uploaded avatar) before returning an error. |
| Duplicate accounts | Checked before user creation (Staff ID) and enforced at the database level with unique indexes on `staff_id` and `email`; Postgres unique-violation errors are mapped to `409 Conflict`. |
| Untrusted file uploads | Avatar MIME type and size are validated server-side (not just in the browser), regardless of what the client claims. |
| Data access | `profiles` RLS restricts reads to admins and the row owner; all inserts happen exclusively via the Service Role Key inside this function, so there's no client-side insert policy to misuse. |