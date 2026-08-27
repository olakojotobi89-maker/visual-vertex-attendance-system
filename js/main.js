/* =========================================================
   VSAS — Phase 2
   main.js
   Shared "app chrome" behaviour used across every
   authenticated page (dashboard, attendance history,
   profile, settings, etc. once they're built).
   ========================================================= */

(function () {
  "use strict";

  /* ---------- Sidebar drawer (mobile) ---------- */

  function initSidebar() {
    var toggleBtn = document.getElementById("sidebarToggle");
    var sidebar = document.getElementById("sidebar");
    var shell = document.getElementById("dashboardShell");
    var overlay = document.getElementById("sidebarOverlay") || document.getElementById("sidebarBackdrop");

    if (!toggleBtn || !sidebar) return;
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "sidebarBackdrop";
      overlay.className = "sidebar-backdrop";
      document.body.appendChild(overlay);
    }

    function isMobile() { return window.innerWidth <= 720; }

    function openSidebar() {
      sidebar.classList.add("is-open");
      overlay.classList.add("is-visible");
      toggleBtn.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
    }

    function closeSidebar() {
      sidebar.classList.remove("is-open");
      overlay.classList.remove("is-visible");
      toggleBtn.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    }

    toggleBtn.addEventListener("click", function () {
      if (isMobile()) {
        if (sidebar.classList.contains("is-open")) closeSidebar();
        else openSidebar();
      } else {
        closeSidebar();
        if (shell) {
          shell.classList.toggle("is-collapsed");
          shell.classList.toggle("is-expanded");
        }
      }
    });

    overlay.addEventListener("click", closeSidebar);

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeSidebar();
    });

    // If the viewport grows into the desktop rail layout, make sure the
    // mobile-only open state doesn't linger and lock scrolling.
    window.addEventListener("resize", function () {
      if (!isMobile()) closeSidebar();
    });

    sidebar.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () { if (isMobile()) closeSidebar(); });
    });
  }

  /* ---------- Notification dropdown ---------- */

  function initNotifications() {
    var bell = document.getElementById("notificationBell");
    var panel = document.getElementById("notificationPanel");
    var dot = document.getElementById("notificationDot");

    if (!bell || !panel) return;

    function openPanel() {
      panel.classList.add("is-open");
      bell.setAttribute("aria-expanded", "true");
      // Opening the panel does not change recipient read state.
    }

    function closePanel() {
      panel.classList.remove("is-open");
      bell.setAttribute("aria-expanded", "false");
    }

    bell.addEventListener("click", function (event) {
      event.stopPropagation();
      var isOpen = panel.classList.contains("is-open");
      if (isOpen) {
        closePanel();
      } else {
        openPanel();
      }
    });

    document.addEventListener("click", function (event) {
      if (!panel.contains(event.target) && event.target !== bell) {
        closePanel();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closePanel();
    });
  }

  /* ---------- Init ---------- */

  document.addEventListener("DOMContentLoaded", function () {
    initSidebar();
    initNotifications();
  });
})();
