/**
 * staff-management.js
 * -----------------------------------------------------------------------
 * Logic for the Admin Dashboard "Staff Management" page.
 *
 * Depends on (must be loaded first, in this order):
 *   1. Supabase CDN            -> window.supabase
 *   2. js/supabase.js          -> window.supabaseClient
 *   3. js/auth.js              -> window.VSASAuth (requireAuth, logout, etc.)
 *
 * Staff creation calls the "create-staff" Supabase Edge Function, which is
 * the only place the Service Role Key is used. The browser never sees it.
 * -----------------------------------------------------------------------
 */

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

const state = {
  currentAdmin: null, // { user, profile }
  allStaff: [], // raw rows from "profiles"
  departments: [], // raw rows from "departments"
  attendanceToday: [], // raw rows from "attendance" for today's date
  visibleStaff: [], // after search + filter + sort, before pagination
  page: 1,
  pageSize: 10,
  search: "",
  filters: { department: "", position: "", status: "" },
  sortBy: "name_asc",
  isLoading: true,
};

const PAGE_SIZE = 10;

// Matches ROLE_REDIRECTS in auth.js: everyone routed to this page by login
// must actually be allowed to stay on it, or they'd bounce straight back
// here in an infinite redirect loop.
const ALLOWED_ROLES = new Set(["admin", "hr", "manager", "ceo"]);

let attendanceChannel = null;

/* ------------------------------------------------------------------ */
/* Bootstrap                                                           */
/* ------------------------------------------------------------------ */

document.addEventListener("DOMContentLoaded", init);

async function init() {
  // --- Access control: only Admin/HR/Manager/CEO may see this page. ---
  const auth = await window.VSASAuth.requireAuth();
  if (!auth) return; // requireAuth() already redirected to login.html

  const role = (auth.profile.role || "").toLowerCase();
  if (!ALLOWED_ROLES.has(role)) {
    window.VSASAuth.redirectByRole(auth.profile.role);
    return;
  }

  state.currentAdmin = auth;
  renderAdminHeader(auth.profile);

  wireLayoutEvents();
  wireToolbarEvents();
  wireModalEvents();

  await Promise.all([loadDepartments(), loadStaff()]);
  await loadAttendanceToday();
  subscribeAttendanceRealtime();
}

/** Unsubscribe the realtime channel if the page is closed/navigated away. */
window.addEventListener("beforeunload", () => {
  if (attendanceChannel) {
    window.supabaseClient.removeChannel(attendanceChannel);
  }
});

