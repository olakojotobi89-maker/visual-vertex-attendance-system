/**
 * js/pwa.js
 * -----------------------------------------------------------------------
 * VSAS — PWA installability layer.
 *
 * Added as a standalone, additive file — it does not touch Supabase,
 * auth.js, notifications.js, or any other existing VSAS module.
 *
 *   - Registers service-worker.js (registration is idempotent, so
 *     including this on every page is safe and never creates
 *     duplicate registrations).
 *   - Captures the browser's `beforeinstallprompt` event and shows a
 *     small, VSAS-branded install card instead of relying on default
 *     browser UI.
 *   - Skips the card entirely when the app is already running
 *     standalone (installed), was already installed, or was dismissed
 *     recently (tracked in localStorage).
 * -----------------------------------------------------------------------
 */

(function () {
  "use strict";

  var DISMISS_KEY = "vsas_pwa_install_dismissed_at";
  var INSTALLED_KEY = "vsas_pwa_installed";
  var DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  var deferredPrompt = null;
  var toastEl = null;

  /* ---------- Helpers ---------- */

  function isStandalone() {
    return (
      (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
      window.navigator.standalone === true // iOS Safari
    );
  }

  function isDismissedRecently() {
    try {
      var stored = window.localStorage.getItem(DISMISS_KEY);
      if (!stored) return false;
      var elapsed = Date.now() - parseInt(stored, 10);
      return elapsed >= 0 && elapsed < DISMISS_COOLDOWN_MS;
    } catch (e) {
      return false;
    }
  }

  function isAlreadyInstalled() {
    try {
      return window.localStorage.getItem(INSTALLED_KEY) === "true";
    } catch (e) {
      return false;
    }
  }

  function rememberDismissed() {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch (e) {
      /* localStorage unavailable (private mode, etc.) — safe to ignore. */
    }
  }

  function rememberInstalled() {
    try {
      window.localStorage.setItem(INSTALLED_KEY, "true");
    } catch (e) {
      /* ignore */
    }
  }

  /* ---------- Service worker registration ---------- */

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;

    window.addEventListener("load", function () {
      navigator.serviceWorker.register("service-worker.js").catch(function () {
        /* Fail silently/gracefully — VSAS must keep working even if the
           service worker can't register (unsupported browser, blocked
           storage, non-secure origin, etc.). */
      });
    });
  }

  /* ---------- Install card UI ---------- */

  function buildToast() {
    var toast = document.createElement("div");
    toast.className = "vsas-install-toast";
    toast.setAttribute("role", "dialog");
    toast.setAttribute("aria-label", "Install VSAS");
    toast.hidden = true;

    toast.innerHTML =
      '<div class="vsas-install-toast__icon">' +
        '<img src="images/icons/icon-192.png" alt="" />' +
      "</div>" +
      '<div class="vsas-install-toast__body">' +
        '<p class="vsas-install-toast__title">Install VSAS</p>' +
        '<p class="vsas-install-toast__text">Install Visual Vertex Staff Attendance System on your device for faster access and an app-like experience.</p>' +
        '<div class="vsas-install-toast__actions">' +
          '<button type="button" class="btn btn-primary btn-sm" data-vsas-install-accept>Install VSAS</button>' +
          '<button type="button" class="btn btn-secondary btn-sm" data-vsas-install-dismiss>Not now</button>' +
        "</div>" +
      "</div>" +
      '<button type="button" class="vsas-install-toast__close" data-vsas-install-dismiss aria-label="Dismiss">&times;</button>';

    document.body.appendChild(toast);

    toast.querySelector("[data-vsas-install-accept]").addEventListener("click", onAcceptClick);
    var dismissButtons = toast.querySelectorAll("[data-vsas-install-dismiss]");
    for (var i = 0; i < dismissButtons.length; i++) {
      dismissButtons[i].addEventListener("click", onDismissClick);
    }

    return toast;
  }

  function showToast() {
    if (isStandalone() || isAlreadyInstalled() || isDismissedRecently()) return;
    if (!deferredPrompt) return;
    if (!document.body) return;

    if (!toastEl) toastEl = buildToast();
    toastEl.hidden = false;
  }

  function hideToast() {
    if (toastEl) toastEl.hidden = true;
  }

  function onAcceptClick() {
    if (!deferredPrompt) {
      hideToast();
      return;
    }

    var promptEvent = deferredPrompt;
    deferredPrompt = null;
    promptEvent.prompt();

    promptEvent.userChoice
      .then(function (choice) {
        if (choice && choice.outcome === "accepted") {
          rememberInstalled();
        } else {
          rememberDismissed();
        }
      })
      .catch(function () {
        /* ignore */
      })
      .then(function () {
        hideToast();
      });
  }

  function onDismissClick() {
    rememberDismissed();
    hideToast();
  }

  /* ---------- Event wiring ---------- */

  // Attach at the top level (not inside DOMContentLoaded) so the event is
  // reliably captured whenever the browser decides to fire it.
  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    deferredPrompt = event;

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", showToast);
    } else {
      showToast();
    }
  });

  window.addEventListener("appinstalled", function () {
    rememberInstalled();
    deferredPrompt = null;
    hideToast();
  });

  registerServiceWorker();

  // Minimal hook in case a future "Install App" header action wants to
  // trigger the same native prompt without duplicating this logic.
  window.VSASPwa = {
    promptInstall: onAcceptClick,
    isStandalone: isStandalone,
  };
})();
