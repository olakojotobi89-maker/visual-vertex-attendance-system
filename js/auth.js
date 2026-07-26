/**
 * auth.js
 * -----------------------------------------------------------------------
 * Core authentication module for Visual Vertex Staff Attendance System.
 * Wraps Supabase Auth + the "profiles" table behind a small set of
 * reusable functions that any page can call via `window.VSASAuth`.
 *
 * Depends on (must be loaded first, in this order):
 *   1. Supabase CDN script            -> window.supabase
 *   2. js/supabase.js                 -> window.supabaseClient
 * -----------------------------------------------------------------------
 */

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

// Roles are matched case-insensitively (see redirectByRole), so keys here
// only need to be lowercase once.
const ROLE_REDIRECTS = {
  admin: "staff-management.html",
  hr: "staff-management.html",
  ceo: "staff-management.html",
  manager: "staff-management.html",
  staff: "dashboard.html",
};

const LOGIN_PAGE = "login.html";

/* ------------------------------------------------------------------ */
/* UI helpers: alerts + field errors                                   */
/* ------------------------------------------------------------------ */

/** Show an error message in the page's alert banner. */
function showError(message, alertId = "loginAlert", textId = "loginAlertText") {
  const alertBox = document.getElementById(alertId);
  const alertText = document.getElementById(textId);
  if (!alertBox || !alertText) return;

  alertBox.classList.remove("auth-alert--success");
  alertBox.classList.add("auth-alert--error");
  alertText.textContent = message;
  alertBox.style.display = "flex";
}

/** Show a success message in the page's alert banner. */
function showSuccess(message, alertId = "loginAlert", textId = "loginAlertText") {
  const alertBox = document.getElementById(alertId);
  const alertText = document.getElementById(textId);
  if (!alertBox || !alertText) return;

  alertBox.classList.remove("auth-alert--error");
  alertBox.classList.add("auth-alert--success");
  alertText.textContent = message;
  alertBox.style.display = "flex";
}

/** Hide the alert banner and clear any per-field validation states. */
function clearErrors(alertId = "loginAlert") {
  const alertBox = document.getElementById(alertId);
  if (alertBox) alertBox.style.display = "none";

  document.querySelectorAll(".form-control").forEach((el) => el.classList.remove("is-invalid"));
  document.querySelectorAll(".field-error").forEach((el) => el.classList.remove("is-visible"));
}

function setFieldError(inputId, errorId) {
  const input = document.getElementById(inputId);
  const error = document.getElementById(errorId);
  if (input) input.classList.add("is-invalid");
  if (error) error.classList.add("is-visible");
}

/** Toggle the submit button's loading/disabled state. */
function setButtonLoading(buttonId, isLoading) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  btn.dataset.loading = isLoading ? "true" : "false";
  btn.disabled = isLoading;
}

/* ------------------------------------------------------------------ */
/* Friendly error mapping                                              */
/* ------------------------------------------------------------------ */

function mapAuthError(error) {
  const msg = (error?.message || "").toLowerCase();

  if (msg.includes("invalid login credentials")) {
    return "Invalid Staff ID / email or password. Please try again.";
  }
  if (msg.includes("email not confirmed")) {
    return "Please confirm your email address before signing in.";
  }
  if (msg.includes("too many requests") || msg.includes("rate limit")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  return "Something went wrong while signing in. Please try again.";
}

/* ------------------------------------------------------------------ */
/* Core auth functions                                                 */
/* ------------------------------------------------------------------ */

/**
 * Resolve a login identifier to an email address.
 * Accepts either an email directly, or a Staff ID that gets looked up
 * in the "profiles" table.
 */
async function resolveEmail(identifier) {
  const value = identifier.trim();
  const looksLikeEmail = /\S+@\S+\.\S+/.test(value);
  if (looksLikeEmail) return value;

  const { data, error } = await window.supabaseClient
    .from("profiles")
    .select("email")
    .eq("staff_id", value)
    .single();

  if (error || !data) {
    throw new Error("We couldn't find an account with that Staff ID.");
  }

  return data.email;
}

/**
 * Sign a user in with Supabase Auth.
 * @param {string} identifier - Staff ID or email.
 * @param {string} password
 * @param {boolean} rememberMe - Controls session persistence (see supabase.js).
 * @returns {Promise<{user: object, session: object}>}
 */
async function login(identifier, password, rememberMe) {
  if (!window.supabaseClient) {
    throw new Error("Authentication service is not available. Please refresh and try again.");
  }

  // Must be set BEFORE signInWithPassword() so the custom storage adapter
  // in supabase.js knows whether to persist to localStorage or sessionStorage.
  localStorage.setItem("vsas_remember_me", rememberMe ? "true" : "false");

  const email = await resolveEmail(identifier);

  const { data, error } = await window.supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(mapAuthError(error));
  }

  return data;
}

