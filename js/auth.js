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

function showError(message, alertId = "loginAlert", textId = "loginAlertText") {
  const alertBox = document.getElementById(alertId);
  const alertText = document.getElementById(textId);
  if (!alertBox || !alertText) return;

  alertBox.classList.remove("auth-alert--success");
  alertBox.classList.add("auth-alert--error");
  alertText.textContent = message;
  alertBox.style.display = "flex";
}

function showSuccess(message, alertId = "loginAlert", textId = "loginAlertText") {
  const alertBox = document.getElementById(alertId);
  const alertText = document.getElementById(textId);
  if (!alertBox || !alertText) return;

  alertBox.classList.remove("auth-alert--error");
  alertBox.classList.add("auth-alert--success");
  alertText.textContent = message;
  alertBox.style.display = "flex";
}

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

async function login(identifier, password, rememberMe) {
  if (!window.supabaseClient) {
    throw new Error("Authentication service is not available. Please refresh and try again.");
  }

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

async function logout() {
  if (!window.supabaseClient) return;
  await window.supabaseClient.auth.signOut();
  localStorage.removeItem("vsas_remember_me");
  window.location.href = LOGIN_PAGE;
}

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
    .select("id, staff_id, first_name, last_name, email, department, position, role, is_active, avatar_url")
    .eq("id", userId)
    .single();

  if (error || !data) return null;
  return data;
}

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

function redirectByRole(role) {
  const normalizedRole = (role || "").trim().toLowerCase();
  const destination = ROLE_REDIRECTS[normalizedRole];

  if (!destination) {
    showError("Your account role is not recognized. Please contact your administrator.");
    return;
  }
  window.location.href = destination;
}

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

async function initLoginRedirectIfLoggedIn() {
  const form = document.getElementById("loginForm");
  if (!form) return;

  const user = await getCurrentUser();
  if (!user) return;

  const profile = await getProfile(user.id);
  if (profile && profile.is_active !== false) {
    redirectByRole(profile.role);
  }
}

function initLoginForm() {
  const form = document.getElementById("loginForm");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors();

    const identifier = document.getElementById("loginIdentifier").value.trim();
    const password = document.getElementById("loginPassword").value;
    const rememberMe = document.getElementById("rememberMe").checked;

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

function initForgotPasswordForm() {
  const form = document.getElementById("forgotForm");
  if (!form) return;

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

async function initResetPasswordPage() {
  const form = document.getElementById("resetPasswordForm");
  if (!form) return;

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