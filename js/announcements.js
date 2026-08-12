/* =========================================================
   VSAS — announcements.js
   Logic for the company announcements page.

   Fetches and displays published announcements from the 'announcements'
   table. RLS policies ensure that staff can only read published items.

   Depends on (must be loaded first, in this order):
     1. Supabase CDN            -> window.supabase
     2. js/supabase.js          -> window.supabaseClient
     3. js/auth.js              -> window.VSASAuth (requireAuth, etc.)
     4. js/main.js              -> Shared UI (sidebar, notifications)
   ========================================================= */

(function () {
  "use strict";

  const els = {};
  let currentUser = null;
  let currentProfile = null;

  function getInitials(name) {
    return (name || "").split(" ").filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");
  }

  function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function formatRelativeTime(date) {
    const now = new Date();
    const seconds = Math.round((now - date) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);

    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function renderProfile() {
    if (!currentProfile) return;
    const fullName = `${currentProfile.first_name || ""} ${currentProfile.last_name || ""}`.trim() || "Staff Member";
    const initials = getInitials(fullName);
    if (els.topAvatarCircle) els.topAvatarCircle.textContent = initials;
    if (els.topAvatarName) els.topAvatarName.textContent = fullName;
  }

  async function loadAnnouncements() {
    if (!els.announcementsList) return;

    try {
      const { data, error } = await window.supabaseClient
        .from("announcements")
        .select("title, content, category, published_at")
        .eq("is_published", true)
        .order("published_at", { ascending: false });

      if (error) throw error;

      if (data.length === 0) {
        els.announcementsList.innerHTML = `<div class="announcement-card"><p style="text-align: center; color: var(--muted);">No announcements at this time.</p></div>`;
        return;
      }

      els.announcementsList.innerHTML = data.map(announcement => `
        <article class="announcement-card">
          <header class="announcement-header">
            <h2 class="announcement-title">${escapeHtml(announcement.title)}</h2>
            <p class="announcement-meta">${formatRelativeTime(new Date(announcement.published_at))}</p>
          </header>
          <div class="announcement-content">
            <p>${escapeHtml(announcement.content)}</p>
          </div>
        </article>
      `).join("");

    } catch (err) {
      console.error("[VSAS] Failed to load announcements:", err);
      els.announcementsList.innerHTML = `<div class="announcement-card"><p style="text-align: center; color: var(--muted);">Could not load announcements. Please try again later.</p></div>`;
    }
  }

  function cacheEls() {
    els.announcementsList = document.getElementById("announcementsList");
    els.topAvatarCircle = document.getElementById("topAvatarCircle");
    els.topAvatarName = document.getElementById("topAvatarName");
    els.logoutLink = document.getElementById("logoutLink");
  }

  document.addEventListener("DOMContentLoaded", async () => {
    cacheEls();
    const auth = await window.VSASAuth.requireAuth();
    if (!auth) return;
    currentUser = auth.user;
    currentProfile = auth.profile;
    renderProfile();
    if (els.logoutLink) {
      els.logoutLink.addEventListener("click", (e) => { e.preventDefault(); window.VSASAuth.logout(); });
    }
    loadAnnouncements();
  });
})();