/** Fills in the header's admin name/avatar/role. */
function renderAdminHeader(profile) {
  const nameEl = document.getElementById("adminName");
  const roleEl = document.getElementById("adminRole");
  const avatarEl = document.getElementById("adminAvatar");

  const fullName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Admin";
  nameEl.textContent = fullName;
  roleEl.textContent = profile.role || "";

  if (profile.avatar_url) {
    avatarEl.innerHTML = `<img src="${escapeHtml(profile.avatar_url)}" alt="${escapeHtml(fullName)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
  } else {
    avatarEl.textContent = getInitials(fullName);
  }
}

/* ------------------------------------------------------------------ */
/* Layout: sidebar collapse, mobile toggle, logout                     */
/* ------------------------------------------------------------------ */

function wireLayoutEvents() {
  const shell = document.getElementById("dashboardShell");
  const sidebar = document.getElementById("sidebar");
  const toggleBtn = document.getElementById("sidebarToggle");

  toggleBtn.addEventListener("click", () => {
    // Narrow viewports: slide the sidebar in/out as an overlay.
    if (window.innerWidth <= 720) {
      sidebar.classList.toggle("is-open");
      return;
    }
    // Wider viewports: collapse to icon-only rail.
    shell.classList.toggle("is-collapsed");
    shell.classList.toggle("is-expanded");
  });

  document.getElementById("logoutBtn").addEventListener("click", logout);
  document.getElementById("sidebarLogout").addEventListener("click", (event) => {
    event.preventDefault();
    logout();
  });
}

/** Signs the admin out via the shared auth module. */
async function logout() {
  await window.VSASAuth.logout();
}

/* ------------------------------------------------------------------ */
/* Data loading                                                        */
/* ------------------------------------------------------------------ */

/** Loads every employee from the "profiles" table. */
async function loadStaff() {
  state.isLoading = true;
  renderStaff();

  try {
    const { data, error } = await window.supabaseClient
      .from("profiles")
      .select(
        "id, staff_id, first_name, last_name, email, phone, department, position, role, is_active, avatar_url, created_at"
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    state.allStaff = data || [];
  } catch (err) {
    console.error("[VSAS] Failed to load staff:", err);
    state.allStaff = [];
  } finally {
    state.isLoading = false;
    applyPipeline();
    renderStats();
  }
}

/** Loads the department list from "departments" for filters and the modal. */
async function loadDepartments() {
  try {
    const { data, error } = await window.supabaseClient
      .from("departments")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) throw error;

    state.departments = data || [];

    // Surface the "table is empty" case loudly instead of leaving the
    // Department dropdown mysteriously blank with no explanation.
    if (state.departments.length === 0) {
      showToast(
        "No departments found. Add at least one department before adding staff.",
        "error"
      );
    }
  } catch (err) {
    console.error("[VSAS] Failed to load departments:", err);
    state.departments = [];
    // This branch means the query itself errored (network or RLS denial),
    // as opposed to succeeding with zero rows — worth telling the user
    // since the fix (RLS policy vs. empty table) is completely different.
    showToast(
      "Could not load departments (permissions or connection issue). Check the console for details.",
      "error"
    );
  }

  populateDepartmentOptions();
}

function populateDepartmentOptions() {
  const filterSelect = document.getElementById("filterDepartment");
  const modalSelect = document.getElementById("newDepartment");

  const filterOptions = state.departments
    .map((d) => `<option value="${escapeHtml(d.name)}">${escapeHtml(d.name)}</option>`)
    .join("");
  filterSelect.innerHTML = `<option value="">All Departments</option>${filterOptions}`;

  const modalOptions = state.departments
    .map((d) => `<option value="${escapeHtml(d.name)}">${escapeHtml(d.name)}</option>`)
    .join("");
  modalSelect.innerHTML = `<option value="">Select department</option>${modalOptions}`;
}

/* ------------------------------------------------------------------ */
/* Stats cards                                                         */
/* ------------------------------------------------------------------ */

function renderStats() {
  const total = state.allStaff.length;
  const active = state.allStaff.filter((s) => s.is_active !== false).length;
  const inactive = total - active;
  const deptCount = state.departments.length;

  setStat("statTotal", total);
  setStat("statActive", active);
  setStat("statInactive", inactive);
  setStat("statDepartments", deptCount);

  // Staff additions/removals change who should appear on the attendance
  // roster, so keep that table in lockstep with the staff list.
  renderAttendanceTable();
}

function setStat(id, value) {
  const el = document.getElementById(id);
  el.classList.remove("is-loading");
  el.textContent = value;
}

/* ------------------------------------------------------------------ */
/* Search + filter + sort pipeline                                     */
/* ------------------------------------------------------------------ */

/** Filters `list` down to rows matching the current search term. */
function searchStaff(list, query) {
  const q = query.trim().toLowerCase();
  if (!q) return list;

  return list.filter((s) => {
    const haystack = [s.first_name, s.last_name, s.staff_id, s.email]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

/** Applies department / position / status filters to `list`. */
function filterStaff(list, filters) {
  return list.filter((s) => {
    if (filters.department && s.department !== filters.department) return false;
    if (filters.position && s.position !== filters.position) return false;
    if (filters.status === "active" && s.is_active === false) return false;
    if (filters.status === "inactive" && s.is_active !== false) return false;
    return true;
  });
}

/** Returns a new sorted copy of `list` according to `sortKey`. */
function sortStaff(list, sortKey) {
  const sorted = [...list];
  const fullName = (s) => `${s.first_name || ""} ${s.last_name || ""}`.trim().toLowerCase();

  switch (sortKey) {
    case "name_desc":
      sorted.sort((a, b) => fullName(b).localeCompare(fullName(a)));
      break;
    case "created_desc":
      sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      break;
    case "created_asc":
      sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      break;
    case "department_asc":
      sorted.sort((a, b) => (a.department || "").localeCompare(b.department || ""));
      break;
    case "name_asc":
    default:
      sorted.sort((a, b) => fullName(a).localeCompare(fullName(b)));
  }
  return sorted;
}

/** Recomputes `state.visibleStaff` from the raw list + current search/filters/sort. */
function applyPipeline() {
  let list = state.allStaff;
  list = searchStaff(list, state.search);
  list = filterStaff(list, state.filters);
  list = sortStaff(list, state.sortBy);

  state.visibleStaff = list;
  state.page = 1;
  renderStaff();
}

/* ------------------------------------------------------------------ */
/* Toolbar wiring                                                      */
/* ------------------------------------------------------------------ */

function wireToolbarEvents() {
  let searchDebounce;
  document.getElementById("searchInput").addEventListener("input", (event) => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      state.search = event.target.value;
      applyPipeline();
    }, 250);
  });

  document.getElementById("filterDepartment").addEventListener("change", (event) => {
    state.filters.department = event.target.value;
    applyPipeline();
  });

  document.getElementById("filterPosition").addEventListener("change", (event) => {
    state.filters.position = event.target.value;
    applyPipeline();
  });

  document.getElementById("filterStatus").addEventListener("change", (event) => {
    state.filters.status = event.target.value;
    applyPipeline();
  });

  document.getElementById("sortBy").addEventListener("change", (event) => {
    state.sortBy = event.target.value;
    applyPipeline();
  });
}

/** Rebuilds the "Filter by Position" options from whatever positions currently exist. */
function populatePositionOptions() {
  const select = document.getElementById("filterPosition");
  const current = select.value;
  const positions = [...new Set(state.allStaff.map((s) => s.position).filter(Boolean))].sort();

  select.innerHTML =
    `<option value="">All Positions</option>` +
    positions.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("");
  select.value = current;
}

/* ------------------------------------------------------------------ */
/* Table rendering                                                     */
/* ------------------------------------------------------------------ */

function renderStaff() {
  const tbody = document.getElementById("staffTableBody");
  const emptyState = document.getElementById("emptyState");
  const noResultsState = document.getElementById("noResultsState");
  const pagination = document.getElementById("pagination");

  if (state.isLoading) {
    tbody.innerHTML = renderSkeletonRows(PAGE_SIZE);
    emptyState.classList.remove("is-visible");
    noResultsState.classList.remove("is-visible");
    pagination.style.display = "none";
    return;
  }

  populatePositionOptions();

  // Nothing in the system at all.
  if (state.allStaff.length === 0) {
    tbody.innerHTML = "";
    emptyState.classList.add("is-visible");
    noResultsState.classList.remove("is-visible");
    pagination.style.display = "none";
    return;
  }

  // Search/filters returned nothing.
  if (state.visibleStaff.length === 0) {
    tbody.innerHTML = "";
    emptyState.classList.remove("is-visible");
    noResultsState.classList.add("is-visible");
    pagination.style.display = "none";
    return;
  }

  emptyState.classList.remove("is-visible");
  noResultsState.classList.remove("is-visible");
  pagination.style.display = "flex";

  const totalPages = Math.max(1, Math.ceil(state.visibleStaff.length / state.pageSize));
  state.page = Math.min(state.page, totalPages);

  const start = (state.page - 1) * state.pageSize;
  const pageRows = state.visibleStaff.slice(start, start + state.pageSize);

  tbody.innerHTML = pageRows.map(renderStaffRow).join("");
  wireRowActionEvents();
  renderPagination(totalPages);
}

function renderSkeletonRows(count) {
  const cols = 10;
  const row = `<tr>${Array.from({ length: cols }, () => `<td><span class="skeleton-cell"></span></td>`).join("")}</tr>`;
  return row.repeat(count);
}

function renderStaffRow(staff) {
  const fullName = `${staff.first_name || ""} ${staff.last_name || ""}`.trim() || "—";
  const isActive = staff.is_active !== false;
  const createdDate = staff.created_at
    ? new Date(staff.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : "—";

  const avatar = staff.avatar_url
    ? `<img class="staff-avatar" src="${escapeHtml(staff.avatar_url)}" alt="">`
    : `<div class="staff-avatar">${escapeHtml(getInitials(fullName))}</div>`;

  return `
    <tr data-id="${escapeHtml(staff.id)}">
      <td>
        <div class="staff-person">
          ${avatar}
          <span class="staff-name">${escapeHtml(fullName)}</span>
        </div>
      </td>
      <td>${escapeHtml(staff.staff_id || "—")}</td>
      <td class="staff-email-cell">${escapeHtml(staff.email || "—")}</td>
      <td>${escapeHtml(staff.phone || "—")}</td>
      <td>${escapeHtml(staff.department || "—")}</td>
      <td>${escapeHtml(staff.position || "—")}</td>
      <td><span class="badge badge--role">${escapeHtml(staff.role || "—")}</span></td>
      <td>
        <span class="badge ${isActive ? "badge--active" : "badge--inactive"}">
          ${isActive ? "Active" : "Inactive"}
        </span>
      </td>
      <td>${createdDate}</td>
      <td>
        <div class="row-actions">
          <button type="button" class="row-action-btn" data-action="view" aria-label="View ${escapeHtml(fullName)}" title="View">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button type="button" class="row-action-btn" data-action="edit" aria-label="Edit ${escapeHtml(fullName)}" title="Edit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button type="button" class="row-action-btn" data-action="reset-password" aria-label="Reset password for ${escapeHtml(fullName)}" title="Reset Password">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke-linecap="round"/></svg>
          </button>
          <button type="button" class="row-action-btn" data-action="toggle-status" aria-label="${isActive ? "Deactivate" : "Activate"} ${escapeHtml(fullName)}" title="${isActive ? "Deactivate" : "Activate"}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button type="button" class="row-action-btn is-danger" data-action="delete" aria-label="Delete ${escapeHtml(fullName)}" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
}

function wireRowActionEvents() {
  document.querySelectorAll("#staffTableBody tr").forEach((row) => {
    const id = row.dataset.id;
    const staff = state.allStaff.find((s) => s.id === id);
    if (!staff) return;

    row.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => handleRowAction(btn.dataset.action, staff));
    });
  });
}

