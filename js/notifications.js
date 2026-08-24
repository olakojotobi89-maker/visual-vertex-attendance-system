(function () {
  'use strict';
  let channel;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[c]));
  async function load() {
    const list = document.getElementById('notificationList') || document.getElementById('notificationsList');
    const count = document.getElementById('notificationCount');
    if (!list) return;
    const { data, error } = await window.supabaseClient.from('notification_recipients')
      .select('notification_id, read_at, dismissed_at, notifications(title, body, published_at)')
      .is('dismissed_at', null).order('created_at', { ascending: false }).limit(50);
    if (error) { list.textContent = 'Could not load notifications.'; return; }
    const unread = data.filter((r) => !r.read_at).length;
    if (count) count.textContent = unread ? String(unread) : '';
    list.innerHTML = data.length ? data.map((r) => `<article class="notification-item" data-id="${esc(r.notification_id)}"><span class="notification-item-dot"></span><div><p>${esc(r.notifications?.title)}</p><p>${esc(r.notifications?.body)}</p><time>${esc(r.notifications?.published_at || '')}</time><button type="button" data-dismiss="${esc(r.notification_id)}">Dismiss</button></div></article>`).join('') : '<p class="notification-item">No notifications.</p>';
    list.querySelectorAll('[data-dismiss]').forEach((button) => button.addEventListener('click', async () => {
      const id = button.dataset.dismiss;
      await window.supabaseClient.from('notification_recipients').update({ dismissed_at: new Date().toISOString(), read_at: new Date().toISOString() }).eq('notification_id', id);
      load();
    }));
    const ids = data.filter((r) => !r.read_at).map((r) => r.notification_id);
    if (ids.length) await window.supabaseClient.from('notification_recipients').update({ read_at: new Date().toISOString() }).in('notification_id', ids);
  }
  document.addEventListener('DOMContentLoaded', async () => {
    const auth = await window.VSASAuth.requireAuth(); if (!auth) return;
    await load();
    channel = window.supabaseClient.channel(`notifications:${auth.user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'notification_recipients', filter: `user_id=eq.${auth.user.id}` }, load).subscribe();
  });
  window.addEventListener('beforeunload', () => { if (channel) window.supabaseClient.removeChannel(channel); });
})();
