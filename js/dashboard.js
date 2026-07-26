/* =========================================================
   VSAS — dashboard.js
   Real, Supabase-backed check-in / check-out.

   Every write goes straight to the "attendance" table, so it's visible to
   Admin/HR/Manager/CEO on staff-management.html in real time via Supabase
   Realtime — no localStorage, no demo data, nothing device-specific.

   Depends on (must be loaded first, in this order):
     1. Supabase CDN            -> window.supabase
     2. js/supabase.js          -> window.supabaseClient
     3. js/auth.js              -> window.VSASAuth (requireAuth, logout, etc.)
   ========================================================= */

(function () {
  "use strict";

  const els = {};
  let clockInterval = null;
  let currentUser = null; // Supabase auth user
  let currentProfile = null; // "profiles" row
  let todayRecord = null; // this user's "attendance" row for today, or null
  let isSubmitting = false; // guards against double-click race conditions

  /* ---------- Date helpers ---------- */

  /**
   * Returns today's date as YYYY-MM-DD in the browser's local timezone.
   * Intentionally not `Date#toISOString()` (which is UTC-based) — this
   * must match the same local-date convention staff-management.js uses,
   * so both sides agree on which calendar day a check-in belongs to.
   */
  function todayDateString() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function firstOfMonthDateString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  }

  /* ---------- Formatting helpers ---------- */

  function formatTime(date) {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  }

  function formatTimeShort(date) {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  function formatDateLong(date) {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function formatDateShort(date) {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function formatDuration(ms) {
    const totalMinutes = Math.max(0, Math.floor(ms / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }

  function getInitials(name) {
    return (name || "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("");
  }

  /* ---------- Greeting ---------- */

  function greetingForHour(hour) {
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  }

  function updateGreeting() {
    const now = new Date();
    const firstName = currentProfile?.first_name || "there";
    if (els.greetingText) {
      els.greetingText.textContent = `${greetingForHour(now.getHours())}, ${firstName}`;
    }
  }

  /* ---------- Live clock ---------- */

  function tickClock() {
    const now = new Date();

    if (els.liveClock) els.liveClock.textContent = formatTime(now);
    if (els.liveClockDate) els.liveClockDate.textContent = formatDateLong(now);
    if (els.currentDateText) els.currentDateText.textContent = formatDateLong(now);
    if (els.miniClock) els.miniClock.textContent = formatTimeShort(now);

    updateHoursWorked();
  }

  /* ---------- Profile card + topbar ---------- */

  function renderProfile() {
    if (!currentProfile) return;

    const fullName = `${currentProfile.first_name || ""} ${currentProfile.last_name || ""}`.trim() || "Staff Member";
    const initials = getInitials(fullName);

    if (els.profilePhoto) els.profilePhoto.textContent = initials;
    if (els.profileName) els.profileName.textContent = fullName;
    if (els.profileRole) els.profileRole.textContent = currentProfile.position || currentProfile.role || "";
    if (els.profileDepartment) els.profileDepartment.textContent = currentProfile.department || "—";
    if (els.profileStaffId) els.profileStaffId.textContent = currentProfile.staff_id || "—";
    if (els.profilePosition) els.profilePosition.textContent = currentProfile.position || "—";

    if (els.topAvatarCircle) els.topAvatarCircle.textContent = initials;
    if (els.topAvatarName) els.topAvatarName.textContent = fullName;

    updateGreeting();
  }

  /* ---------- Attendance state: load, render, act ---------- */

  /** Fetches this user's attendance row for today directly from Supabase. */
  async function loadTodayRecord() {
    const { data, error } = await window.supabaseClient
      .from("attendance")
      .select("id, check_in, check_out")
      .eq("staff_id", currentUser.id)
      .eq("work_date", todayDateString())
      .maybeSingle();

    if (error) {
      console.error("[VSAS] Failed to load today's attendance:", error);
      todayRecord = null;
      return;
    }

    todayRecord = data || null;
  }

  function renderAttendanceState() {
    const pill = els.statusPill;
    const btn = els.actionBtn;
    if (!pill || !btn) return;

    btn.disabled = false;

    if (!todayRecord || !todayRecord.check_in) {
      pill.textContent = "Not Checked In";
      pill.className = "status-pill status-pill--not-checked-in";
      btn.textContent = "Check In";
      btn.dataset.action = "check-in";
      els.checkInTime.textContent = "\u2014\u2014";
      els.checkOutTime.textContent = "\u2014\u2014";
      return;
    }

    els.checkInTime.textContent = formatTimeShort(new Date(todayRecord.check_in));

    if (!todayRecord.check_out) {
      pill.textContent = "Checked In";
      pill.className = "status-pill status-pill--checked-in";
      btn.textContent = "Check Out";
      btn.dataset.action = "check-out";
      els.checkOutTime.textContent = "\u2014\u2014";
      return;
    }

    pill.textContent = "Checked Out";
    pill.className = "status-pill status-pill--checked-out";
    btn.textContent = "Checked Out for Today";
    btn.dataset.action = "done";
    btn.disabled = true;
    els.checkOutTime.textContent = formatTimeShort(new Date(todayRecord.check_out));
  }

  function updateHoursWorked() {
    if (!els.hoursWorkedValue) return;

    if (!todayRecord || !todayRecord.check_in) {
      els.hoursWorkedValue.textContent = "0h 00m";
      return;
    }

    const end = todayRecord.check_out ? new Date(todayRecord.check_out) : new Date();
    const diff = end - new Date(todayRecord.check_in);
    els.hoursWorkedValue.textContent = formatDuration(diff);
  }

  /**
   * Handles the Check In / Check Out button.
   * Writes straight to Supabase — this is what makes the check-in visible
   * to admins on staff-management.html in real time.
   */
  async function handleAttendanceAction() {
    if (isSubmitting) return;
    const action = els.actionBtn.dataset.action;
    if (action !== "check-in" && action !== "check-out") return;

    isSubmitting = true;
    els.actionBtn.disabled = true;
    const originalLabel = els.actionBtn.textContent;
    els.actionBtn.textContent = action === "check-in" ? "Checking in…" : "Checking out…";

    try {
      const nowIso = new Date().toISOString();

      if (action === "check-in") {
        // Upsert on (staff_id, work_date): creates today's row on first
        // check-in, or safely no-ops/updates check_in if retried — it never
        // touches check_out since that column isn't part of this payload.
        const { data, error } = await window.supabaseClient
          .from("attendance")
          .upsert(
            { staff_id: currentUser.id, work_date: todayDateString(), check_in: nowIso },
            { onConflict: "staff_id,work_date" }
          )
          .select("id, check_in, check_out")
          .single();

        if (error) throw error;
        todayRecord = data;
      } else {
        if (!todayRecord?.id) throw new Error("No check-in found for today yet.");

        const { data, error } = await window.supabaseClient
          .from("attendance")
          .update({ check_out: nowIso })
          .eq("id", todayRecord.id)
          .select("id, check_in, check_out")
          .single();

        if (error) throw error;
        todayRecord = data;
      }

      renderAttendanceState();
      updateHoursWorked();
      await Promise.all([loadPersonalStats(), loadCompanyTodaySummary(), loadRecentActivity()]);
    } catch (err) {
      console.error("[VSAS] Attendance action failed:", err);
      alert(err.message || "Something went wrong. Please try again.");
      els.actionBtn.textContent = originalLabel;
    } finally {
      isSubmitting = false;
      renderAttendanceState(); // re-syncs label/disabled state from the latest todayRecord
    }
  }

  /* ---------- Overview stat cards ---------- */

  /** Personal stats for the current calendar month, computed from real attendance rows. */
  async function loadPersonalStats() {
    if (!els.daysPresentValue && !els.attendanceRateValue) return;

    try {
      const { data, error } = await window.supabaseClient
        .from("attendance")
        .select("work_date, check_in")
        .eq("staff_id", currentUser.id)
        .gte("work_date", firstOfMonthDateString())
        .lte("work_date", todayDateString());

      if (error) throw error;

      const rows = data || [];
      const daysPresent = rows.filter((r) => r.check_in).length;
      const daysElapsed = new Date().getDate(); // day-of-month so far, e.g. 12 on Aug 12
      const rate = daysElapsed > 0 ? Math.round((daysPresent / daysElapsed) * 100) : 0;

      if (els.daysPresentValue) els.daysPresentValue.textContent = String(daysPresent);
      if (els.attendanceRateValue) els.attendanceRateValue.textContent = `${rate}%`;
    } catch (err) {
      console.error("[VSAS] Failed to load personal attendance stats:", err);
    }
  }

  /**
   * Company-wide "checked in today" count, via a security-definer RPC that
   * returns aggregate counts only — never individual attendance rows — so
   * it's safe to expose to every signed-in staff member, not just managers.
   */
  async function loadCompanyTodaySummary() {
    if (!els.companyAttendanceValue) return;

    try {
      const { data, error } = await window.supabaseClient.rpc("today_attendance_summary", {
        target_date: todayDateString(),
      });

      if (error) throw error;

      const summary = Array.isArray(data) ? data[0] : data;
      if (summary) {
        els.companyAttendanceValue.textContent = `${summary.checked_in} / ${summary.total_active_staff}`;
      }
    } catch (err) {
      console.error("[VSAS] Failed to load company attendance summary:", err);
    }
  }

  /* ---------- Recent Activity table ---------- */

  // Anyone checking in by this local hour or earlier counts as "On Time";
  // later than this is "Late". Adjust to match your actual office hours.
  const ON_TIME_CUTOFF_HOUR = 9;

  async function loadRecentActivity() {
    const tbody = els.activityTableBody;
    if (!tbody) return;

    try {
      const { data, error } = await window.supabaseClient
        .from("attendance")
        .select("work_date, check_in, check_out")
        .eq("staff_id", currentUser.id)
        .order("work_date", { ascending: false })
        .limit(7);

      if (error) throw error;

      const rows = data || [];

      if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#6b7280;">No attendance history yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = rows.map(renderActivityRow).join("");
    } catch (err) {
      console.error("[VSAS] Failed to load recent activity:", err);
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#6b7280;">Couldn't load recent activity.</td></tr>`;
    }
  }

  function renderActivityRow(row) {
    // work_date is a plain "YYYY-MM-DD"; parsing as local avoids the
    // off-by-one-day shift that `new Date("YYYY-MM-DD")` (UTC) can cause.
    const [y, m, d] = row.work_date.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);

    const checkIn = row.check_in ? new Date(row.check_in) : null;
    const checkOut = row.check_out ? new Date(row.check_out) : null;

    let statusLabel;
    let statusClass;
    if (!checkIn) {
      statusLabel = "Absent";
      statusClass = "table-status--absent";
    } else if (checkIn.getHours() <= ON_TIME_CUTOFF_HOUR) {
      statusLabel = "On Time";
      statusClass = "table-status--ontime";
    } else {
      statusLabel = "Late";
      statusClass = "table-status--late";
    }

    const hoursWorked = checkIn ? formatDuration((checkOut || new Date()) - checkIn) : "0h 00m";

    return `
      <tr>
        <td>${formatDateShort(dateObj)}</td>
        <td>${checkIn ? formatTimeShort(checkIn) : "\u2014\u2014"}</td>
        <td>${checkOut ? formatTimeShort(checkOut) : "\u2014\u2014"}</td>
        <td>${hoursWorked}</td>
        <td><span class="table-status ${statusClass}">${statusLabel}</span></td>
      </tr>`;
  }

  /* ---------- Init ---------- */

  function cacheEls() {
    els.greetingText = document.getElementById("greetingText");
    els.currentDateText = document.getElementById("currentDateText");
    els.miniClock = document.getElementById("miniClock");
    els.liveClock = document.getElementById("liveClock");
    els.liveClockDate = document.getElementById("liveClockDate");
    els.statusPill = document.getElementById("attendanceStatusPill");
    els.actionBtn = document.getElementById("attendanceActionBtn");
    els.checkInTime = document.getElementById("checkInTime");
    els.checkOutTime = document.getElementById("checkOutTime");
    els.hoursWorkedValue = document.getElementById("hoursWorkedValue");

    els.profilePhoto = document.getElementById("profilePhoto");
    els.profileName = document.getElementById("profileName");
    els.profileRole = document.getElementById("profileRole");
    els.profileDepartment = document.getElementById("profileDepartment");
    els.profileStaffId = document.getElementById("profileStaffId");
    els.profilePosition = document.getElementById("profilePosition");

    els.topAvatarCircle = document.getElementById("topAvatarCircle");
    els.topAvatarName = document.getElementById("topAvatarName");

    els.companyAttendanceValue = document.getElementById("companyAttendanceValue");
    els.daysPresentValue = document.getElementById("daysPresentValue");
    els.attendanceRateValue = document.getElementById("attendanceRateValue");

    els.activityTableBody = document.getElementById("activityTableBody");

    els.logoutLink = document.getElementById("logoutLink");
  }

  document.addEventListener("DOMContentLoaded", async () => {
    cacheEls();

    if (!els.actionBtn) return; // Not on the dashboard page

    // --- Auth guard: redirects to login.html if not signed in / inactive. ---
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
    tickClock();
    clockInterval = window.setInterval(tickClock, 1000);

    await loadTodayRecord();
    renderAttendanceState();
    updateHoursWorked();

    els.actionBtn.addEventListener("click", handleAttendanceAction);

    // These don't block the check-in button from becoming usable.
    loadPersonalStats();
    loadCompanyTodaySummary();
    loadRecentActivity();
  });

  // Clean up the interval if the page is being unloaded / navigated away.
  window.addEventListener("beforeunload", () => {
    if (clockInterval) window.clearInterval(clockInterval);
  });
})();