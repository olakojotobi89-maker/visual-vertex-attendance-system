/* =========================================================
   VSAS — Phase 2
   dashboard.js
   Demo-only attendance logic, persisted to localStorage so
   the Check In / Check Out state survives a page refresh.
   Replace the storage layer with real API calls
   (POST /api/attendance/check-in, /check-out) once the
   Node.js + Express backend exists — the DOM update logic
   below can stay as-is.
   ========================================================= */

(function () {
  "use strict";

  var STORAGE_KEY = "vsas_demo_attendance";
  var STAFF_NAME = "Amaka"; // Demo value — replace with the authenticated user's first name.

  var els = {};
  var clockInterval = null;

  /* ---------- Storage helpers ---------- */

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }

  function readTodayRecord() {
    try {
      var all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return all[todayKey()] || null;
    } catch (e) {
      return null;
    }
  }

  function writeTodayRecord(record) {
    try {
      var all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      all[todayKey()] = record;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch (e) {
      /* localStorage unavailable — demo state just won't persist */
    }
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

  function formatDuration(ms) {
    var totalMinutes = Math.max(0, Math.floor(ms / 60000));
    var hours = Math.floor(totalMinutes / 60);
    var minutes = totalMinutes % 60;
    return hours + "h " + String(minutes).padStart(2, "0") + "m";
  }

  /* ---------- Greeting ---------- */

  function greetingForHour(hour) {
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  }

  function updateGreeting() {
    var now = new Date();
    if (els.greetingText) {
      els.greetingText.textContent = greetingForHour(now.getHours()) + ", " + STAFF_NAME;
    }
  }

  /* ---------- Live clock ---------- */

  function tickClock() {
    var now = new Date();

    if (els.liveClock) els.liveClock.textContent = formatTime(now);
    if (els.liveClockDate) els.liveClockDate.textContent = formatDateLong(now);
    if (els.currentDateText) els.currentDateText.textContent = formatDateLong(now);
    if (els.miniClock) els.miniClock.textContent = formatTimeShort(now);

    updateHoursWorked();
  }

  /* ---------- Attendance state rendering ---------- */

  function renderAttendanceState() {
    var record = readTodayRecord();
    var pill = els.statusPill;
    var btn = els.actionBtn;

    if (!record || !record.checkIn) {
      pill.textContent = "Not Checked In";
      pill.className = "status-pill status-pill--not-checked-in";
      btn.textContent = "Check In";
      btn.dataset.action = "check-in";
      btn.disabled = false;
      els.checkInTime.textContent = "\u2014\u2014";
      els.checkOutTime.textContent = "\u2014\u2014";
      return;
    }

    els.checkInTime.textContent = formatTimeShort(new Date(record.checkIn));

    if (!record.checkOut) {
      pill.textContent = "Checked In";
      pill.className = "status-pill status-pill--checked-in";
      btn.textContent = "Check Out";
      btn.dataset.action = "check-out";
      btn.disabled = false;
      els.checkOutTime.textContent = "\u2014\u2014";
      return;
    }

    pill.textContent = "Checked Out";
    pill.className = "status-pill status-pill--checked-out";
    btn.textContent = "Checked Out for Today";
    btn.dataset.action = "done";
    btn.disabled = true;
    els.checkOutTime.textContent = formatTimeShort(new Date(record.checkOut));
  }

  function updateHoursWorked() {
    if (!els.hoursWorkedValue) return;
    var record = readTodayRecord();

    if (!record || !record.checkIn) {
      els.hoursWorkedValue.textContent = "0h 00m";
      return;
    }

    var end = record.checkOut ? new Date(record.checkOut) : new Date();
    var diff = end - new Date(record.checkIn);
    els.hoursWorkedValue.textContent = formatDuration(diff);
  }

  /* ---------- Check In / Check Out ---------- */

  function handleAttendanceAction() {
    var action = els.actionBtn.dataset.action;
    var record = readTodayRecord() || {};
    var now = new Date().toISOString();

    if (action === "check-in") {
      record.checkIn = now;
      writeTodayRecord(record);
    } else if (action === "check-out") {
      record.checkOut = now;
      writeTodayRecord(record);
    } else {
      return;
    }

    renderAttendanceState();
    updateHoursWorked();
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
  }

  document.addEventListener("DOMContentLoaded", function () {
    cacheEls();

    if (!els.actionBtn) return; // Not on the dashboard page

    updateGreeting();
    renderAttendanceState();
    tickClock();

    clockInterval = window.setInterval(tickClock, 1000);

    els.actionBtn.addEventListener("click", handleAttendanceAction);
  });

  // Clean up the interval if the page is being unloaded / navigated away.
  window.addEventListener("beforeunload", function () {
    if (clockInterval) window.clearInterval(clockInterval);
  });
})();