function handleRowAction(action, staff) {
  switch (action) {
    case "view":
      viewStaff(staff);
      break;
    case "edit":
      editStaff(staff);
      break;
    case "reset-password":
      resetStaffPassword(staff);
      break;
    case "toggle-status":
      toggleStaffStatus(staff);
      break;
    case "delete":
      deleteStaff(staff);
      break;
  }
}

/* ------------------------------------------------------------------ */
/* Row actions                                                         */
/* ------------------------------------------------------------------ */

// TODO: replace with a proper "view profile" panel/drawer.
function viewStaff(staff) {
  alert(
    `${staff.first_name || ""} ${staff.last_name || ""}\n` +
      `Staff ID: ${staff.staff_id || "—"}\n` +
      `Email: ${staff.email || "—"}\n` +
      `Department: ${staff.department || "—"}\n` +
      `Position: ${staff.position || "—"}`
  );
}

// TODO: wire this up to the Add Staff modal in "edit mode" (pre-filled, PATCH instead of INSERT).
function editStaff(staff) {
  alert(`Edit for ${staff.first_name || "this staff member"} is not implemented yet.`);
}

/** Sends a password reset email for the given staff member. */
async function resetStaffPassword(staff) {
  if (!staff.email) {
    alert("This staff member has no email on file.");
    return;
  }
  if (!confirm(`Send a password reset email to ${staff.email}?`)) return;

  try {
    await window.VSASAuth.resetPassword(staff.email);
    alert(`Password reset link sent to ${staff.email}.`);
  } catch (err) {
    alert(err.message || "Could not send the reset email. Please try again.");
  }
}