/** Sign the current user out and send them back to the login page. */
async function logout() {
  if (!window.supabaseClient) return;
  await window.supabaseClient.auth.signOut();
  localStorage.removeItem("vsas_remember_me");
  window.location.href = LOGIN_PAGE;
}

/** Returns the currently authenticated Supabase user, or null. */
async function getCurrentUser() {
  if (!window.supabaseClient) return null;
  const { data, error } = await window.supabaseClient.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}

/** Fetches the profile row (from "profiles") for a given user id. */
async function getProfile(userId) {
  if (!window.supabaseClient) return null;

  const { data, error } = await window.supabaseClient
    .from("profiles")
    .select("id, staff_id, first_name, last_name, email, department, position, role, is_active")
    .eq("id", userId)
    .single();

  if (error || !data) return null;
  return data;
}

/**
 * Guards a protected page: redirects to login.html if there is no
 * authenticated session, no matching profile, or the account is inactive.
 * @returns {Promise<{user: object, profile: object} | null>}
 */
async function requireAuth() {
  const user = await getCurrentUser();

  if (!user) {
    window.location.href = LOGIN_PAGE;
    return null;
  }

  const profile = await getProfile(user.id);

  if (!profile || profile.is_active === false) {
    await window.supabaseClient.auth.signOut();
    window.location.href = LOGIN_PAGE;
    return null;
  }

  return { user, profile };
}

/**
 * Redirects the browser to the dashboard matching the given role.
 * Role matching is case-insensitive and trims whitespace, so "Admin",
 * " admin ", and "ADMIN" all resolve the same way — the `profiles.role`
 * column value isn't always guaranteed to be lowercase depending on how
 * a row was created.
 */
function redirectByRole(role) {
  const normalizedRole = (role || "").trim().toLowerCase();
  const destination = ROLE_REDIRECTS[normalizedRole];

  if (!destination) {
    showError("Your account role is not recognized. Please contact your administrator.");
    return;
  }
  window.location.href = destination;
}

/** Sends a Supabase password reset email. */
async function resetPassword(email) {
  if (!window.supabaseClient) {
    throw new Error("Authentication service is not available. Please refresh and try again.");
  }

  const redirectTo = `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, "")}reset-password.html`;

  const { error } = await window.supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    throw new Error(mapAuthError(error));
  }
}

/* ------------------------------------------------------------------ */
/* Login page wiring (only runs when #loginForm is present)            */
/* ------------------------------------------------------------------ */

document.addEventListener("DOMContentLoaded", () => {
  initPasswordToggles();
  initLoginRedirectIfLoggedIn();
  initLoginForm();
  initForgotPasswordForm();
  initResetPasswordPage();
});

/**
 * Show/hide password text via the eye icon button.
 * Generalized to wire up every `.password-toggle` button on the page
 * (login has one, reset-password has two), each paired with the
 * password input inside its own `.form-control-wrap--password`.
 */
function initPasswordToggles() {
  document.querySelectorAll(".password-toggle").forEach((toggle) => {
    const wrap = toggle.closest(".form-control-wrap--password");
    const input = wrap ? wrap.querySelector(".form-control") : null;
    if (!input) return;

    toggle.addEventListener("click", () => {
      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      toggle.setAttribute("aria-pressed", String(isPassword));
      toggle.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
    });
  });
}

/** If a valid session already exists, skip the login form entirely. */
async function initLoginRedirectIfLoggedIn() {
  const form = document.getElementById("loginForm");
  if (!form) return; // not on the login page

  const user = await getCurrentUser();
  if (!user) return;

  const profile = await getProfile(user.id);
  if (profile && profile.is_active !== false) {
    redirectByRole(profile.role);
  }
}

