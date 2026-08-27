(function () {
  "use strict";
  let channel = null;
  let userId = null;
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
  const age = (v) => { const s = Math.max(0, (Date.now() - new Date(v).getTime()) / 1000); return s < 60 ? `${Math.floor(s)}s ago` : s < 3600 ? `${Math.floor(s / 60)}m ago` : s < 86400 ? `${Math.floor(s / 3600)}h ago` : `${Math.floor(s / 86400)}d ago`; };
  function sound() { try { const C = window.AudioContext || window.webkitAudioContext; if (!C) return; const x = new C(), t = x.currentTime; [660, 880].forEach((f, i) => { const o = x.createOscillator(), g = x.createGain(), n = t + i * .1; o.type = "sine"; o.frequency.value = f; g.gain.setValueAtTime(.0001, n); g.gain.exponentialRampToValueAtTime(.07, n + .02); g.gain.exponentialRampToValueAtTime(.0001, n + .2); o.connect(g).connect(x.destination); o.start(n); o.stop(n + .22); }); setTimeout(() => x.close(), 600); } catch (_) {} }
  async function load(playSound) {
    const list = document.getElementById("notificationList") || document.getElementById("notificationsList"); if (!list || !userId) return;
    const { data, error } = await window.supabaseClient.from("notification_recipients").select("notification_id,read_at,dismissed_at,notifications(title,body,category,published_at)").is("dismissed_at", null).order("created_at", { ascending: false }).limit(50);
    if (error) { list.innerHTML = '<p class="notification-item">Could not load notifications.</p>'; return; }
    const rows = data || [], unread = rows.filter((r) => !r.read_at).length, dot = document.getElementById("notificationDot"); if (dot) dot.style.display = unread ? "block" : "none";
    if (!rows.length) { list.innerHTML = '<p class="notification-item">No new notifications.</p>'; return; }
    list.innerHTML = rows.map((r) => { const n = r.notifications || {}; return `<button type="button" class="notification-item${r.read_at ? "" : " notification-item--unread"}" data-id="${esc(r.notification_id)}" role="menuitem"><span class="notification-item-dot"></span><span><strong>${esc(n.title || "Notification")}</strong><br>${esc(n.body || "")}<br><time>${esc(n.category || "General")} · ${esc(age(n.published_at))}</time></span></button>`; }).join("");
    list.querySelectorAll("[data-id]").forEach((item) => item.addEventListener("click", async () => { await window.supabaseClient.from("notification_recipients").update({ read_at: new Date().toISOString() }).eq("notification_id", item.dataset.id).eq("user_id", userId); load(false); }));
    if (playSound) sound();
  }
  document.addEventListener("DOMContentLoaded", async () => { const auth = await window.VSASAuth.requireAuth(); if (!auth) return; userId = auth.user.id; await load(false); channel = window.supabaseClient.channel(`vsas-notifications:${userId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "notification_recipients", filter: `user_id=eq.${userId}` }, () => load(true)).subscribe(); });
  window.addEventListener("beforeunload", () => { if (channel) window.supabaseClient.removeChannel(channel); });
})();