/** Flips is_active on the profiles row (soft deactivate/reactivate). */
async function toggleStaffStatus(staff) {
  const nextStatus = staff.is_active === false ? true : false;
  const verb = nextStatus ? "reactivate" : "deactivate";
  if (!confirm(`Are you sure you want to ${verb} ${staff.first_name || "this staff member"}?`)) return;

  try {
    const { error } = await window.supabaseClient
      .from("profiles")
      .update({ is_active: nextStatus })
      .eq("id", staff.id);

    if (error) throw error;

    staff.is_active = nextStatus;
    applyPipeline();
    renderStats();
  } catch (err) {
    console.error("[VSAS] Failed to update status:", err);
    alert("Could not update this staff member's status. Please try again.");
  }
}

/**
 * Deletes the profile row for a staff member.
 * NOTE: this removes the "profiles" record only. Deleting the underlying
 * Supabase Auth user requires the Service Role Key, which the create-staff
 * Edge Function uses on creation. A matching "delete-staff" function is a
 * natural next step if you also want the Auth user removed on delete.
 */
async function deleteStaff(staff) {
  const fullName = `${staff.first_name || ""} ${staff.last_name || ""}`.trim() || "this staff member";
  if (!confirm(`Delete ${fullName}? This cannot be undone.`)) return;

  try {
    const { error } = await window.supabaseClient.from("profiles").delete().eq("id", staff.id);
    if (error) throw error;

    state.allStaff = state.allStaff.filter((s) => s.id !== staff.id);
    applyPipeline();
    renderStats();
  } catch (err) {
    console.error("[VSAS] Failed to delete staff:", err);
    alert("Could not delete this staff member. Please try again.");
  }
}