/** Wires up the login form: validation, submit, Supabase auth, redirect. */
function initLoginForm() {
  const form = document.getElementById("loginForm");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors();

    const identifier = document.getElementById("loginIdentifier").value.trim();
    const password = document.getElementById("loginPassword").value;
    const rememberMe = document.getElementById("rememberMe").checked;

    // Preserve existing client-side validation rules.
    let hasError = false;
    if (!identifier) {
      setFieldError("loginIdentifier", "identifierError");
      hasError = true;
    }
    if (!password || password.length < 6) {
      setFieldError("loginPassword", "passwordError");
      hasError = true;
    }
    if (hasError) return;

    setButtonLoading("loginSubmit", true);

    try {
      const { user } = await login(identifier, password, rememberMe);

      const profile = await getProfile(user.id);

      if (!profile) {
        await window.supabaseClient.auth.signOut();
        showError(
          "We couldn't find a staff profile for this account. Please contact HR or your administrator."
        );
        return;
      }

      if (profile.is_active === false) {
        await window.supabaseClient.auth.signOut();
        showError("This account has been deactivated. Please contact your administrator.");
        return;
      }

      showSuccess("Signed in successfully. Redirecting…");
      redirectByRole(profile.role);
    } catch (err) {
      showError(err.message || "Unable to sign in. Please try again.");
    } finally {
      setButtonLoading("loginSubmit", false);
    }
  });
}

/** Wires up the Forgot Password form: validation, submit, success-state swap. */
function initForgotPasswordForm() {
  const form = document.getElementById("forgotForm");
  if (!form) return; // not on the forgot-password page

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors("forgotAlert");

    const emailInput = document.getElementById("forgotEmail");
    const email = emailInput.value.trim();

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setFieldError("forgotEmail", "forgotEmailError");
      return;
    }

    setButtonLoading("forgotSubmit", true);

    try {
      await resetPassword(email);

      // Swap the request form out for the "check your inbox" success state.
      document.getElementById("forgotSentEmail").textContent = email;
      document.getElementById("forgotFormState").style.display = "none";
      document.getElementById("forgotSuccessState").style.display = "block";
    } catch (err) {
      showError(
        err.message || "We couldn't send the reset link. Please try again.",
        "forgotAlert",
        "forgotAlertText"
      );
    } finally {
      setButtonLoading("forgotSubmit", false);
    }
  });
}

/* ------------------------------------------------------------------ */
/* Reset Password page                                                 */
/* ------------------------------------------------------------------ */

/**
 * Wires up the Reset Password page.
 * Supabase redirects here from the email link with a recovery token in the
 * URL; the client (detectSessionInUrl: true) exchanges it for a session and
 * fires a "PASSWORD_RECOVERY" auth event. We wait briefly for that before
 * allowing the form to be used, since the exchange happens asynchronously
 * right after the page loads.
 */
async function initResetPasswordPage() {
  const form = document.getElementById("resetPasswordForm");
  if (!form) return; // not on the reset-password page

  if (!window.supabaseClient) {
    showError(
      "Authentication service is not available. Please refresh and try again.",
      "resetAlert",
      "resetAlertText"
    );
    return;
  }

  let recoveryReady = false;

  window.supabaseClient.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") {
      recoveryReady = true;
    }
  });

  // A session may already be present (event fired before we attached the
  // listener), or we may need to give the SDK a moment to parse the URL.
  const { data: initialData } = await window.supabaseClient.auth.getSession();
  if (initialData?.session) recoveryReady = true;

  if (!recoveryReady) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    const { data: retryData } = await window.supabaseClient.auth.getSession();
    if (retryData?.session) recoveryReady = true;
  }

  if (!recoveryReady) {
    showError(
      "This password reset link is invalid or has expired. Please request a new one.",
      "resetAlert",
      "resetAlertText"
    );
    form.querySelectorAll("input, button").forEach((el) => {
      el.disabled = true;
    });
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors("resetAlert");

    const password = document.getElementById("resetPassword").value;
    const confirmPassword = document.getElementById("resetConfirmPassword").value;

    let hasError = false;
    if (!password || password.length < 6) {
      setFieldError("resetPassword", "resetPasswordError");
      hasError = true;
    }
    if (password !== confirmPassword) {
      setFieldError("resetConfirmPassword", "resetConfirmPasswordError");
      hasError = true;
    }
    if (hasError) return;

    setButtonLoading("resetSubmit", true);

    try {
      const { error } = await window.supabaseClient.auth.updateUser({ password });
      if (error) throw new Error(mapAuthError(error));

      // Swap the form out for the success state, then redirect to login.
      document.getElementById("resetFormState").style.display = "none";
      document.getElementById("resetSuccessState").style.display = "block";

      setTimeout(() => {
        window.location.href = LOGIN_PAGE;
      }, 2500);
    } catch (err) {
      showError(
        err.message || "Unable to reset your password. Please try again.",
        "resetAlert",
        "resetAlertText"
      );
    } finally {
      setButtonLoading("resetSubmit", false);
    }
  });
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

window.VSASAuth = {
  login,
  logout,
  getCurrentUser,
  getProfile,
  requireAuth,
  redirectByRole,
  resetPassword,
  showError,
  showSuccess,
  clearErrors,
};