/* =========================================================
   VSAS — profile.js
   Lets a signed-in staff member view their own profile and edit the
   fields they're allowed to touch (phone number, avatar, password).

   Admin-controlled fields — role, department, position, staff_id,
   is_active — are shown read-only here. That's enforced for real at the
   database level by a trigger (see enable-profile-editing.sql), not just
   hidden in this UI, so it holds even against a direct API call.

   Depends on (must be loaded first, in this order):
     1. Supabase CDN            -> window.supabase
     2. js/supabase.js          -> window.supabaseClient
     3. js/auth.js              -> window.VSASAuth (requireAuth, logout, etc.)
   ========================================================= */

(function () {
  "use strict";

  const els = {};
  let currentUser = null;
  let currentProfile = null;

  const AVATAR_BUCKET = "avatars";
  const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png"]);
  const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB

  function getInitials(name) {
    return (name || "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("");
  }

  function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function isPhone(value) {
    return /^[+\d][\d\s-]{6,}$/.test(value);
  }

  /* ---------- Rendering ---------- */

  function renderProfile() {
    if (!currentProfile) return;

    const fullName = `${currentProfile.first_name || ""} ${currentProfile.last_name || ""}`.trim() || "Staff Member";
    const initials = getInitials(fullName);

    if (els.profilePhoto) {
      if (currentProfile.avatar_url) {
        els.profilePhoto.innerHTML = `<img src="${escapeHtml(currentProfile.avatar_url)}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
      } else {
        els.profilePhoto.textContent = initials;
      }
    }

    if (els.profileName) els.profileName.textContent = fullName;
    if (els.profileRole) els.profileRole.textContent = currentProfile.position || currentProfile.role || "";
    if (els.profileEmail) els.profileEmail.textContent = currentProfile.email || "—";
    if (els.profileDepartment) els.profileDepartment.textContent = currentProfile.department || "—";
    if (els.profileStaffId) els.profileStaffId.textContent = currentProfile.staff_id || "—";
    if (els.profilePosition) els.profilePosition.textContent = currentProfile.position || "—";
    if (els.profileRoleValue) els.profileRoleValue.textContent = currentProfile.role || "—";
    if (els.profileJoinedDate) {
      els.profileJoinedDate.textContent = currentProfile.created_at
        ? new Date(currentProfile.created_at).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : "—";
    }

    if (els.topAvatarCircle) els.topAvatarCircle.textContent = initials;
    if (els.topAvatarName) els.topAvatarName.textContent = fullName;

    if (els.phoneInput) els.phoneInput.value = currentProfile.phone || "";
  }

  function showAlert(el, message, kind) {
    if (!el) return;
    el.textContent = message;
    el.classList.remove("profile-alert--success", "profile-alert--error");
    el.classList.add(kind === "success" ? "profile-alert--success" : "profile-alert--error");
    el.style.display = "block";
  }

  function hideAlert(el) {
    if (el) el.style.display = "none";
  }

  /* ---------- Contact info (phone) ---------- */

  async function handleContactSubmit(event) {
    event.preventDefault();
    hideAlert(els.contactAlert);

    const phone = els.phoneInput.value.trim();
    if (phone && !isPhone(phone)) {
      showAlert(els.contactAlert, "Enter a valid phone number.", "error");
      return;
    }

    els.saveContactBtn.disabled = true;
    els.saveContactBtn.textContent = "Saving…";

    try {
      const { error } = await window.supabaseClient
        .from("profiles")
        .update({ phone: phone || null })
        .eq("id", currentUser.id);

      if (error) throw error;

      currentProfile.phone = phone || null;
      showAlert(els.contactAlert, "Contact info updated.", "success");
    } catch (err) {
      console.error("[VSAS] Failed to update contact info:", err);
      showAlert(els.contactAlert, err.message || "Could not save changes. Please try again.", "error");
    } finally {
      els.saveContactBtn.disabled = false;
      els.saveContactBtn.textContent = "Save Changes";
    }
  }

  /* ---------- Avatar upload ---------- */

  async function handleAvatarChange(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
      alert("Profile picture must be a JPG or PNG image.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      alert("Profile picture must be 2MB or smaller.");
      event.target.value = "";
      return;
    }

    els.avatarUploadLabel.textContent = "Uploading…";

    try {
      const extension = file.type === "image/png" ? "png" : "jpg";
      const path = `${currentUser.id}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await window.supabaseClient.storage
        .from(AVATAR_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = window.supabaseClient.storage.from(AVATAR_BUCKET).getPublicUrl(path);
      const avatarUrl = publicUrlData.publicUrl;

      const { error: updateError } = await window.supabaseClient
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", currentUser.id);

      if (updateError) throw updateError;

      currentProfile.avatar_url = avatarUrl;
      renderProfile();
    } catch (err) {
      console.error("[VSAS] Failed to update avatar:", err);
      alert(err.message || "Could not upload photo. Please try again.");
    } finally {
      els.avatarUploadLabel.textContent = "Change photo (JPG or PNG, max 2MB)";
      event.target.value = "";
    }
  }

  /* ---------- Password change ---------- */

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    hideAlert(els.passwordAlert);

    const newPassword = els.newPasswordInput.value;
    const confirmPassword = els.confirmPasswordInput.value;

    if (!newPassword || newPassword.length < 8) {
      showAlert(els.passwordAlert, "Password must be at least 8 characters.", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert(els.passwordAlert, "Passwords do not match.", "error");
      return;
    }

    els.savePasswordBtn.disabled = true;
    els.savePasswordBtn.textContent = "Updating…";

    try {
      const { error } = await window.supabaseClient.auth.updateUser({ password: newPassword });
      if (error) throw error;

      showAlert(els.passwordAlert, "Password updated successfully.", "success");
      els.passwordForm.reset();
    } catch (err) {
      console.error("[VSAS] Failed to update password:", err);
      showAlert(els.passwordAlert, err.message || "Could not update password. Please try again.", "error");
    } finally {
      els.savePasswordBtn.disabled = false;
      els.savePasswordBtn.textContent = "Update Password";
    }
  }

  /* ---------- Init ---------- */

  function cacheEls() {
    els.profilePhoto = document.getElementById("profilePhoto");
    els.profileName = document.getElementById("profileName");
    els.profileRole = document.getElementById("profileRole");
    els.profileEmail = document.getElementById("profileEmail");
    els.profileDepartment = document.getElementById("profileDepartment");
    els.profileStaffId = document.getElementById("profileStaffId");
    els.profilePosition = document.getElementById("profilePosition");
    els.profileRoleValue = document.getElementById("profileRoleValue");
    els.profileJoinedDate = document.getElementById("profileJoinedDate");

    els.topAvatarCircle = document.getElementById("topAvatarCircle");
    els.topAvatarName = document.getElementById("topAvatarName");

    els.avatarUploadInput = document.getElementById("avatarUploadInput");
    els.avatarUploadLabel = document.getElementById("avatarUploadLabel");

    els.contactForm = document.getElementById("contactForm");
    els.contactAlert = document.getElementById("contactAlert");
    els.phoneInput = document.getElementById("phoneInput");
    els.saveContactBtn = document.getElementById("saveContactBtn");

    els.passwordForm = document.getElementById("passwordForm");
    els.passwordAlert = document.getElementById("passwordAlert");
    els.newPasswordInput = document.getElementById("newPasswordInput");
    els.confirmPasswordInput = document.getElementById("confirmPasswordInput");
    els.savePasswordBtn = document.getElementById("savePasswordBtn");

    els.logoutLink = document.getElementById("logoutLink");
  }

  document.addEventListener("DOMContentLoaded", async () => {
    cacheEls();

    if (!els.contactForm) return; // Not on the profile page

    const auth = await window.VSASAuth.requireAuth();
    if (!auth) return;

    currentUser = auth.user;
    currentProfile = auth.profile;

    if (els.logoutLink) {
      els.logoutLink.addEventListener("click", (event) => {
        event.preventDefault();
        window.VSASAuth.logout();
      });
    }

    renderProfile();

    els.contactForm.addEventListener("submit", handleContactSubmit);
    els.passwordForm.addEventListener("submit", handlePasswordSubmit);
    els.avatarUploadInput.addEventListener("change", handleAvatarChange);
  });
})();