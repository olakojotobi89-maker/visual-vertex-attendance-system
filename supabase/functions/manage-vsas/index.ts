import { createClient } from '@supabase/supabase-js';
import { CORS_HEADERS, errorResponse, handleOptions, jsonResponse } from '../_shared/cors.ts';
import {
  readJsonObject,
  checkAllowlist,
  requireString,
  optionalString,
  requireUuid,
  optionalUuid,
  requireEnum,
  requireBoolean,
  requireUuidArray,
  type FieldError,
} from '../_shared/security/mod.ts';

const url = Deno.env.get('SUPABASE_URL') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const managers = new Set(['admin', 'hr', 'manager', 'ceo']);

// Same role vocabulary enforced by create-staff.
const VALID_ROLES = ['admin', 'hr', 'manager', 'ceo', 'staff'] as const;
const VALID_TARGET_TYPES = ['all', 'department', 'selected'] as const;

async function caller(req: Request) {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token || !url || !anonKey || !serviceKey) return null;
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data } = await client.auth.getUser(token);
  if (!data.user) return null;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile } = await admin.from('profiles').select('id, role').eq('id', data.user.id).maybeSingle();
  return profile && managers.has(String(profile.role).toLowerCase()) ? { user: data.user, admin } : null;
}

async function log(admin: ReturnType<typeof createClient>, actor: string, action: string, entity: string, id?: string, metadata: Record<string, unknown> = {}) {
  await admin.from('activity_logs').insert({ actor_id: actor, action, entity_type: entity, entity_id: id ?? null, metadata });
}

