/* =========================================================
   VSAS — Phase 2
   auth.js
   Demo-only auth behaviour: no backend calls yet.
   Wire this up to POST /api/auth/login and
   POST /api/auth/forgot-password once the Express API exists.
   ========================================================= */

(function () {
  "use strict";

  /* ---------- Helpers ---------- */

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function isValidIdentifier(value) {
    // Accepts either an email OR a Staff ID like VV-2049
    return isValidEmail(value) || /^[A-Za-z]{2,5}-?\d{3,6}$/.test(value.trim());
  }

  function showFieldError(input, errorEl) {
    input.setAttribute("data-state", "error");
    errorEl.classList.add("is-visible");
  }

  function clearFieldError(input, errorEl) {
    input.removeAttribute("data-state");
    errorEl.classList.remove("is-visible");
  }

  function showAlert(alertEl, textEl, message) {
    if (textEl && message) textEl.textContent = message;
    alertEl.classList.add("is-visible");
  }

  function hideAlert(alertEl) {
    alertEl.classList.remove("is-visible");
  }

  function setLoading(button, isLoading) {
    button.dataset.loading = isLoading ? "true" : "false";
    button.disabled = isLoading;
  }

  /* ---------- Password visibility toggle (shared) ---------- */

  function initPasswordToggle(toggleId, inputId) {
    var toggle = document.getElementById(toggleId);
    var input = document.getElementById(inputId);
    if (!toggle || !input) return;

    toggle.addEventListener("click", function () {
      var isHidden = input.getAttribute("type") === "password";
      input.setAttribute("type", isHidden ? "text" : "password");
      toggle.setAttribute("aria-pressed", isHidden ? "true" : "false");
      toggle.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
    });
  }

  /* ---------- Login page ---------- */

  function initLoginForm() {
    var form = document.getElementById("loginForm");
    if (!form) return;

    var identifierInput = document.getElementById("loginIdentifier");
    var identifierError = document.getElementById("identifierError");
    var passwordInput = document.getElementById("loginPassword");
    var passwordError = document.getElementById("passwordError");
    var submitBtn = document.getElementById("loginSubmit");
    var alertEl = document.getElementById("loginAlert");
    var alertText = document.getElementById("loginAlertText");

    identifierInput.addEventListener("input", function () {
      clearFieldError(identifierInput, identifierError);
      hideAlert(alertEl);
    });

    passwordInput.addEventListener("input", function () {
      clearFieldError(passwordInput, passwordError);
      hideAlert(alertEl);
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      hideAlert(alertEl);

      var identifierValue = identifierInput.value.trim();
      var passwordValue = passwordInput.value;
      var isValid = true;

      if (!isValidIdentifier(identifierValue)) {
        showFieldError(identifierInput, identifierError);
        isValid = false;
      } else {
        clearFieldError(identifierInput, identifierError);
      }

      if (passwordValue.length < 6) {
        showFieldError(passwordInput, passwordError);
        isValid = false;
      } else {
        clearFieldError(passwordInput, passwordError);
      }

      if (!isValid) return;

      // Demo-only "authentication" — replace with a real API call.
      setLoading(submitBtn, true);

      window.setTimeout(function () {
        setLoading(submitBtn, false);

        // Demo rule: any identifier/password combo of valid shape succeeds,
        // EXCEPT the literal word "fail" — kept in for reviewing error UI.
        if (passwordValue.toLowerCase() === "fail") {
          showAlert(alertEl, alertText, "Invalid Staff ID / email or password. Please try again.");
          return;
        }

        try {
          localStorage.setItem(
            "vsas_demo_session",
            JSON.stringify({ identifier: identifierValue, loggedInAt: Date.now() })
          );
        } catch (e) {
          /* localStorage may be unavailable — proceed regardless for the demo */
        }

        window.location.href = "dashboard.htm";
      }, 900);
    });

    initPasswordToggle("loginPasswordToggle", "loginPassword");
  }

  /* ---------- Forgot password page ---------- */

  function initForgotForm() {
    var form = document.getElementById("forgotForm");
    if (!form) return;

    var emailInput = document.getElementById("forgotEmail");
    var emailError = document.getElementById("forgotEmailError");
    var submitBtn = document.getElementById("forgotSubmit");
    var alertEl = document.getElementById("forgotAlert");
    var alertText = document.getElementById("forgotAlertText");

    var formState = document.getElementById("forgotFormState");
    var successState = document.getElementById("forgotSuccessState");
    var sentEmailEl = document.getElementById("forgotSentEmail");

    emailInput.addEventListener("input", function () {
      clearFieldError(emailInput, emailError);
      hideAlert(alertEl);
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      hideAlert(alertEl);

      var emailValue = emailInput.value.trim();

      if (!isValidEmail(emailValue)) {
        showFieldError(emailInput, emailError);
        return;
      }
      clearFieldError(emailInput, emailError);

      setLoading(submitBtn, true);

      // Demo-only — replace with POST /api/auth/forgot-password
      window.setTimeout(function () {
        setLoading(submitBtn, false);

        if (sentEmailEl) sentEmailEl.textContent = emailValue;
        formState.style.display = "none";
        successState.classList.add("is-visible");
      }, 900);
    });
  }

  /* ---------- Init ---------- */

  document.addEventListener("DOMContentLoaded", function () {
    initLoginForm();
    initForgotForm();
  });
})();