/* ------------------------------------------------------------------ */
/* Pagination                                                          */
/* ------------------------------------------------------------------ */

function renderPagination(totalPages) {
  const summary = document.getElementById("paginationSummary");
  const controls = document.getElementById("paginationControls");

  const start = (state.page - 1) * state.pageSize + 1;
  const end = Math.min(state.page * state.pageSize, state.visibleStaff.length);
  summary.textContent = `Showing ${start}–${end} of ${state.visibleStaff.length}`;

  let html = `<button type="button" class="pagination-btn" data-page="prev" ${state.page === 1 ? "disabled" : ""} aria-label="Previous page">&larr;</button>`;

  for (let p = 1; p <= totalPages; p++) {
    html += `<button type="button" class="pagination-btn ${p === state.page ? "is-active" : ""}" data-page="${p}">${p}</button>`;
  }

  html += `<button type="button" class="pagination-btn" data-page="next" ${state.page === totalPages ? "disabled" : ""} aria-label="Next page">&rarr;</button>`;

  controls.innerHTML = html;

  controls.querySelectorAll("[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.page;
      if (target === "prev") state.page = Math.max(1, state.page - 1);
      else if (target === "next") state.page = Math.min(totalPages, state.page + 1);
      else state.page = Number(target);
      renderStaff();
    });
  });
}

/* ------------------------------------------------------------------ */
/* Today's Attendance (live)                                            */
/* ------------------------------------------------------------------ */

/**
 * Returns today's date as YYYY-MM-DD in the *browser's local* timezone.
 * Deliberately not `Date#toISOString()`, which converts to UTC first and
 * would shift the date for anyone not on UTC — the same helper is used on
 * dashboard.html so both sides always agree on what "today" means.
 */
