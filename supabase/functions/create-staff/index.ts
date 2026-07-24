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
const VALID_ROLES = new Set(["admin", "hr", "manager", "staff"]);

// --------------------------------------------------------------------------
// Small helpers
// --------------------------------------------------------------------------

function isEmail(value: string): boolean {
  return /\S+@\S+\.\S+/.test(value);
}

function isPhone(value: string): boolean {
  return /^[+\d][\d\s-]{6,}$/.test(value);
}

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

  if (!values.firstName?.trim()) errors.push("First name is required.");
  if (!values.lastName?.trim()) errors.push("Last name is required.");
  if (!values.email?.trim() || !isEmail(values.email.trim())) errors.push("A valid email is required.");
  if (values.phone?.trim() && !isPhone(values.phone.trim())) errors.push("Phone number is invalid.");
  if (!values.department?.trim()) errors.push("Department is required.");
  if (!values.position?.trim()) errors.push("Position is required.");
  if (!values.role?.trim() || !VALID_ROLES.has(values.role.trim())) errors.push("A valid role is required.");
  if (!values.staffId?.trim()) errors.push("Staff ID is required.");
  if (!values.tempPassword || values.tempPassword.length < 8) {
    errors.push("Temporary password must be at least 8 characters.");
  }

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
): Promise<{ values: StaffPayload; profilePicture: File | null } | { error: string }> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return { error: "Expected multipart/form-data body." };
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
      return { error: "Profile picture must be a JPG or PNG image." };
    }
    if (profilePicture.size > MAX_AVATAR_BYTES) {
      return { error: "Profile picture must be 2MB or smaller." };
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

  // 2. Parse + validate the form payload.
  const parsed = await parseForm(req);
  if ("error" in parsed) {
    return errorResponse(400, parsed.error);
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

  // 7. Success.
  return jsonResponse(201, { profile: insertedProfile });
});
</output></invoke>
</invoke>
</invoke>
</invoke>
