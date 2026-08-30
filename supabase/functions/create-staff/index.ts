// -----------------------------------------------------------------------
// supabase/functions/create-staff/index.ts
//
// Creates a new staff member (Supabase Auth user + `profiles` row) on
// behalf of an authenticated Admin. This is the ONLY place the Service
// Role Key is used — it never reaches the browser.
//
// Expects a multipart/form-data POST body (so the profile picture can be
// streamed straight through) with the following fields:
//
//   firstName      string   required
//   lastName       string   required
//   email          string   required
//   phone          string   optional
//   department     string   required
//   position       string   required
//   role           string   required   ("admin" | "hr" | "manager" | "staff")
//   staffId        string   required
//   tempPassword   string   required   (min 8 chars)
//   profilePicture File     optional   (image/jpeg | image/png, max 2MB)
//
// No other form fields are accepted — see ALLOWED_FORM_FIELDS below.
//
// Auth: the caller's Supabase session access token must be sent in the
// `Authorization: Bearer <token>` header. When called via
// `supabase.functions.invoke()` from the browser, supabase-js does this
// automatically using the current session.
//
// NOTE: Imports use the root `deno.json` import map (npm specifiers via
// esm.sh), so VS Code can resolve types and you won't see "Cannot find
// module" errors.
// -----------------------------------------------------------------------

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  CORS_HEADERS,
  errorResponse,
  handleOptions,
  jsonResponse,
} from "../_shared/cors.ts";
import {
  rejectByContentLength,
  DEFAULT_MAX_MULTIPART_BODY_BYTES,
  requireString,
  optionalPhone,
  requireEmail,
  requireEnum,
} from "../_shared/security/mod.ts";

// --------------------------------------------------------------------------
// Environment
// --------------------------------------------------------------------------

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
  // Fails fast at deploy/boot time rather than on the first request.
  console.error("[create-staff] Missing required environment variables.");
}

const AVATAR_BUCKET = "avatars";
const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png"]);
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB
const VALID_ROLES = ["admin", "hr", "manager", "ceo", "staff"] as const;

// The exact set of form fields this endpoint accepts. Anything else in the
// multipart body is rejected up front (see parseForm()).
const ALLOWED_FORM_FIELDS = new Set([
  "firstName",
  "lastName",
  "email",
  "phone",
  "department",
  "position",
  "role",
  "staffId",
  "tempPassword",
  "profilePicture",
]);

// Reasonable maximum lengths for the text fields. These bound how much
// data can flow into the DB insert / welcome email per field.
const FIELD_MAX_LENGTHS = {
  firstName: 100,
  lastName: 100,
  department: 100,
  position: 100,
  staffId: 64,
} as const;
const MAX_TEMP_PASSWORD_LENGTH = 128;

// Resend configuration. The API key is stored only in Supabase Edge Function
// secrets and is never exposed to the browser. Until a custom domain is
// verified, Resend can use its onboarding@resend.dev sender for testing.
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM =
  Deno.env.get("RESEND_FROM_EMAIL") ||
  "Visual Vertex Technology Company <onboarding@resend.dev>";
const APP_URL =
  Deno.env.get("APP_URL") ||
  "https://visual-vertex-attendance-system.onrender.com";
const LOGO_URL = `${APP_URL.replace(/\/$/, "")}/images/logo.png`;

// --------------------------------------------------------------------------
// Small helpers
// --------------------------------------------------------------------------

interface StaffPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  role: string;
  staffId: string;
  tempPassword: string;
}