function todayDateString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatTimeShort(date) {
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/** Loads every attendance row for today (RLS lets admin/hr/manager/ceo see all). */
async function loadAttendanceToday() {
  const dateLabelEl = document.getElementById("attendanceDateLabel");
  if (dateLabelEl) {
    dateLabelEl.textContent = new Date().toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  try {
    const { data, error } = await window.supabaseClient
      .from("attendance")
      .select("id, staff_id, work_date, check_in, check_out")
      .eq("work_date", todayDateString());

    if (error) throw error;
    state.attendanceToday = data || [];
  } catch (err) {
    console.error("[VSAS] Failed to load today's attendance:", err);
    state.attendanceToday = [];
  }

  renderAttendanceTable();
}

/**
 * Opens a Supabase Realtime channel on the "attendance" table, scoped to
 * today's date. Any check-in/check-out from any staff member's browser
 * triggers a live refetch here — no polling, no localStorage, works across
 * devices and sessions.
 */
function subscribeAttendanceRealtime() {
  const today = todayDateString();

  attendanceChannel = window.supabaseClient
    .channel("attendance-live")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "attendance", filter: `work_date=eq.${today}` },
      () => {
        loadAttendanceToday();
      }
    )
    .subscribe();
}

/** Builds the { staff, record } roster: every active staff member, matched to today's row (if any). */
function buildAttendanceRoster() {
  const activeStaff = state.allStaff.filter((s) => s.is_active !== false);

  const roster = activeStaff.map((staff) => ({
    staff,
    record: state.attendanceToday.find((a) => a.staff_id === staff.id) || null,
  }));

  const rank = (r) => {
    if (r.record?.check_in && !r.record?.check_out) return 0; // currently checked in
    if (r.record?.check_out) return 1; // checked out for the day
    return 2; // not checked in yet
  };

  roster.sort((a, b) => {
    const diff = rank(a) - rank(b);
    if (diff !== 0) return diff;
    return fullNameOf(a.staff).localeCompare(fullNameOf(b.staff));
  });

  return roster;
}

function renderAttendanceTable() {
  const tbody = document.getElementById("attendanceTableBody");
  const emptyState = document.getElementById("attendanceEmptyState");
  if (!tbody) return; // attendance section not present on this page

  const roster = buildAttendanceRoster();

  if (roster.length === 0) {
    tbody.innerHTML = "";
    if (emptyState) emptyState.style.display = "block";
  } else {
    if (emptyState) emptyState.style.display = "none";
    tbody.innerHTML = roster.map(renderAttendanceRow).join("");
  }

  updateAttendanceStatCards(roster);
}

function renderAttendanceRow({ staff, record }) {
  const name = fullNameOf(staff);
  const checkIn = record?.check_in ? formatTimeShort(new Date(record.check_in)) : "—";
  const checkOut = record?.check_out ? formatTimeShort(new Date(record.check_out)) : "—";

  let statusLabel;
  let statusClass;
  if (!record || !record.check_in) {
    statusLabel = "Not Checked In";
    statusClass = "badge--inactive";
  } else if (!record.check_out) {
    statusLabel = "Checked In";
    statusClass = "badge--active";
  } else {
    statusLabel = "Checked Out";
    statusClass = "badge--role";
  }

  return `
    <tr>
      <td>${escapeHtml(name)}</td>
      <td>${escapeHtml(staff.department || "—")}</td>
      <td>${checkIn}</td>
      <td>${checkOut}</td>
      <td><span class="badge ${statusClass}">${statusLabel}</span></td>
    </tr>`;
}

function updateAttendanceStatCards(roster) {
  const checkedIn = roster.filter((r) => r.record?.check_in && !r.record?.check_out).length;
  const checkedOut = roster.filter((r) => r.record?.check_out).length;
  const notCheckedIn = roster.length - checkedIn - checkedOut;

  setTextIfPresent("attendanceCheckedInCount", checkedIn);
  setTextIfPresent("attendanceCheckedOutCount", checkedOut);
  setTextIfPresent("attendanceNotCheckedInCount", notCheckedIn);
}

