/* =========================================================
   VSAS — attendance.js
   Logic for the dedicated staff attendance page.

   Reuses core logic and helpers from dashboard.js for consistency in
   check-in/out actions, stats calculation, and PDF generation.

   Depends on (must be loaded first, in this order):
     1. Supabase CDN            -> window.supabase
     2. jsPDF + jsPDF-AutoTable -> window.jspdf.jsPDF / doc.autoTable
     3. js/supabase.js          -> window.supabaseClient
     4. js/auth.js              -> window.VSASAuth (requireAuth, etc.)
     5. js/main.js              -> Shared UI (sidebar, notifications)
   ========================================================= */

(function () {
  "use strict";

  const els = {};
  let clockInterval = null;
  let currentUser = null;
  let currentProfile = null;
  let todayRecord = null;
  let isSubmitting = false;
  let isExportingPdf = false;

  const ON_TIME_CUTOFF_HOUR = 9;

  /* ---------- Date & Formatting Helpers (reused from dashboard.js) ---------- */

  function toDateString(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function getPeriodRange(periodKey) {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    switch (periodKey) {
      case "last-month": {
        const start = new Date(y, m - 1, 1);
        const end = new Date(y, m, 0);
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

  function formatTime(date) {
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
  }

  function formatTimeShort(date) {
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  }

  function formatDateLong(date) {
    return date.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
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
    return (name || "").split(" ").filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");
  }

  /* ---------- Live Clock & Profile Rendering ---------- */

  function tickClock() {
    const now = new Date();
    if (els.liveClock) els.liveClock.textContent = formatTime(now);
    if (els.liveClockDate) els.liveClockDate.textContent = formatDateLong(now);
    if (els.currentDateText) els.currentDateText.textContent = formatDateLong(now);
  }

  function renderProfile() {
    if (!currentProfile) return;
    const fullName = `${currentProfile.first_name || ""} ${currentProfile.last_name || ""}`.trim() || "Staff Member";
    const initials = getInitials(fullName);
    if (els.topAvatarCircle) els.topAvatarCircle.textContent = initials;
    if (els.topAvatarName) els.topAvatarName.textContent = fullName;
  }

  /* ---------- Today's Attendance Card ---------- */

  async function loadTodayRecord() {
    const { data, error } = await window.supabaseClient
      .from("attendance")
      .select("id, check_in, check_out")
      .eq("user_id", currentUser.id)
      .eq("attendance_date", toDateString(new Date()))
      .maybeSingle();

    if (error) {
      console.error("[VSAS] Failed to load today's attendance:", error);
      todayRecord = null;
    } else {
      todayRecord = data || null;
    }
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
    } else {
      pill.textContent = "Checked Out";
      pill.className = "status-pill status-pill--checked-out";
      btn.textContent = "Checked Out for Today";
      btn.dataset.action = "done";
      btn.disabled = true;
      els.checkOutTime.textContent = formatTimeShort(new Date(todayRecord.check_out));
    }
  }

  async function handleAttendanceAction() {
    if (isSubmitting) return;
    const action = els.actionBtn.dataset.action;
    if (action !== "check-in" && action !== "check-out") return;

    isSubmitting = true;
    els.actionBtn.disabled = true;
    els.actionBtn.textContent = action === "check-in" ? "Checking in…" : "Checking out…";

    try {
      const nowIso = new Date().toISOString();
      if (action === "check-in") {
        const { error } = await window.supabaseClient
          .from("attendance")
          .upsert({ user_id: currentUser.id, attendance_date: toDateString(new Date()), check_in: nowIso }, { onConflict: "user_id,attendance_date" });
        if (error) throw error;
      } else {
        if (!todayRecord?.id) throw new Error("No check-in found for today yet.");
        const { error } = await window.supabaseClient.from("attendance").update({ check_out: nowIso }).eq("id", todayRecord.id);
        if (error) throw error;
      }

      await loadTodayRecord();
      renderAttendanceState();
      await Promise.all([loadAttendanceHistory(), loadOverviewStats()]);
    } catch (err) {
      console.error("[VSAS] Attendance action failed:", err);
      alert(err.message || "Something went wrong. Please try again.");
      await loadTodayRecord();
    } finally {
      isSubmitting = false;
      renderAttendanceState();
    }
  }

  /* ---------- Attendance History & Stats ---------- */

  async function loadAttendanceHistory() {
    const tbody = els.activityTableBody;
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#6b7280;">Loading...</td></tr>`;

    const periodKey = els.historyPeriodSelect.value;
    const { start, end } = getPeriodRange(periodKey);

    try {
      const { data, error } = await window.supabaseClient
        .from("attendance")
        .select("attendance_date, check_in, check_out")
        .eq("user_id", currentUser.id)
        .gte("attendance_date", start)
        .lte("attendance_date", end)
        .order("attendance_date", { ascending: false });

      if (error) throw error;

      const rows = data || [];
      if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#6b7280;">No attendance history for this period.</td></tr>`;
        return;
      }

      tbody.innerHTML = rows.map(renderActivityRow).join("");
    } catch (err) {
      console.error("[VSAS] Failed to load attendance history:", err);
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#dc2626;">Could not load history.</td></tr>`;
    }
  }

  function attendanceStatusFor(checkIn) {
    if (!checkIn) return "Absent";
    return new Date(checkIn).getHours() < ON_TIME_CUTOFF_HOUR ? "On Time" : "Late";
  }

  function renderActivityRow(row) {
    const [y, m, d] = row.attendance_date.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    const checkIn = row.check_in ? new Date(row.check_in) : null;
    const checkOut = row.check_out ? new Date(row.check_out) : null;
    const statusLabel = attendanceStatusFor(row.check_in);
    const statusClass = statusLabel === "On Time" ? "table-status--ontime" : "table-status--late";
    const hoursWorked = checkIn && checkOut ? formatDuration(checkOut - checkIn) : "—";

    return `
      <tr>
        <td>${formatDateShort(dateObj)}</td>
        <td>${checkIn ? formatTimeShort(checkIn) : "—"}</td>
        <td>${checkOut ? formatTimeShort(checkOut) : "—"}</td>
        <td>${hoursWorked}</td>
        <td><span class="table-status ${statusClass}">${statusLabel}</span></td>
      </tr>`;
  }

  async function loadOverviewStats() {
    const { start, end } = getPeriodRange("this-month");
    try {
      const { data, error } = await window.supabaseClient
        .from("attendance")
        .select("attendance_date, check_in, check_out")
        .eq("user_id", currentUser.id)
        .gte("attendance_date", start)
        .lte("attendance_date", end);

      if (error) throw error;

      const rows = data || [];
      const presentRows = rows.filter(r => r.check_in);
      const daysPresent = presentRows.length;
      const daysElapsed = new Date().getDate();
      const attendanceRate = daysElapsed > 0 ? Math.round((daysPresent / daysElapsed) * 100) : 0;

      let totalMs = 0;
      presentRows.forEach(r => {
        if (r.check_in && r.check_out) {
          totalMs += new Date(r.check_out) - new Date(r.check_in);
        }
      });

      els.daysPresentValue.textContent = daysPresent;
      els.attendanceRateValue.textContent = `${attendanceRate}%`;
      els.totalHoursValue.textContent = formatDuration(totalMs);
      els.avgHoursValue.textContent = daysPresent > 0 ? formatDuration(totalMs / daysPresent) : "0h 0m";
    } catch (err) {
      console.error("[VSAS] Failed to load overview stats:", err);
    }
  }

  /* ---------- PDF Export ---------- */

  function showPdfError(message) {
    if (!els.pdfErrorAlert) return;
    els.pdfErrorAlert.style.display = message ? "block" : "none";
    els.pdfErrorAlert.textContent = message || "";
  }

  function setPdfButtonLoading(isLoading) {
    if (!els.downloadPdfBtn) return;
    els.downloadPdfBtn.disabled = isLoading;
    els.downloadPdfBtn.classList.toggle("is-loading", isLoading);
  }

  async function handlePdfExport() {
    if (isExportingPdf || !currentUser) return;
    showPdfError(null);

    const jsPDFCtor = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDFCtor || typeof jsPDFCtor.prototype.autoTable !== "function") {
      showPdfError("PDF library is not available. Please check your connection.");
      return;
    }

    const periodKey = els.historyPeriodSelect.value;
    const { start, end } = getPeriodRange(periodKey);

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

      // This reuses the exact PDF generation logic from dashboard.js,
      // which is not included here to avoid duplication. We assume a
      // global function or will need to import it if modularized.
      // For now, we'll just call a placeholder.
      // In a real refactor, this would be a shared utility.
      if (window.generateAttendancePdf) {
        window.generateAttendancePdf(data || [], { periodLabel: periodKey, start, end }, currentProfile);
      } else {
        // Since dashboard.js is not loaded, we must include the PDF logic here.
        // This is a simplified copy.
        const doc = new jsPDFCtor();
        const fullName = `${currentProfile.first_name} ${currentProfile.last_name}`;
        doc.text(`Attendance Report for ${fullName}`, 20, 20);
        doc.autoTable({
            head: [['Date', 'Check In', 'Check Out', 'Hours', 'Status']],
            body: (data || []).map(r => {
                const checkIn = r.check_in ? new Date(r.check_in) : null;
                const checkOut = r.check_out ? new Date(r.check_out) : null;
                return [
                    r.attendance_date,
                    checkIn ? formatTimeShort(checkIn) : '—',
                    checkOut ? formatTimeShort(checkOut) : '—',
                    checkIn && checkOut ? formatDuration(checkOut - checkIn) : '—',
                    attendanceStatusFor(r.check_in)
                ];
            }),
            startY: 30,
        });
        doc.save(`Attendance_${fullName}_${start}_to_${end}.pdf`);
      }

    } catch (err) {
      console.error("[VSAS] PDF export failed:", err);
      showPdfError(err.message || "Could not generate the PDF.");
    } finally {
      isExportingPdf = false;
      setPdfButtonLoading(false);
    }
  }

  /* ---------- Init ---------- */

  function cacheEls() {
    els.topAvatarCircle = document.getElementById("topAvatarCircle");
    els.topAvatarName = document.getElementById("topAvatarName");
    els.currentDateText = document.getElementById("currentDateText");
    els.liveClock = document.getElementById("liveClock");
    els.liveClockDate = document.getElementById("liveClockDate");
    els.statusPill = document.getElementById("attendanceStatusPill");
    els.actionBtn = document.getElementById("attendanceActionBtn");
    els.checkInTime = document.getElementById("checkInTime");
    els.checkOutTime = document.getElementById("checkOutTime");
    els.daysPresentValue = document.getElementById("daysPresentValue");
    els.attendanceRateValue = document.getElementById("attendanceRateValue");
    els.totalHoursValue = document.getElementById("totalHoursValue");
    els.avgHoursValue = document.getElementById("avgHoursValue");
    els.activityTableBody = document.getElementById("activityTableBody");
    els.historyPeriodSelect = document.getElementById("historyPeriodSelect");
    els.downloadPdfBtn = document.getElementById("downloadPdfBtn");
    els.pdfErrorAlert = document.getElementById("pdfErrorAlert");
    els.logoutLink = document.getElementById("logoutLink");
  }

  document.addEventListener("DOMContentLoaded", async () => {
    cacheEls();

    const auth = await window.VSASAuth.requireAuth();
    if (!auth) return;

    currentUser = auth.user;
    currentProfile = auth.profile;

    if (els.logoutLink) {
      els.logoutLink.addEventListener("click", (e) => { e.preventDefault(); window.VSASAuth.logout(); });
    }

    renderProfile();
    tickClock();
    clockInterval = window.setInterval(tickClock, 1000);

    await loadTodayRecord();
    renderAttendanceState();

    els.actionBtn.addEventListener("click", handleAttendanceAction);
    els.historyPeriodSelect.addEventListener("change", loadAttendanceHistory);
    els.downloadPdfBtn.addEventListener("click", handlePdfExport);

    loadAttendanceHistory();
    loadOverviewStats();
  });

  window.addEventListener("beforeunload", () => {
    if (clockInterval) window.clearInterval(clockInterval);
  });
})();