/** Validates the parsed form fields. Returns a list of human-readable errors. */
function validatePayload(values: Partial<StaffPayload>): string[] {
  const errors: string[] = [];

  const firstName = requireString(values.firstName, "First name", {
    maxLength: FIELD_MAX_LENGTHS.firstName,
  });
  if (!firstName.ok) errors.push(firstName.error.message);

  const lastName = requireString(values.lastName, "Last name", {
    maxLength: FIELD_MAX_LENGTHS.lastName,
  });
  if (!lastName.ok) errors.push(lastName.error.message);

  const email = requireEmail(values.email, "Email");
  if (!email.ok) errors.push(email.error.message);

  const phone = optionalPhone(values.phone, "Phone number");
  if (!phone.ok) errors.push(phone.error.message);

  const department = requireString(values.department, "Department", {
    maxLength: FIELD_MAX_LENGTHS.department,
  });
  if (!department.ok) errors.push(department.error.message);

  const position = requireString(values.position, "Position", {
    maxLength: FIELD_MAX_LENGTHS.position,
  });
  if (!position.ok) errors.push(position.error.message);

  const role = requireEnum(values.role, "Role", VALID_ROLES);
  if (!role.ok) errors.push(role.error.message);

  const staffId = requireString(values.staffId, "Staff ID", {
    maxLength: FIELD_MAX_LENGTHS.staffId,
  });
  if (!staffId.ok) errors.push(staffId.error.message);

  const tempPassword = requireString(values.tempPassword, "Temporary password", {
    minLength: 8,
    maxLength: MAX_TEMP_PASSWORD_LENGTH,
  });
  if (!tempPassword.ok) errors.push(tempPassword.error.message);

  return errors;
}

/** Confirms the bearer token belongs to a signed-in user whose profile role is "admin". */
async function requireAdmin(
  req: Request,
  adminClient: SupabaseClient,
): Promise<{ ok: true; userId: string } | { ok: false; status: number; message: string }> {
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, status: 401, message: "Missing or malformed Authorization header." };
  }
  const token = authHeader.replace("Bearer ", "").trim();

  // Validate the token against Auth using an anon-key client scoped to this request.
  const callerClient = createClient(SUPABASE_URL!, ANON_KEY!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await callerClient.auth.getUser(token);
  if (userError || !userData?.user) {
    return { ok: false, status: 401, message: "Invalid or expired session." };
  }

  const callerId = userData.user.id;

  // Use the admin client (bypasses RLS) to reliably read the caller's role.
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", callerId)
    .single();

  if (profileError || !profile) {
    return { ok: false, status: 403, message: "Caller profile not found." };
  }

  if (profile.role !== "admin") {
    return { ok: false, status: 403, message: "Only admins can create staff members." };
  }

  return { ok: true, userId: callerId };
}

/** Reads and validates a multipart/form-data request. */
async function parseForm(
  req: Request,
): Promise<
  | { values: StaffPayload; profilePicture: File | null }
  | { error: string; status?: number }
> {
  // Confirm the request actually claims to be multipart/form-data before
  // handing it to req.formData(), which otherwise throws a generic error
  // for any malformed or unexpected body.
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return { error: "Expected a multipart/form-data request.", status: 400 };
  }

  // Cheap early rejection for obviously oversized bodies (based on
  // Content-Length). req.formData() reads the whole stream internally, so
  // this pre-check — plus the per-field text limits and existing 2MB
  // avatar cap below — is what bounds this endpoint's request size.
  const sizeCheck = rejectByContentLength(req, DEFAULT_MAX_MULTIPART_BODY_BYTES);
  if (sizeCheck) {
    return { error: sizeCheck.message, status: sizeCheck.status };
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return { error: "Expected multipart/form-data body.", status: 400 };
  }

  const unexpectedFields = [...new Set([...form.keys()])].filter(
    (key) => !ALLOWED_FORM_FIELDS.has(key),
  );
  if (unexpectedFields.length > 0) {
    return { error: `Unexpected field(s): ${unexpectedFields.join(", ")}.`, status: 400 };
  }

  const values: StaffPayload = {
    firstName: String(form.get("firstName") ?? ""),
    lastName: String(form.get("lastName") ?? ""),
    email: String(form.get("email") ?? "").toLowerCase(),
    phone: String(form.get("phone") ?? ""),
    department: String(form.get("department") ?? ""),
    position: String(form.get("position") ?? ""),
    role: String(form.get("role") ?? ""),
    staffId: String(form.get("staffId") ?? ""),
    tempPassword: String(form.get("tempPassword") ?? ""),
  };

  const rawFile = form.get("profilePicture");
  const profilePicture = rawFile instanceof File && rawFile.size > 0 ? rawFile : null;

  if (profilePicture) {
    if (!ALLOWED_AVATAR_TYPES.has(profilePicture.type)) {
      return { error: "Profile picture must be a JPG or PNG image.", status: 400 };
    }
    if (profilePicture.size > MAX_AVATAR_BYTES) {
      return { error: "Profile picture must be 2MB or smaller.", status: 400 };
    }
  }

  return { values, profilePicture };
}

