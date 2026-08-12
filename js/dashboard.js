/* =========================================================
   VSAS — dashboard.js
   Real, Supabase-backed check-in / check-out.

   Every write goes straight to the "attendance" table, so it's visible to
   Admin/HR/Manager/CEO on staff-management.html in real time via Supabase
   Realtime — no localStorage, no demo data, nothing device-specific.

   Depends on (must be loaded first, in this order):
     1. Supabase CDN            -> window.supabase
     2. jsPDF + jsPDF-AutoTable -> window.jspdf.jsPDF / doc.autoTable
     3. js/supabase.js          -> window.supabaseClient
     4. js/auth.js              -> window.VSASAuth (requireAuth, logout, etc.)
   ========================================================= */

(function () {
  "use strict";

  const els = {};
  let clockInterval = null;
  let currentUser = null; // Supabase auth user
  let currentProfile = null; // "profiles" row
  let todayRecord = null; // this user's "attendance" row for today, or null
  let isSubmitting = false; // guards against double-click race conditions on check-in/out
  let isExportingPdf = false; // guards against double-click race conditions on PDF export

  /* ---------- Date helpers ---------- */

  /**
   * Returns today's date as YYYY-MM-DD in the browser's local timezone.
   * Intentionally not `Date#toISOString()` (which is UTC-based) — this
   * must match the same local-date convention staff-management.js uses,
   * so both sides agree on which calendar day a check-in belongs to.
   */
  function todayDateString() {
    return toDateString(new Date());
  }

  function toDateString(d) {
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

  function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
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

    if (els.profilePhoto) {
      if (currentProfile.avatar_url) {
        els.profilePhoto.innerHTML = `<img src="${escapeHtml(currentProfile.avatar_url)}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
      } else {
        els.profilePhoto.textContent = initials;
      }
    }
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
      .eq("user_id", currentUser.id)
      .eq("attendance_date", todayDateString())
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
        // Upsert on (user_id, attendance_date): creates today's row on first
        // check-in, or safely no-ops/updates check_in if retried — it never
        // touches check_out since that column isn't part of this payload.
        const { error } = await window.supabaseClient
          .from("attendance")
          .upsert(
            { user_id: currentUser.id, attendance_date: todayDateString(), check_in: nowIso },
            { onConflict: "user_id,attendance_date" }
          );

        if (error) throw error;
      } else {
        if (!todayRecord?.id) throw new Error("No check-in found for today yet.");

        const { error } = await window.supabaseClient
          .from("attendance")
          .update({ check_out: nowIso })
          .eq("id", todayRecord.id);

        if (error) throw error;
      }

      // Re-fetch the real row from the database rather than trusting the
      // mutation's own return value. This is what makes the button state
      // self-correcting: whatever the DB actually has after the write is
      // what the UI shows next, so a quirky/empty write response can never
      // leave the button stuck showing the wrong action.
      await loadTodayRecord();

      renderAttendanceState();
      updateHoursWorked();
      await Promise.all([loadPersonalStats(), loadCompanyTodaySummary(), loadRecentActivity()]);
    } catch (err) {
      console.error("[VSAS] Attendance action failed:", err);
      alert(err.message || "Something went wrong. Please try again.");
      els.actionBtn.textContent = originalLabel;
      // Re-sync with whatever the database actually has, in case the write
      // partially succeeded (e.g. the check-in landed but the follow-up
      // read failed) — this avoids a permanently "stuck" button.
      await loadTodayRecord();
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
        .select("attendance_date, check_in")
        .eq("user_id", currentUser.id)
        .gte("attendance_date", firstOfMonthDateString())
        .lte("attendance_date", todayDateString());

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
        .select("attendance_date, check_in, check_out")
        .eq("user_id", currentUser.id)
        .order("attendance_date", { ascending: false })
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

  function attendanceStatusFor(checkIn) {
    if (!checkIn) return "Absent";
    return checkIn.getHours() <= ON_TIME_CUTOFF_HOUR ? "On Time" : "Late";
  }

  function renderActivityRow(row) {
    // attendance_date is a plain "YYYY-MM-DD"; parsing as local avoids the
    // off-by-one-day shift that `new Date("YYYY-MM-DD")` (UTC) can cause.
    const [y, m, d] = row.attendance_date.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);

    const checkIn = row.check_in ? new Date(row.check_in) : null;
    const checkOut = row.check_out ? new Date(row.check_out) : null;

    const statusLabel = attendanceStatusFor(checkIn);
    const statusClass =
      statusLabel === "Absent"
        ? "table-status--absent"
        : statusLabel === "On Time"
        ? "table-status--ontime"
        : "table-status--late";

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

  /* ---------- PDF Export ---------- */

  const PDF_PERIOD_LABELS = {
    "this-month": "This Month",
    "last-month": "Last Month",
    "last-3-months": "Last 3 Months",
    "all-time": "All Time",
  };

  /** Resolves a period key from the <select> into a concrete [start, end] date range. */
  function getPdfPeriodRange(periodKey) {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth(); // 0-indexed

    switch (periodKey) {
      case "last-month": {
        const start = new Date(y, m - 1, 1);
        const end = new Date(y, m, 0); // day 0 of this month = last day of previous month
        return { start: toDateString(start), end: toDateString(end) };
      }
      case "last-3-months": {
        const start = new Date(y, m - 2, 1);
        return { start: toDateString(start), end: toDateString(now) };
      }
      case "all-time":
        return { start: "1970-01-01", end: toDateString(now) };
      case "this-month":
      default: {
        const start = new Date(y, m, 1);
        return { start: toDateString(start), end: toDateString(now) };
      }
    }
  }

  function showPdfError(message) {
    if (!els.pdfErrorAlert) return;
    if (!message) {
      els.pdfErrorAlert.style.display = "none";
      els.pdfErrorAlert.textContent = "";
      return;
    }
    els.pdfErrorAlert.textContent = message;
    els.pdfErrorAlert.style.display = "block";
  }

  function sanitizeFilenamePart(value) {
    const cleaned = String(value || "")
      .trim()
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_+|_+$/g, "");
    return cleaned || "Staff";
  }

  function setPdfButtonLoading(isLoading) {
    if (!els.downloadPdfBtn) return;
    els.downloadPdfBtn.disabled = isLoading;
    els.downloadPdfBtn.classList.toggle("is-loading", isLoading);
  }

  /**
   * Click handler for "Download PDF". Reuses the exact same table/columns/
   * user_id filter that the already-working Recent Activity and personal
   * stats queries use — same staff <-> attendance relationship, same RLS,
   * no service-role key, no schema changes. A user can only ever fetch
   * rows where user_id == their own auth id.
   */
  async function handlePdfExport() {
    if (isExportingPdf) return;
    if (!currentUser) return;

    showPdfError(null);

    // A failed/blocked CDN load must only disable the PDF feature, never
    // the rest of the dashboard — which has already finished initializing
    // by the time this click can even happen.
    const jsPDFCtor = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDFCtor) {
      showPdfError("The PDF library didn't load. Please check your connection and try again.");
      return;
    }

    const periodKey = els.pdfPeriodSelect ? els.pdfPeriodSelect.value : "this-month";
    const periodLabel = PDF_PERIOD_LABELS[periodKey] || "This Month";
    const { start, end } = getPdfPeriodRange(periodKey);

    isExportingPdf = true;
    setPdfButtonLoading(true);

    try {
      const { data, error } = await window.supabaseClient
        .from("attendance")
        .select("attendance_date, check_in, check_out")
        .eq("user_id", currentUser.id)
        .gte("attendance_date", start)
        .lte("attendance_date", end)
        .order("attendance_date", { ascending: true });

      if (error) throw error;

      generateAttendancePdf(data || [], { periodLabel, start, end });
    } catch (err) {
      console.error("[VSAS] PDF export failed:", err);
      showPdfError(err.message || "Couldn't generate the PDF. Please try again.");
    } finally {
      isExportingPdf = false;
      setPdfButtonLoading(false);
    }
  }

  /** Builds and downloads the PDF from already-fetched attendance rows. */
  function generateAttendancePdf(rows, { periodLabel, start, end }) {
    const jsPDFCtor = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDFCtor) throw new Error("The PDF library is not available.");

    const doc = new jsPDFCtor({ unit: "pt", format: "a4" });
    if (typeof doc.autoTable !== "function") {
      throw new Error("The PDF table library is not available.");
    }

    const fullName = `${currentProfile?.first_name || ""} ${currentProfile?.last_name || ""}`.trim() || "Staff Member";

    // --- Summary calculations (from the real fetched rows) ---
    const totalDays = rows.length;
    const presentRows = rows.filter((r) => r.check_in);
    const daysPresent = presentRows.length;
    const attendanceRate = totalDays > 0 ? Math.round((daysPresent / totalDays) * 100) : 0;

    let totalMs = 0;
    presentRows.forEach((r) => {
      const checkIn = new Date(r.check_in);
      const checkOut = r.check_out ? new Date(r.check_out) : checkIn;
      totalMs += Math.max(0, checkOut - checkIn);
    });
    const totalHoursLabel = formatDuration(totalMs);
    const avgHoursLabel = daysPresent > 0 ? formatDuration(totalMs / daysPresent) : "0h 00m";

    // --- Header ---
    doc.setFontSize(16);
    doc.setFont(undefined, "bold");
    doc.text("Visual Vertex Technology Company", 40, 50);

    doc.setFontSize(12);
    doc.setFont(undefined, "normal");
    doc.text("Staff Attendance Report", 40, 68);

    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Report period: ${periodLabel} (${start} to ${end})`, 40, 84);
    doc.text(`Generated on: ${formatDateLong(new Date())}`, 40, 98);
    doc.setTextColor(0);

    // --- Staff information ---
    let y = 124;
    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.text("Staff Information", 40, y);
    doc.setFont(undefined, "normal");
    doc.setFontSize(10);

    y += 16;
    doc.text(`Staff Name: ${fullName}`, 40, y);
    y += 14;
    doc.text(`Staff ID: ${currentProfile?.staff_id || "\u2014"}`, 40, y);
    y += 14;
    doc.text(`Department: ${currentProfile?.department || "\u2014"}`, 40, y);
    y += 14;
    doc.text(`Position: ${currentProfile?.position || "\u2014"}`, 40, y);

    // --- Attendance summary ---
    y += 24;
    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.text("Attendance Summary", 40, y);
    doc.setFont(undefined, "normal");
    doc.setFontSize(10);

    y += 16;
    doc.text(`Total Attendance Days: ${totalDays}`, 40, y);
    y += 14;
    doc.text(`Days Present: ${daysPresent}`, 40, y);
    y += 14;
    doc.text(`Attendance Rate: ${attendanceRate}%`, 40, y);
    y += 14;
    doc.text(`Total Hours Worked: ${totalHoursLabel}`, 40, y);
    y += 14;
    doc.text(`Average Hours Worked: ${avgHoursLabel}`, 40, y);

    // --- Attendance table ---
    const tableRows = rows.map((r) => {
      const [yy, mm, dd] = r.attendance_date.split("-").map(Number);
      const dateObj = new Date(yy, mm - 1, dd);
      const checkIn = r.check_in ? new Date(r.check_in) : null;
      const checkOut = r.check_out ? new Date(r.check_out) : null;
      const status = attendanceStatusFor(checkIn);
      const hours = checkIn ? formatDuration((checkOut || checkIn) - checkIn) : "0h 00m";

      return [
        formatDateShort(dateObj),
        checkIn ? formatTimeShort(checkIn) : "\u2014\u2014",
        checkOut ? formatTimeShort(checkOut) : "\u2014\u2014",
        hours,
        status,
      ];
    });

    doc.autoTable({
      startY: y + 20,
      head: [["Date", "Check In", "Check Out", "Hours Worked", "Status"]],
      body: tableRows.length ? tableRows : [["No records", "\u2014", "\u2014", "\u2014", "\u2014"]],
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255 },
      margin: { left: 40, right: 40 },
    });

    const safeName = sanitizeFilenamePart(fullName);
    doc.save(`Attendance_Report_${safeName}_${start}_to_${end}.pdf`);
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

    els.downloadPdfBtn = document.getElementById("downloadPdfBtn");
    els.pdfPeriodSelect = document.getElementById("pdfPeriodSelect");
    els.pdfErrorAlert = document.getElementById("pdfErrorAlert");

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

    // The PDF feature is wired up defensively: a problem here must never
    // stop the core attendance flow (stats + Recent Activity) below from
    // loading. This is exactly the bug that was happening before — an
    // undefined `handlePdfExport` threw here and killed everything after it.
    try {
      if (els.downloadPdfBtn) {
        els.downloadPdfBtn.addEventListener("click", handlePdfExport);
      }
    } catch (err) {
      console.error("[VSAS] Failed to initialize PDF export:", err);
      showPdfError("PDF export is currently unavailable.");
    }

    // These don't block the check-in button from becoming usable, and a
    // failure in any one of them doesn't stop the others.
    loadPersonalStats();
    loadCompanyTodaySummary();
    loadRecentActivity();
  });

  // Clean up the interval if the page is being unloaded / navigated away.
  window.addEventListener("beforeunload", () => {
    if (clockInterval) window.clearInterval(clockInterval);
  });
})();