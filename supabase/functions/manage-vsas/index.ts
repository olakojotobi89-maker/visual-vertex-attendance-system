import { createClient } from '@supabase/supabase-js';
import { CORS_HEADERS, errorResponse, handleOptions, jsonResponse } from '../_shared/cors.ts';

const url = Deno.env.get('SUPABASE_URL') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const managers = new Set(['admin', 'hr', 'manager', 'ceo']);

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOptions();
  if (req.method !== 'POST') return errorResponse(405, 'Method not allowed.');
  const auth = await caller(req);
  if (!auth) return errorResponse(403, 'You are not authorized to perform this operation.');
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return errorResponse(400, 'Invalid JSON body.'); }
  const action = String(body.action ?? '');
  const { admin, user } = auth;

  if (action === 'update_staff') {
    const id = String(body.id ?? '');
    if (!id) return errorResponse(400, 'Staff id is required.');
    const allowed = ['first_name','last_name','phone','position','department_id','department','role','is_active'];
    const patch = Object.fromEntries(Object.entries(body).filter(([key, value]) => allowed.includes(key) && value !== undefined));
    if (!Object.keys(patch).length) return errorResponse(400, 'No allowed fields supplied.');
    const { data, error } = await admin.from('profiles').update(patch).eq('id', id).select('id').single();
    if (error) return errorResponse(400, error.message);
    await log(admin, user.id, 'staff.updated', 'profile', data.id, { fields: Object.keys(patch) });
    return jsonResponse(200, { profile: data });
  }

  if (action === 'delete_staff') {
    const id = String(body.id ?? '');
    if (!id || id === user.id) return errorResponse(400, 'You cannot delete your own account.');
    const { data: target } = await admin.from('profiles').select('id, role, avatar_url').eq('id', id).maybeSingle();
    if (!target) return errorResponse(404, 'Staff member not found.');
    if (String(target.role).toLowerCase() === 'admin' && String(auth.user.id) !== id) return errorResponse(403, 'Admin accounts require a separate owner-approved workflow.');
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return errorResponse(400, error.message);
    await log(admin, user.id, 'staff.deleted', 'profile', id, { prior_role: target.role });
    return jsonResponse(200, { deleted: id });
  }

  if (action === 'department_save') {
    const id = body.id ? String(body.id) : null;
    const name = String(body.name ?? '').trim();
    if (!name) return errorResponse(400, 'Department name is required.');
    const values = { name, description: String(body.description ?? '').trim() || null };
    const query = id ? admin.from('departments').update(values).eq('id', id) : admin.from('departments').insert(values);
    const { data, error } = await query.select('id, name, description').single();
    if (error) return errorResponse(400, error.message);
    await log(admin, user.id, id ? 'department.updated' : 'department.created', 'department', data.id);
    return jsonResponse(200, { department: data });
  }

  if (action === 'notification_publish') {
    const title = String(body.title ?? '').trim(), text = String(body.body ?? '').trim();
    const targetType = String(body.target_type ?? 'all');
    if (!title || !text || !['all','department','selected'].includes(targetType)) return errorResponse(400, 'Notification details are invalid.');
    const { data: notification, error } = await admin.from('notifications').insert({ title, body: text, target_type: targetType, department_id: body.department_id || null, status: 'published', published_at: new Date().toISOString(), created_by: user.id }).select('id').single();
    if (error) return errorResponse(400, error.message);
    let recipients: string[] = Array.isArray(body.user_ids) ? body.user_ids.map(String) : [];
    if (targetType === 'all' || targetType === 'department') {
      let query = admin.from('profiles').select('id').eq('is_active', true);
      if (targetType === 'department') query = query.eq('department_id', String(body.department_id ?? ''));
      const { data } = await query;
      recipients = (data ?? []).map((p) => p.id);
    }
    if (recipients.length) await admin.from('notification_recipients').insert(recipients.map((id) => ({ notification_id: notification.id, user_id: id })));
    await log(admin, user.id, 'notification.published', 'notification', notification.id, { target_type: targetType, recipients: recipients.length });
    return jsonResponse(201, { notification_id: notification.id, recipients: recipients.length });
  }

  if (action === 'announcement_save') {
    const id = body.id ? String(body.id) : null, title = String(body.title ?? '').trim(), content = String(body.content ?? '').trim();
    if (!title || !content) return errorResponse(400, 'Title and content are required.');
    const values = { title, content, category: String(body.category ?? '').trim() || null, is_published: Boolean(body.is_published), published_at: body.is_published ? new Date().toISOString() : null, created_by: user.id };
    const query = id ? admin.from('announcements').update(values).eq('id', id) : admin.from('announcements').insert(values);
    const { data, error } = await query.select('id').single();
    if (error) return errorResponse(400, error.message);
    await log(admin, user.id, id ? 'announcement.updated' : 'announcement.created', 'announcement', data.id);
    return jsonResponse(200, { announcement_id: data.id });
  }
  return errorResponse(400, 'Unknown action.');
});