/** Uploads the avatar and returns its public URL, or null if no file was provided. */
async function uploadAvatar(
  adminClient: SupabaseClient,
  userId: string,
  file: File,
): Promise<{ url: string; path: string }> {
  const extension = file.type === "image/png" ? "png" : "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await adminClient.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    throw new Error(`Failed to upload profile picture: ${uploadError.message}`);
  }

  const { data: publicUrlData } = adminClient.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return { url: publicUrlData.publicUrl, path };
}

// --------------------------------------------------------------------------
// Welcome email
// --------------------------------------------------------------------------

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[character] || character;
  });
}

async function sendWelcomeEmail(values: StaffPayload, userId: string): Promise<{
  sent: boolean;
  id?: string;
  error?: string;
}> {
  if (!RESEND_API_KEY) {
    console.error("[create-staff] RESEND_API_KEY is not configured.");
    return { sent: false, error: "RESEND_API_KEY is not configured." };
  }

  const firstName = escapeHtml(values.firstName.trim());
  const lastName = escapeHtml(values.lastName.trim());
  const fullName = `${firstName} ${lastName}`.trim();
  const email = escapeHtml(values.email.trim());
  const password = escapeHtml(values.tempPassword);
  const staffId = escapeHtml(values.staffId.trim());
  const role = escapeHtml(values.role.trim());
  const department = escapeHtml(values.department.trim());
  const position = escapeHtml(values.position.trim());
  const safeAppUrl = escapeHtml(APP_URL);
  const safeLogoUrl = escapeHtml(LOGO_URL);

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Welcome to Visual Vertex Technology Company</title>
</head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:620px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border:1px solid #e4e4e7;border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.06);">
      <div style="padding:28px 28px 18px;text-align:center;border-bottom:1px solid #f0f0f0;">
        <img src="${safeLogoUrl}" alt="Visual Vertex Technology Company" style="width:92px;height:92px;object-fit:contain;border-radius:16px;display:block;margin:0 auto 14px;">
        <div style="font-size:21px;font-weight:700;">Visual Vertex Technology Company</div>
        <div style="font-size:13px;color:#71717a;margin-top:5px;">Visual Vertex Staff Attendance System</div>
      </div>

      <div style="padding:30px 28px;">
        <h1 style="font-size:25px;line-height:1.25;margin:0 0 12px;">Welcome, ${firstName} 👋</h1>
        <p style="font-size:15px;line-height:1.7;margin:0 0 18px;color:#3f3f46;">
          Your staff account has been created successfully. Welcome to Visual Vertex Technology Company. We are pleased to have you on the team.
        </p>

        <div style="background:#fafafa;border:1px solid #e4e4e7;border-radius:14px;padding:20px;margin:22px 0;">
          <div style="font-size:14px;font-weight:700;margin-bottom:14px;">Your login details</div>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr><td style="padding:7px 0;color:#71717a;width:38%;">Email</td><td style="padding:7px 0;font-weight:600;">${email}</td></tr>
            <tr><td style="padding:7px 0;color:#71717a;">Temporary password</td><td style="padding:7px 0;font-weight:700;word-break:break-word;">${password}</td></tr>
            <tr><td style="padding:7px 0;color:#71717a;">Staff ID</td><td style="padding:7px 0;font-weight:600;">${staffId}</td></tr>
            <tr><td style="padding:7px 0;color:#71717a;">Department</td><td style="padding:7px 0;">${department}</td></tr>
            <tr><td style="padding:7px 0;color:#71717a;">Position</td><td style="padding:7px 0;">${position}</td></tr>
            <tr><td style="padding:7px 0;color:#71717a;">Role</td><td style="padding:7px 0;">${role}</td></tr>
          </table>
        </div>

        <div style="text-align:center;margin:26px 0;">
          <a href="${safeAppUrl}/login.html" style="display:inline-block;background:#ef2f2f;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 24px;border-radius:10px;">Open VSAS Login</a>
        </div>

        <p style="font-size:13px;line-height:1.7;color:#52525b;margin:18px 0 0;">
          <strong>Important:</strong> This is a temporary password. Please log in and change your password immediately after your first successful login. Keep your login details private and do not share them with anyone.
        </p>

        <p style="font-size:13px;line-height:1.7;color:#71717a;margin:20px 0 0;">
          Website: <a href="${safeAppUrl}" style="color:#dc2626;">${safeAppUrl}</a>
        </p>
      </div>

      <div style="padding:18px 28px;background:#18181b;color:#d4d4d8;text-align:center;font-size:12px;line-height:1.6;">
        Visual Vertex Technology Company<br>
        This is an automated account-creation email. Please do not reply to this message.
      </div>
    </div>
  </div>
</body>
</html>`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
        // Prevent duplicate welcome emails if a request is retried.
        "Idempotency-Key": `vsas-welcome-${userId}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [values.email.trim()],
        subject: "Welcome to Visual Vertex Technology Company — Your VSAS Login Details",
        html,
      }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        typeof result?.message === "string"
          ? result.message
          : typeof result?.name === "string"
            ? result.name
            : `Resend returned HTTP ${response.status}.`;
      console.error("[create-staff] Resend email failed:", result);
      return { sent: false, error: message };
    }

    return { sent: true, id: result?.id };
  } catch (err) {
    console.error("[create-staff] Welcome email request failed:", err);
    return {
      sent: false,
      error: err instanceof Error ? err.message : "Unable to contact Resend.",
    };
  }
}

