/* =========================================================
   VSAS — Landing Page
   js/index.js
   Sends every "Get Started" button to the login page.

   The href on these buttons already points to pages/login.html,
   so navigation works even if JavaScript fails to load — this
   script only adds a brief fade-out transition on the way out.
   ========================================================= */

(function () {
  "use strict";

  function initGetStartedButtons() {
    var buttons = document.querySelectorAll(".js-get-started");
    if (!buttons.length) return;

    var prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    buttons.forEach(function (button) {
      button.addEventListener("click", function (event) {
        var destination = button.getAttribute("href");
        if (!destination) return;

        // Skip the transition entirely if the user prefers reduced motion.
        if (prefersReducedMotion) return;

        event.preventDefault();
        document.body.classList.add("is-leaving");

        window.setTimeout(function () {
          window.location.href = destination;
        }, 200);
      });
    });
  }

  document.addEventListener("DOMContentLoaded", initGetStartedButtons);
})();