function setTextIfPresent(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/* ------------------------------------------------------------------ */
/* Add Staff modal                                                     */
/* ------------------------------------------------------------------ */

function wireModalEvents() {
  document.getElementById("openAddStaffBtn").addEventListener("click", openAddStaffModal);
  document.getElementById("closeAddStaffBtn").addEventListener("click", closeAddStaffModal);
  document.getElementById("cancelAddStaffBtn").addEventListener("click", closeAddStaffModal);

  document.getElementById("addStaffModal").addEventListener("click", (event) => {
    if (event.target.id === "addStaffModal") closeAddStaffModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAddStaffModal();
  });

  document.getElementById("newProfilePicture").addEventListener("change", (event) => {
    const label = document.getElementById("uploadLabel");
    const file = event.target.files[0];
    label.textContent = file ? file.name : "Click to upload a photo (JPG or PNG, max 2MB)";
  });

  document.getElementById("addStaffForm").addEventListener("submit", handleAddStaffSubmit);
}

function openAddStaffModal() {
  document.getElementById("addStaffForm").reset();
  document.getElementById("uploadLabel").textContent = "Click to upload a photo (JPG or PNG, max 2MB)";
  clearAddStaffErrors();

  // Warn immediately if there's nothing to select in the Department
  // dropdown, instead of letting the admin discover it after filling out
  // the rest of the form.
  if (state.departments.length === 0) {
    showAddStaffError(
      "No departments exist yet. Go to Departments and add one before creating staff."
    );
  }

  const modal = document.getElementById("addStaffModal");
  modal.classList.add("is-open");
  document.getElementById("newFirstName").focus();
}

function closeAddStaffModal() {
  document.getElementById("addStaffModal").classList.remove("is-open");
}

function clearAddStaffErrors() {
  document.getElementById("addStaffAlert").style.display = "none";
  document.querySelectorAll("#addStaffForm .form-control").forEach((el) => el.classList.remove("is-invalid"));
  document.querySelectorAll("#addStaffForm .field-error").forEach((el) => el.classList.remove("is-visible"));
}

/**
 * Validates the Add Staff form.
 * @returns {{ isValid: boolean, values: object }}
 */
function validateForm() {
  clearAddStaffErrors();
  let isValid = true;

  const values = {
    firstName: document.getElementById("newFirstName").value.trim(),
    lastName: document.getElementById("newLastName").value.trim(),
    email: document.getElementById("newEmail").value.trim(),
    phone: document.getElementById("newPhone").value.trim(),
    department: document.getElementById("newDepartment").value,
    position: document.getElementById("newPosition").value.trim(),
    role: document.getElementById("newRole").value,
    staffId: document.getElementById("newStaffId").value.trim(),
    tempPassword: document.getElementById("newTempPassword").value,
    profilePicture: document.getElementById("newProfilePicture").files[0] || null,
  };

  const markInvalid = (fieldId, errorId) => {
    document.getElementById(fieldId).classList.add("is-invalid");
    document.getElementById(errorId).classList.add("is-visible");
    isValid = false;
  };

  if (!values.firstName) markInvalid("newFirstName", "newFirstNameError");
  if (!values.lastName) markInvalid("newLastName", "newLastNameError");
  if (!values.email || !/\S+@\S+\.\S+/.test(values.email)) markInvalid("newEmail", "newEmailError");
  if (values.phone && !/^[+\d][\d\s-]{6,}$/.test(values.phone)) markInvalid("newPhone", "newPhoneError");
  if (!values.department) markInvalid("newDepartment", "newDepartmentError");
  if (!values.position) markInvalid("newPosition", "newPositionError");
  if (!values.role) markInvalid("newRole", "newRoleError");
  if (!values.staffId) markInvalid("newStaffId", "newStaffIdError");
  if (!values.tempPassword || values.tempPassword.length < 8) markInvalid("newTempPassword", "newTempPasswordError");

  return { isValid, values };
}

/**
 * Submits the Add Staff form to the "create-staff" Edge Function.
 *
 * The Edge Function (running with the Service Role Key, never exposed to
 * the browser) creates the Supabase Auth user, uploads the avatar if any,
 * and inserts the matching `profiles` row — then returns that row so we
 * can drop it straight into the table without a full refetch.
 */
async function handleAddStaffSubmit(event) {
  event.preventDefault();

  const { isValid, values } = validateForm();
  if (!isValid) return;

  setModalLoading(true);

  try {
    const formData = new FormData();
    formData.append("firstName", values.firstName);
    formData.append("lastName", values.lastName);
    formData.append("email", values.email);
    formData.append("phone", values.phone);
    formData.append("department", values.department);
    formData.append("position", values.position);
    formData.append("role", values.role);
    formData.append("staffId", values.staffId);
    formData.append("tempPassword", values.tempPassword);
    if (values.profilePicture) {
      formData.append("profilePicture", values.profilePicture);
    }

    // supabase-js automatically attaches the current admin's session as a
    // Bearer token, and posts FormData as multipart — no manual fetch/URL
    // building needed, and the Service Role Key never touches the client.
    const { data, error } = await window.supabaseClient.functions.invoke("create-staff", {
      body: formData,
    });

    if (error) {
      throw new Error(await extractFunctionErrorMessage(error));
    }

    if (!data || !data.profile) {
      throw new Error("Unexpected response from the server. Please try again.");
    }

    const newProfile = data.profile;

    // Instantly reflect the new staff member everywhere, with no page reload:
    state.allStaff.unshift(newProfile); // table
    applyPipeline(); // re-applies search/filter/sort + repopulates position filter + pagination
    renderStats(); // stat cards

    closeAddStaffModal();
    showToast(`${fullNameOf(newProfile)} was added successfully.`, "success");
  } catch (err) {
    console.error("[VSAS] Failed to create staff:", err);
    showAddStaffError(err.message || "Could not create this staff member. Please try again.");
  } finally {
    setModalLoading(false);
  }
}

/**
 * supabase-js throws a FunctionsHttpError for non-2xx Edge Function
 * responses; the friendly message we send back lives in the response body,
 * not `error.message`. Falls back gracefully if the body isn't JSON.
 */
async function extractFunctionErrorMessage(error) {
  try {
    if (error?.context && typeof error.context.json === "function") {
      const body = await error.context.json();
      if (body?.error) return body.error;
    }
  } catch (_) {
    // Body wasn't JSON (e.g. a network-level failure) — fall through.
  }
  return error?.message || "Could not create this staff member. Please try again.";
}

function fullNameOf(staff) {
  return `${staff.first_name || ""} ${staff.last_name || ""}`.trim() || "New staff member";
}

function showAddStaffError(message) {
  const alertBox = document.getElementById("addStaffAlert");
  const alertText = document.getElementById("addStaffAlertText");
  alertText.textContent = message;
  alertBox.style.display = "flex";
}

function setModalLoading(isLoading) {
  const btn = document.getElementById("createStaffBtn");
  btn.dataset.loading = isLoading ? "true" : "false";
  btn.disabled = isLoading;
}

/* ------------------------------------------------------------------ */
/* Lightweight toast notifications                                     */
/* ------------------------------------------------------------------ */

/** Shows a small, self-dismissing toast in the bottom-right corner. */
function showToast(message, kind = "success") {
  let container = document.getElementById("vsasToastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "vsasToastContainer";
    container.style.cssText =
      "position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  const bg = kind === "success" ? "#16a34a" : "#dc2626";
  toast.textContent = message;
  toast.style.cssText = `
    background:${bg};color:#fff;padding:12px 16px;border-radius:8px;
    box-shadow:0 4px 12px rgba(0,0,0,0.15);font-size:14px;font-family:inherit;
    max-width:320px;opacity:0;transform:translateY(8px);
    transition:opacity 0.2s ease, transform 0.2s ease;
  `;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
    setTimeout(() => toast.remove(), 200);
  }, 3500);
}

/* ------------------------------------------------------------------ */
/* Utilities                                                           */
/* ------------------------------------------------------------------ */

function getInitials(name) {
  return name
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