// --------------------------------------------------------------------------
// Handler
// --------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return handleOptions();
  }

  if (req.method !== "POST") {
    return errorResponse(405, "Method not allowed. Use POST.");
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
    return errorResponse(500, "Server is misconfigured. Missing environment variables.");
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. AuthN/AuthZ: caller must be a signed-in admin.
  const authResult = await requireAdmin(req, adminClient);
  if (!authResult.ok) {
    return errorResponse(authResult.status, authResult.message);
  }

  // 2. Parse + validate the form payload (content-type, size, allowed
  // fields, and field-level rules — see parseForm() and validatePayload()).
  const parsed = await parseForm(req);
  if ("error" in parsed) {
    return errorResponse(parsed.status ?? 400, parsed.error);
  }
  const { values, profilePicture } = parsed;

  const validationErrors = validatePayload(values);
  if (validationErrors.length > 0) {
    return errorResponse(400, validationErrors.join(" "));
  }

  // 3. Reject duplicate staff IDs up front for a friendlier error message
  //    (a DB unique constraint is the real source of truth — see migration).
  const { data: existingStaffId } = await adminClient
    .from("profiles")
    .select("id")
    .eq("staff_id", values.staffId.trim())
    .maybeSingle();

  if (existingStaffId) {
    return errorResponse(409, `Staff ID "${values.staffId.trim()}" is already in use.`);
  }

  // 4. Create the Auth user.
  let newUserId: string | null = null;
  try {
    const { data: createdUser, error: createUserError } = await adminClient.auth.admin.createUser({
      email: values.email.trim(),
      password: values.tempPassword,
      email_confirm: true,
      user_metadata: {
        first_name: values.firstName.trim(),
        last_name: values.lastName.trim(),
      },
    });

    if (createUserError || !createdUser?.user) {
      const status = createUserError?.status === 422 ? 409 : 500;
      const message =
        createUserError?.message?.toLowerCase().includes("already")
          ? `An account already exists for ${values.email.trim()}.`
          : createUserError?.message || "Failed to create the login account.";
      return errorResponse(status, message);
    }

    newUserId = createdUser.user.id;
  } catch (err) {
    console.error("[create-staff] Auth user creation failed:", err);
    return errorResponse(500, "Failed to create the login account. Please try again.");
  }

  // 5. Optionally upload the avatar. Any failure here rolls back the auth user.
  let avatarUrl: string | null = null;
  let avatarPath: string | null = null;
  if (profilePicture) {
    try {
      const uploaded = await uploadAvatar(adminClient, newUserId, profilePicture);
      avatarUrl = uploaded.url;
      avatarPath = uploaded.path;
    } catch (err) {
      console.error("[create-staff] Avatar upload failed:", err);
      await adminClient.auth.admin.deleteUser(newUserId).catch((cleanupErr) =>
        console.error("[create-staff] Rollback (delete user) failed:", cleanupErr),
      );
      return errorResponse(500, err instanceof Error ? err.message : "Failed to upload profile picture.");
    }
  }

  // 6. Insert the profile row, linked to the new Auth user's id.
  const { data: insertedProfile, error: insertError } = await adminClient
    .from("profiles")
    .insert({
      id: newUserId,
      staff_id: values.staffId.trim(),
      first_name: values.firstName.trim(),
      last_name: values.lastName.trim(),
      email: values.email.trim(),
      phone: values.phone.trim() || null,
      department: values.department.trim(),
      position: values.position.trim(),
      role: values.role.trim(),
      is_active: true,
      avatar_url: avatarUrl,
    })
    .select(
      "id, staff_id, first_name, last_name, email, phone, department, position, role, is_active, avatar_url, created_at",
    )
    .single();

  if (insertError || !insertedProfile) {
    console.error("[create-staff] Profile insert failed:", insertError);

    // Roll back the Auth user and any uploaded avatar so we don't leave
    // an orphaned login with no matching profile.
    await adminClient.auth.admin.deleteUser(newUserId).catch((cleanupErr) =>
      console.error("[create-staff] Rollback (delete user) failed:", cleanupErr),
    );
    if (avatarPath) {
      await adminClient.storage
        .from(AVATAR_BUCKET)
        .remove([avatarPath])
        .catch((cleanupErr) => console.error("[create-staff] Rollback (delete avatar) failed:", cleanupErr));
    }

    const status = insertError?.code === "23505" ? 409 : 500;
    const message =
      insertError?.code === "23505"
        ? "A staff member with this Staff ID or email already exists."
        : "Failed to save the staff profile. Please try again.";
    return errorResponse(status, message);
  }

  // 7. Send the welcome email only after the Auth user and profile both
  // exist. Email failure does NOT roll back the account: the staff member
  // has already been created successfully and an admin can resend later.
  const welcomeEmail = await sendWelcomeEmail(values, newUserId);

  if (!welcomeEmail.sent) {
    console.warn(
      "[create-staff] Staff created but welcome email was not sent:",
      welcomeEmail.error,
    );
  }

  // 8. Success.
  return jsonResponse(201, {
    profile: insertedProfile,
    welcome_email: {
      sent: welcomeEmail.sent,
      id: welcomeEmail.id ?? null,
      error: welcomeEmail.sent ? null : welcomeEmail.error ?? "Unknown email error.",
    },
  });
});