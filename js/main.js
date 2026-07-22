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
    var overlay = document.getElementById("sidebarOverlay");

    if (!toggleBtn || !sidebar || !overlay) return;

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
      var isOpen = sidebar.classList.contains("is-open");
      if (isOpen) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });

    overlay.addEventListener("click", closeSidebar);

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeSidebar();
    });

    // If the viewport grows into the desktop rail layout, make sure the
    // mobile-only open state doesn't linger and lock scrolling.
    window.addEventListener("resize", function () {
      if (window.innerWidth >= 900) closeSidebar();
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
      if (dot) dot.style.display = "none"; // mark as "read" once opened
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