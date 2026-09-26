/**
 * birthday-celebration.js
 * -----------------------------------------------------------------------
 * Manual Birthday Celebration feature for VSAS.
 *
 * Deliberately self-contained so it can be dropped onto ANY VSAS page
 * (this admin page today, a staff-facing portal later) by including just:
 *   <link rel="stylesheet" href="css/birthday-celebration.css">
 *   <script src="js/birthday-celebration.js"></script>
 * after the existing Supabase CDN + js/supabase.js + js/auth.js scripts.
 *
 * It does NOT modify, import from, or depend on staff-management.js.
 * It does NOT do any date-of-birth logic, scheduling, or cron-style
 * scanning — every celebration is created by an admin action and read
 * back over Supabase Realtime.
 *
 * Two responsibilities:
 *   1. ADMIN: wire the "Birthday Celebration" modal on staff-management.html
 *      (upload flyer -> preview -> publish to Supabase).
 *   2. EVERYONE: listen for newly published celebrations and play the
 *      animated overlay. The overlay DOM is built at runtime, so pages
 *      that don't include the modal markup (e.g. a future staff portal)
 *      still get the full celebration experience for free.
 * -----------------------------------------------------------------------
 */

(function () {
  "use strict";

  const BUCKET = "birthday-flyers";
  const TABLE = "birthday_celebrations";
  const MAX_FLYER_BYTES = 5 * 1024 * 1024; // 5MB
  const ALLOWED_TYPES = ["image/png", "image/jpeg"];

  let selectedFlyerFile = null;
  let realtimeChannel = null;

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    if (!window.supabaseClient) {
      // This page hasn't loaded the Supabase client yet (or ever) — nothing to do.
      return;
    }

    wireAdminModalIfPresent();
    subscribeToCelebrations();
  }

  /* ------------------------------------------------------------------ */
  /* ADMIN: publish modal                                                */
  /* ------------------------------------------------------------------ */

  function wireAdminModalIfPresent() {
    const openBtn = document.getElementById("openBirthdayBtn");
    const modal = document.getElementById("birthdayModal");

    // Modal markup only exists on staff-management.html today. On any
    // other page this simply does nothing further.
    if (!openBtn || !modal) return;

    const closeBtn = document.getElementById("closeBirthdayBtn");
    const cancelBtn = document.getElementById("cancelBirthdayBtn");
    const form = document.getElementById("birthdayForm");
    const staffSelect = document.getElementById("birthdayStaffSelect");
    const flyerInput = document.getElementById("birthdayFlyerInput");
    const uploadLabel = document.getElementById("birthdayUploadLabel");

    const closeModal = () => modal.classList.remove("is-open");

    openBtn.addEventListener("click", () => {
      openModal(modal, staffSelect);
    });

    closeBtn && closeBtn.addEventListener("click", closeModal);
    cancelBtn && cancelBtn.addEventListener("click", closeModal);
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeModal();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && modal.classList.contains("is-open")) {
        closeModal();
      }
    });

    staffSelect && staffSelect.addEventListener("change", () => {
      const opt = staffSelect.selectedOptions[0];
      if (!opt || !opt.value) return;

      const nameField = document.getElementById("birthdayDisplayName");
      const deptField = document.getElementById("birthdayDeptPosition");

      if (nameField && !nameField.value) {
        nameField.value = opt.dataset.name || "";
      }
      if (deptField && !deptField.value) {
        deptField.value = opt.dataset.deptPosition || "";
      }
    });

    flyerInput && flyerInput.addEventListener("change", (event) => {
      handleFlyerSelected(event.target.files[0], uploadLabel);
    });

    form && form.addEventListener("submit", handlePublishSubmit);
  }

  async function openModal(modal, staffSelect) {
    resetForm();
    await populateStaffOptions(staffSelect);
    modal.classList.add("is-open");
  }

  function resetForm() {
    const form = document.getElementById("birthdayForm");
    form && form.reset();

    selectedFlyerFile = null;

    const previewWrap = document.getElementById("birthdayPreviewWrap");
    if (previewWrap) previewWrap.style.display = "none";

    const uploadLabel = document.getElementById("birthdayUploadLabel");
    if (uploadLabel) uploadLabel.textContent = "Click to upload the designed flyer (JPG or PNG, max 5MB)";

    clearBirthdayErrors();
  }

  async function populateStaffOptions(staffSelect) {
    if (!staffSelect) return;

    staffSelect.innerHTML = `<option value="">Loading staff…</option>`;

    try {
      const { data, error } = await window.supabaseClient
        .from("profiles")
        .select("id, first_name, last_name, department, position, is_active")
        .eq("is_active", true)
        .order("first_name", { ascending: true });

      if (error) throw error;

      const staff = data || [];

      if (staff.length === 0) {
        staffSelect.innerHTML = `<option value="">No active staff found</option>`;
        return;
      }

      staffSelect.innerHTML =
        `<option value="">Select staff member</option>` +
        staff
          .map((s) => {
            const name = `${s.first_name || ""} ${s.last_name || ""}`.trim() || "Unnamed staff";
            const deptPosition = [s.position, s.department].filter(Boolean).join(", ");
            return `<option value="${escapeAttr(s.id)}" data-name="${escapeAttr(name)}" data-dept-position="${escapeAttr(deptPosition)}">${escapeAttr(name)}</option>`;
          })
          .join("");
    } catch (err) {
      console.error("[VSAS Birthday] Failed to load staff list:", err);
      staffSelect.innerHTML = `<option value="">Could not load staff</option>`;
    }
  }

  function handleFlyerSelected(file, uploadLabel) {
    clearFieldError("birthdayFlyerInput", "birthdayFlyerError");

    if (!file) {
      selectedFlyerFile = null;
      hidePreview();
      return;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      markFieldInvalid("birthdayFlyerInput", "birthdayFlyerError", "Only JPG or PNG images are supported.");
      selectedFlyerFile = null;
      hidePreview();
      return;
    }

    if (file.size > MAX_FLYER_BYTES) {
      markFieldInvalid("birthdayFlyerInput", "birthdayFlyerError", "The flyer must be under 5MB.");
      selectedFlyerFile = null;
      hidePreview();
      return;
    }

    selectedFlyerFile = file;
    if (uploadLabel) uploadLabel.textContent = file.name;

    const reader = new FileReader();
    reader.onload = (event) => showPreview(event.target.result);
    reader.readAsDataURL(file);
  }

  function showPreview(dataUrl) {
    const wrap = document.getElementById("birthdayPreviewWrap");
    const img = document.getElementById("birthdayPreviewImg");
    if (img) img.src = dataUrl;
    if (wrap) wrap.style.display = "block";
  }

  function hidePreview() {
    const wrap = document.getElementById("birthdayPreviewWrap");
    if (wrap) wrap.style.display = "none";
  }

  async function handlePublishSubmit(event) {
    event.preventDefault();
    clearBirthdayErrors();

    const staffSelect = document.getElementById("birthdayStaffSelect");
    const nameField = document.getElementById("birthdayDisplayName");
    const deptPositionField = document.getElementById("birthdayDeptPosition");
    const messageField = document.getElementById("birthdayMessage");

    const staffId = staffSelect ? staffSelect.value : "";
    const displayName = nameField ? nameField.value.trim() : "";
    const deptPosition = deptPositionField ? deptPositionField.value.trim() : "";
    const message = messageField ? messageField.value.trim() : "";

    let isValid = true;

    if (!staffId) {
      markFieldInvalid("birthdayStaffSelect", "birthdayStaffError");
      isValid = false;
    }
    if (!displayName) {
      markFieldInvalid("birthdayDisplayName", "birthdayNameError");
      isValid = false;
    }
    if (!selectedFlyerFile) {
      markFieldInvalid("birthdayFlyerInput", "birthdayFlyerError", "Upload a JPG or PNG flyer under 5MB.");
      isValid = false;
    }

    if (!isValid) return;

    setPublishLoading(true);

    try {
      const { data: userData, error: userError } = await window.supabaseClient.auth.getUser();
      if (userError) throw userError;
      const currentUserId = userData?.user?.id || null;

      // 1. Upload the flyer as-is. VSAS never generates or edits this image.
      const safeName = selectedFlyerFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${staffId}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await window.supabaseClient
        .storage
        .from(BUCKET)
        .upload(path, selectedFlyerFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: selectedFlyerFile.type,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = window.supabaseClient
        .storage
        .from(BUCKET)
        .getPublicUrl(path);

      const flyerUrl = publicUrlData?.publicUrl;
      if (!flyerUrl) throw new Error("Could not resolve a public URL for the uploaded flyer.");

      // 2. Record the celebration.
      const { data: inserted, error: insertError } = await window.supabaseClient
        .from(TABLE)
        .insert({
          staff_id: staffId,
          staff_name: displayName,
          department: deptPosition || null,
          message: message || null,
          flyer_path: path,
          flyer_url: flyerUrl,
          created_by: currentUserId,
          status: "published",
          published_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // 3. Distribute through the EXISTING notification system (reuses the
      //    same "manage-vsas" edge function the Notify Staff modal uses).
      //    This is a courtesy text alert; the actual flyer + animation is
      //    delivered via the celebration record + realtime subscription
      //    above, since the generic notification pipeline is text-only.
      try {
        await window.supabaseClient.functions.invoke("manage-vsas", {
          body: {
            action: "notification_publish",
            title: `\uD83C\uDF89 Happy Birthday, ${displayName}!`,
            body: message || `Join us in celebrating ${displayName}'s birthday today!`,
            category: "announcement",
            target_type: "all",
          },
        });
      } catch (notifyErr) {
        console.warn("[VSAS Birthday] Celebration published, but the companion notification failed:", notifyErr);
      }

      document.getElementById("birthdayModal")?.classList.remove("is-open");
      notify(`Birthday celebration for ${displayName} was published.`, "success");

      // Preview the exact staff-facing experience immediately for the admin.
      playCelebration(inserted);
    } catch (err) {
      console.error("[VSAS Birthday] Failed to publish celebration:", err);
      showBirthdayAlert(err?.message || "Could not publish this celebration. Please try again.");
    } finally {
      setPublishLoading(false);
    }
  }

  function setPublishLoading(isLoading) {
    const btn = document.getElementById("publishBirthdayBtn");
    if (!btn) return;
    btn.disabled = isLoading;
    btn.dataset.loading = isLoading ? "true" : "false";
  }

  function showBirthdayAlert(message) {
    const alertBox = document.getElementById("birthdayAlert");
    const alertText = document.getElementById("birthdayAlertText");
    if (alertText) alertText.textContent = message;
    if (alertBox) alertBox.style.display = "flex";
  }

  function clearBirthdayErrors() {
    const alertBox = document.getElementById("birthdayAlert");
    if (alertBox) alertBox.style.display = "none";

    document.querySelectorAll("#birthdayForm .form-control").forEach((el) => el.classList.remove("is-invalid"));
    document.querySelectorAll("#birthdayForm .field-error").forEach((el) => el.classList.remove("is-visible"));
  }

  function markFieldInvalid(fieldId, errorId, customMessage) {
    const field = document.getElementById(fieldId);
    const error = document.getElementById(errorId);
    if (field) field.classList.add("is-invalid");
    if (error) {
      if (customMessage) error.querySelector("span").textContent = customMessage;
      error.classList.add("is-visible");
    }
  }

  function clearFieldError(fieldId, errorId) {
    const field = document.getElementById(fieldId);
    const error = document.getElementById(errorId);
    if (field) field.classList.remove("is-invalid");
    if (error) error.classList.remove("is-visible");
  }

  function notify(message, kind) {
    // Reuse staff-management.js's toast if it's on this page; otherwise
    // fall back to a minimal one so this module still works standalone.
    if (typeof window.showToast === "function") {
      window.showToast(message, kind);
      return;
    }
    console.log(`[VSAS Birthday] ${message}`);
  }

  /* ------------------------------------------------------------------ */
  /* EVERYONE: realtime subscription + celebration overlay               */
  /* ------------------------------------------------------------------ */

  function subscribeToCelebrations() {
    if (realtimeChannel) return;

    realtimeChannel = window.supabaseClient
      .channel("birthday-celebrations-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: TABLE },
        (payload) => {
          const record = payload.new;
          if (record && record.status === "published") {
            playCelebration(record);
          }
        }
      )
      .subscribe();

    window.addEventListener("beforeunload", () => {
      if (realtimeChannel) window.supabaseClient.removeChannel(realtimeChannel);
    });
  }

  function ensureOverlayDom() {
    let overlay = document.getElementById("birthdayOverlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "birthdayOverlay";
    overlay.className = "birthday-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Birthday celebration");
    overlay.innerHTML = `
      <div class="birthday-overlay__scrim"></div>
      <canvas class="birthday-overlay__confetti" id="birthdayConfettiCanvas"></canvas>
      <button type="button" class="birthday-overlay__close" id="closeBirthdayOverlayBtn" aria-label="Close celebration">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="18" height="18"><path d="M18 6 6 18M6 6l12 12" stroke-linecap="round"/></svg>
      </button>
      <div class="birthday-overlay__content">
        <div class="birthday-overlay__headline">HAPPY BIRTHDAY!</div>
        <div class="birthday-overlay__name" id="birthdayOverlayName"></div>
        <div class="birthday-overlay__flyer-frame">
          <img id="birthdayOverlayFlyer" class="birthday-overlay__flyer" alt="Birthday flyer" />
        </div>
        <p class="birthday-overlay__message" id="birthdayOverlayMessage"></p>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById("closeBirthdayOverlayBtn").addEventListener("click", closeCelebration);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay || event.target.classList.contains("birthday-overlay__scrim")) {
        closeCelebration();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && overlay.classList.contains("is-open")) {
        closeCelebration();
      }
    });

    return overlay;
  }

  let confettiState = null;

  function playCelebration(record) {
    if (!record) return;

    const overlay = ensureOverlayDom();
    const nameEl = document.getElementById("birthdayOverlayName");
    const flyerEl = document.getElementById("birthdayOverlayFlyer");
    const messageEl = document.getElementById("birthdayOverlayMessage");

    if (nameEl) {
      nameEl.textContent = [record.staff_name, record.department].filter(Boolean).join(" \u2022 ");
    }
    if (flyerEl) flyerEl.src = record.flyer_url;
    if (messageEl) messageEl.textContent = record.message || "";

    overlay.classList.remove("is-settled");
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");

    startConfetti(document.getElementById("birthdayConfettiCanvas"));

    // Let the burst run at full intensity briefly, then settle into a
    // quiet idle state rather than looping heavily forever.
    clearTimeout(playCelebration._settleTimer);
    playCelebration._settleTimer = setTimeout(() => {
      overlay.classList.add("is-settled");
      if (confettiState) confettiState.settle();
    }, 4500);
  }

  function closeCelebration() {
    const overlay = document.getElementById("birthdayOverlay");
    if (!overlay) return;
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    stopConfetti();
  }

  /* --- Minimal, dependency-free confetti/particle system --- */

  function startConfetti(canvas) {
    if (!canvas) return;
    stopConfetti();

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const colors = ["#E53935", "#F5C451", "#FFFFFF", "#B71C1C"];
    const particles = [];
    const maxParticles = reducedMotion ? 0 : 140;

    function spawn(count) {
      for (let i = 0; i < count && particles.length < maxParticles; i++) {
        particles.push({
          x: Math.random() * window.innerWidth,
          y: -20 - Math.random() * 200,
          w: 6 + Math.random() * 6,
          h: 8 + Math.random() * 10,
          vy: 1.5 + Math.random() * 2.5,
          vx: -1 + Math.random() * 2,
          rot: Math.random() * Math.PI,
          vr: -0.15 + Math.random() * 0.3,
          color: colors[Math.floor(Math.random() * colors.length)],
          opacity: 1,
        });
      }
    }

    let emitting = true;
    let settling = false;

    spawn(maxParticles);

    let rafId;
    function tick() {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;

        if (settling) p.opacity -= 0.012;

        if (p.y > window.innerHeight + 30 || p.opacity <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(p.opacity, 0);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      if (emitting && !settling && Math.random() < 0.3) {
        spawn(4);
      }

      rafId = requestAnimationFrame(tick);
    }
    tick();

    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    confettiState = {
      settle() {
        emitting = false;
        settling = true;
      },
      stop() {
        cancelAnimationFrame(rafId);
        window.removeEventListener("resize", onResize);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      },
    };
  }

  function stopConfetti() {
    if (confettiState) {
      confettiState.stop();
      confettiState = null;
    }
  }

  function escapeAttr(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Exposed for reuse (e.g. a future staff portal page could call
  // window.VSASBirthday.play(record) directly if it fetches a record itself).
  window.VSASBirthday = { play: playCelebration, close: closeCelebration };
})();