/** Turns the first validation FieldError into a safe 400 errorResponse. */
function fieldErrorResponse(error: FieldError): Response {
  return errorResponse(400, error.message);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOptions();
  if (req.method !== 'POST') return errorResponse(405, 'Method not allowed.');

  const auth = await caller(req);
  if (!auth) return errorResponse(403, 'You are not authorized to perform this operation.');

  // Strict JSON body reading: enforces a max size, rejects malformed/empty
  // bodies, requires a top-level object, and rejects dangerous keys.
  const parsedBody = await readJsonObject(req);
  if (!parsedBody.ok) return errorResponse(parsedBody.status, parsedBody.message);
  const body = parsedBody.value;

  const action = String(body.action ?? '');
  const { admin, user } = auth;

  if (action === 'update_staff') {
    const ALLOWED_FIELDS = [
      'action', 'id', 'first_name', 'last_name', 'phone',
      'position', 'department_id', 'department', 'role', 'is_active',
    ] as const;
    const allowlist = checkAllowlist(body, ALLOWED_FIELDS);
    if (!allowlist.ok) {
      return errorResponse(400, `Unexpected field(s): ${allowlist.unexpected.join(', ')}.`);
    }

    const idResult = requireUuid(body.id, 'id');
    if (!idResult.ok) return fieldErrorResponse(idResult.error);

    const patch: Record<string, unknown> = {};

    if (body.first_name !== undefined) {
      const r = optionalString(body.first_name, 'first_name', { maxLength: 100 });
      if (!r.ok) return fieldErrorResponse(r.error);
      if (r.value !== undefined) patch.first_name = r.value;
    }
    if (body.last_name !== undefined) {
      const r = optionalString(body.last_name, 'last_name', { maxLength: 100 });
      if (!r.ok) return fieldErrorResponse(r.error);
      if (r.value !== undefined) patch.last_name = r.value;
    }
    if (body.phone !== undefined) {
      if (body.phone === null) {
        patch.phone = null;
      } else {
        const r = optionalString(body.phone, 'phone', { maxLength: 32 });
        if (!r.ok) return fieldErrorResponse(r.error);
        patch.phone = r.value ?? null;
      }
    }
    if (body.position !== undefined) {
      const r = optionalString(body.position, 'position', { maxLength: 100 });
      if (!r.ok) return fieldErrorResponse(r.error);
      if (r.value !== undefined) patch.position = r.value;
    }
    if (body.department_id !== undefined) {
      if (body.department_id === null) {
        patch.department_id = null;
      } else {
        const r = requireUuid(body.department_id, 'department_id');
        if (!r.ok) return fieldErrorResponse(r.error);
        patch.department_id = r.value;
      }
    }
    if (body.department !== undefined) {
      if (body.department === null) {
        patch.department = null;
      } else {
        const r = optionalString(body.department, 'department', { maxLength: 100 });
        if (!r.ok) return fieldErrorResponse(r.error);
        if (r.value !== undefined) patch.department = r.value;
      }
    }
    if (body.role !== undefined) {
      const r = requireEnum(body.role, 'role', VALID_ROLES);
      if (!r.ok) return fieldErrorResponse(r.error);
      patch.role = r.value;
    }
    if (body.is_active !== undefined) {
      const r = requireBoolean(body.is_active, 'is_active');
      if (!r.ok) return fieldErrorResponse(r.error);
      patch.is_active = r.value;
    }

    if (!Object.keys(patch).length) return errorResponse(400, 'No allowed fields supplied.');

    const { data, error } = await admin.from('profiles').update(patch).eq('id', idResult.value).select('id').single();
    if (error) return errorResponse(400, error.message);
    await log(admin, user.id, 'staff.updated', 'profile', data.id, { fields: Object.keys(patch) });
    return jsonResponse(200, { profile: data });
  }

  if (action === 'delete_staff') {
    const ALLOWED_FIELDS = ['action', 'id'] as const;
    const allowlist = checkAllowlist(body, ALLOWED_FIELDS);
    if (!allowlist.ok) {
      return errorResponse(400, `Unexpected field(s): ${allowlist.unexpected.join(', ')}.`);
    }

    const idResult = requireUuid(body.id, 'id');
    if (!idResult.ok) return fieldErrorResponse(idResult.error);
    const id = idResult.value;

    if (id === user.id) return errorResponse(400, 'You cannot delete your own account.');
    const { data: target } = await admin.from('profiles').select('id, role, avatar_url').eq('id', id).maybeSingle();
    if (!target) return errorResponse(404, 'Staff member not found.');
    if (String(target.role).toLowerCase() === 'admin' && String(auth.user.id) !== id) return errorResponse(403, 'Admin accounts require a separate owner-approved workflow.');
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return errorResponse(400, error.message);
    await log(admin, user.id, 'staff.deleted', 'profile', id, { prior_role: target.role });
    return jsonResponse(200, { deleted: id });
  }

  if (action === 'department_save') {
    const ALLOWED_FIELDS = ['action', 'id', 'name', 'description'] as const;
    const allowlist = checkAllowlist(body, ALLOWED_FIELDS);
    if (!allowlist.ok) {
      return errorResponse(400, `Unexpected field(s): ${allowlist.unexpected.join(', ')}.`);
    }

    const idResult = optionalUuid(body.id, 'id');
    if (!idResult.ok) return fieldErrorResponse(idResult.error);

    const nameResult = requireString(body.name, 'name', { maxLength: 150 });
    if (!nameResult.ok) return fieldErrorResponse(nameResult.error);

    const descriptionResult = optionalString(body.description, 'description', { maxLength: 1000 });
    if (!descriptionResult.ok) return fieldErrorResponse(descriptionResult.error);

    const values = { name: nameResult.value, description: descriptionResult.value ?? null };
    const query = idResult.value
      ? admin.from('departments').update(values).eq('id', idResult.value)
      : admin.from('departments').insert(values);
    const { data, error } = await query.select('id, name, description').single();
    if (error) return errorResponse(400, error.message);
    await log(admin, user.id, idResult.value ? 'department.updated' : 'department.created', 'department', data.id);
    return jsonResponse(200, { department: data });
  }

  if (action === 'notification_publish') {
    const ALLOWED_FIELDS = ['action', 'title', 'body', 'category', 'target_type', 'department_id', 'user_ids'] as const;
    const allowlist = checkAllowlist(body, ALLOWED_FIELDS);
    if (!allowlist.ok) {
      return errorResponse(400, `Unexpected field(s): ${allowlist.unexpected.join(', ')}.`);
    }

    const titleResult = requireString(body.title, 'title', { maxLength: 200 });
    if (!titleResult.ok) return fieldErrorResponse(titleResult.error);

    const textResult = requireString(body.body, 'body', { maxLength: 5000 });
    if (!textResult.ok) return fieldErrorResponse(textResult.error);

    const categoryResult = optionalString(body.category, 'category', { maxLength: 100 });
    if (!categoryResult.ok) return fieldErrorResponse(categoryResult.error);

    const targetTypeResult = requireEnum(body.target_type ?? 'all', 'target_type', VALID_TARGET_TYPES);
    if (!targetTypeResult.ok) return fieldErrorResponse(targetTypeResult.error);
    const targetType = targetTypeResult.value;

    let departmentId: string | undefined;
    if (targetType === 'department') {
      const departmentIdResult = requireUuid(body.department_id, 'department_id');
      if (!departmentIdResult.ok) return fieldErrorResponse(departmentIdResult.error);
      departmentId = departmentIdResult.value;
    } else if (body.department_id !== undefined && body.department_id !== null) {
      const departmentIdResult = optionalUuid(body.department_id, 'department_id');
      if (!departmentIdResult.ok) return fieldErrorResponse(departmentIdResult.error);
      departmentId = departmentIdResult.value;
    }

    let userIds: string[] = [];
    if (body.user_ids !== undefined) {
      const userIdsResult = requireUuidArray(body.user_ids, 'user_ids', { maxItems: 5000 });
      if (!userIdsResult.ok) return fieldErrorResponse(userIdsResult.error);
      userIds = userIdsResult.value;
    }

    const { data: notification, error } = await admin.from('notifications').insert({
      title: titleResult.value,
      body: textResult.value,
      category: categoryResult.value ?? null,
      target_type: targetType,
      department_id: departmentId ?? null,
      status: 'published',
      published_at: new Date().toISOString(),
      created_by: user.id,
    }).select('id').single();
    if (error) return errorResponse(400, error.message);

    let recipients: string[] = userIds;
    if (targetType === 'all' || targetType === 'department') {
      let query = admin.from('profiles').select('id').eq('is_active', true);
      if (targetType === 'department') query = query.eq('department_id', departmentId ?? '');
      const { data } = await query;
      recipients = (data ?? []).map((p) => p.id);
    }
    if (recipients.length) await admin.from('notification_recipients').insert(recipients.map((id) => ({ notification_id: notification.id, user_id: id })));
    await log(admin, user.id, 'notification.published', 'notification', notification.id, { target_type: targetType, recipients: recipients.length });
    return jsonResponse(201, { notification_id: notification.id, recipients: recipients.length });
  }

  if (action === 'announcement_save') {
    const ALLOWED_FIELDS = ['action', 'id', 'title', 'content', 'category', 'is_published'] as const;
    const allowlist = checkAllowlist(body, ALLOWED_FIELDS);
    if (!allowlist.ok) {
      return errorResponse(400, `Unexpected field(s): ${allowlist.unexpected.join(', ')}.`);
    }

    const idResult = optionalUuid(body.id, 'id');
    if (!idResult.ok) return fieldErrorResponse(idResult.error);

    const titleResult = requireString(body.title, 'title', { maxLength: 200 });
    if (!titleResult.ok) return fieldErrorResponse(titleResult.error);

    const contentResult = requireString(body.content, 'content', { maxLength: 20000 });
    if (!contentResult.ok) return fieldErrorResponse(contentResult.error);

    const categoryResult = optionalString(body.category, 'category', { maxLength: 100 });
    if (!categoryResult.ok) return fieldErrorResponse(categoryResult.error);

    let isPublished = false;
    if (body.is_published !== undefined) {
      const r = requireBoolean(body.is_published, 'is_published');
      if (!r.ok) return fieldErrorResponse(r.error);
      isPublished = r.value;
    }

    const values = {
      title: titleResult.value,
      content: contentResult.value,
      category: categoryResult.value ?? null,
      is_published: isPublished,
      published_at: isPublished ? new Date().toISOString() : null,
      created_by: user.id,
    };
    const query = idResult.value
      ? admin.from('announcements').update(values).eq('id', idResult.value)
      : admin.from('announcements').insert(values);
    const { data, error } = await query.select('id').single();
    if (error) return errorResponse(400, error.message);
    await log(admin, user.id, idResult.value ? 'announcement.updated' : 'announcement.created', 'announcement', data.id);
    return jsonResponse(200, { announcement_id: data.id });
  }
  return errorResponse(400, 'Unknown action.');
});