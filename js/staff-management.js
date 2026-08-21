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
  filters: {
    department: "",
    position: "",
    status: "",
  },
  sortBy: "name_asc",
  isLoading: true,
};

const PAGE_SIZE = 10;

// Matches ROLE_REDIRECTS in auth.js.
const ALLOWED_ROLES = new Set(["admin", "hr", "manager", "ceo"]);

let attendanceChannel = null;

/* ------------------------------------------------------------------ */
/* Bootstrap                                                           */
/* ------------------------------------------------------------------ */

document.addEventListener("DOMContentLoaded", init);

async function init() {
  // --- Access control: only Admin/HR/Manager/CEO may see this page. ---
  const auth = await window.VSASAuth.requireAuth();

  if (!auth) return;

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

/**
 * Unsubscribe the realtime channel if the page is closed/navigated away.
 */
window.addEventListener("beforeunload", () => {
  if (attendanceChannel) {
    window.supabaseClient.removeChannel(attendanceChannel);
  }
});

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

function renderAdminHeader(profile) {
  const nameEl = document.getElementById("adminName");
  const roleEl = document.getElementById("adminRole");
  const avatarEl = document.getElementById("adminAvatar");

  const fullName =
    `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Admin";

  if (nameEl) nameEl.textContent = fullName;
  if (roleEl) roleEl.textContent = profile.role || "";

  if (!avatarEl) return;

  if (profile.avatar_url) {
    avatarEl.innerHTML = `
      <img
        src="${escapeHtml(profile.avatar_url)}"
        alt="${escapeHtml(fullName)}"
        style="width:100%;height:100%;border-radius:50%;object-fit:cover;"
      >
    `;
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

  if (!shell) {
    console.error("[VSAS] #dashboardShell was not found.");
  }

  if (!sidebar) {
    console.error("[VSAS] #sidebar was not found.");
  }

  if (!toggleBtn) {
    console.error("[VSAS] #sidebarToggle was not found.");
  }

  /*
   * IMPORTANT:
   *
   * Mobile:
   *   .sidebar.is-open
   *
   * Desktop:
   *   .dashboard-shell.is-collapsed
   *   .dashboard-shell.is-expanded
   *
   * We intentionally keep these state names consistent with the existing
   * application instead of introducing another sidebar state system.
   */
  if (toggleBtn && sidebar && shell) {
    toggleBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const isMobile = window.innerWidth <= 720;

      if (isMobile) {
        // Mobile uses the sidebar itself as the open/close state.
        sidebar.classList.toggle("is-open");

        // Prevent the desktop shell state from interfering with mobile.
        shell.classList.remove("is-collapsed");
        shell.classList.remove("is-expanded");

        return;
      }

      // Desktop keeps the existing collapsed/expanded shell behavior.
      sidebar.classList.remove("is-open");

      shell.classList.toggle("is-collapsed");
      shell.classList.toggle("is-expanded");
    });

    /*
     * If the user resizes from mobile to desktop while the mobile sidebar
     * is open, clean up the mobile state.
     */
    window.addEventListener("resize", () => {
      if (window.innerWidth > 720) {
        sidebar.classList.remove("is-open");
      }
    });
  }

  /*
   * Mobile usability:
   *
   * If the sidebar contains navigation links and the user selects one,
   * close the mobile sidebar before navigation occurs.
   *
   * This does not interfere with desktop behavior.
   */
  if (sidebar) {
    sidebar.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        if (window.innerWidth <= 720) {
          sidebar.classList.remove("is-open");
        }
      });
    });
  }

  const logoutBtn = document.getElementById("logoutBtn");

  if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
  }

  const sidebarLogout = document.getElementById("sidebarLogout");

  if (sidebarLogout) {
    sidebarLogout.addEventListener("click", (event) => {
      event.preventDefault();
      logout();
    });
  }
}

/** Signs the admin out via the shared auth module. */
async function logout() {
  await window.VSASAuth.logout();
}

/* ------------------------------------------------------------------ */
/* Data loading                                                        */
/* ------------------------------------------------------------------ */

/**
 * Loads every employee from the "profiles" table.
 *
 * IMPORTANT:
 * Supabase is the source of truth.
 * We do not merge local/demo staff into this list.
 */
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

    if (error) {
      throw error;
    }

    state.allStaff = Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("[VSAS] Failed to load staff:", err);

    state.allStaff = [];

    showToast(
      "Could not load staff records. Check your connection or permissions.",
      "error"
    );
  } finally {
    state.isLoading = false;

    applyPipeline();
    renderStats();
  }
}

/**
 * Reloads staff directly from Supabase.
 *
 * This is intentionally separate from loadStaff() so a successful delete
 * can re-read the database and guarantee the UI reflects the actual source
 * of truth.
 */
async function reloadStaffFromDatabase() {
  const { data, error } = await window.supabaseClient
    .from("profiles")
    .select(
      "id, staff_id, first_name, last_name, email, phone, department, position, role, is_active, avatar_url, created_at"
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  state.allStaff = Array.isArray(data) ? data : [];

  applyPipeline();
  renderStats();
}

/**
 * Loads the department list from "departments" for filters and the modal.
 */
async function loadDepartments() {
  try {
    const { data, error } = await window.supabaseClient
      .from("departments")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) throw error;

    state.departments = data || [];

    if (state.departments.length === 0) {
      showToast(
        "No departments found. Add at least one department before adding staff.",
        "error"
      );
    }
  } catch (err) {
    console.error("[VSAS] Failed to load departments:", err);

    state.departments = [];

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

  if (filterSelect) {
    const filterOptions = state.departments
      .map(
        (d) =>
          `<option value="${escapeHtml(d.name)}">${escapeHtml(d.name)}</option>`
      )
      .join("");

    filterSelect.innerHTML =
      `<option value="">All Departments</option>${filterOptions}`;
  }

  if (modalSelect) {
    const modalOptions = state.departments
      .map(
        (d) =>
          `<option value="${escapeHtml(d.name)}">${escapeHtml(d.name)}</option>`
      )
      .join("");

    modalSelect.innerHTML =
      `<option value="">Select department</option>${modalOptions}`;
  }
}

/* ------------------------------------------------------------------ */
/* Stats cards                                                         */
/* ------------------------------------------------------------------ */

function renderStats() {
  const total = state.allStaff.length;

  const active = state.allStaff.filter(
    (s) => s.is_active !== false
  ).length;

  const inactive = total - active;
  const deptCount = state.departments.length;

  setStat("statTotal", total);
  setStat("statActive", active);
  setStat("statInactive", inactive);
  setStat("statDepartments", deptCount);

  renderAttendanceTable();
}

function setStat(id, value) {
  const el = document.getElementById(id);

  if (!el) return;

  el.classList.remove("is-loading");
  el.textContent = value;
}

/* ------------------------------------------------------------------ */
/* Search + filter + sort pipeline                                     */
/* ------------------------------------------------------------------ */

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

function filterStaff(list, filters) {
  return list.filter((s) => {
    if (filters.department && s.department !== filters.department) {
      return false;
    }

    if (filters.position && s.position !== filters.position) {
      return false;
    }

    if (filters.status === "active" && s.is_active === false) {
      return false;
    }

    if (filters.status === "inactive" && s.is_active !== false) {
      return false;
    }

    return true;
  });
}

function sortStaff(list, sortKey) {
  const sorted = [...list];

  const fullName = (s) =>
    `${s.first_name || ""} ${s.last_name || ""}`
      .trim()
      .toLowerCase();

  switch (sortKey) {
    case "name_desc":
      sorted.sort((a, b) =>
        fullName(b).localeCompare(fullName(a))
      );
      break;

    case "created_desc":
      sorted.sort(
        (a, b) =>
          new Date(b.created_at) - new Date(a.created_at)
      );
      break;

    case "created_asc":
      sorted.sort(
        (a, b) =>
          new Date(a.created_at) - new Date(b.created_at)
      );
      break;

    case "department_asc":
      sorted.sort((a, b) =>
        (a.department || "").localeCompare(b.department || "")
      );
      break;

    case "name_asc":
    default:
      sorted.sort((a, b) =>
        fullName(a).localeCompare(fullName(b))
      );
  }

  return sorted;
}

function applyPipeline() {
  let list = state.allStaff;

  list = searchStaff(list, state.search);
  list = filterStaff(list, state.filters);
  list = sortStaff(list, state.sortBy);

  state.visibleStaff = list;

  /*
   * Keep page valid after deleting a record.
   */
  const totalPages = Math.max(
    1,
    Math.ceil(state.visibleStaff.length / state.pageSize)
  );

  state.page = Math.min(state.page, totalPages);

  renderStaff();
}

/* ------------------------------------------------------------------ */
/* Toolbar wiring                                                      */
/* ------------------------------------------------------------------ */

function wireToolbarEvents() {
  const searchInput = document.getElementById("searchInput");

  if (searchInput) {
    let searchDebounce;

    searchInput.addEventListener("input", (event) => {
      clearTimeout(searchDebounce);

      searchDebounce = setTimeout(() => {
        state.search = event.target.value;
        state.page = 1;
        applyPipeline();
      }, 250);
    });
  }

  const filterDepartment = document.getElementById("filterDepartment");

  if (filterDepartment) {
    filterDepartment.addEventListener("change", (event) => {
      state.filters.department = event.target.value;
      state.page = 1;
      applyPipeline();
    });
  }

  const filterPosition = document.getElementById("filterPosition");

  if (filterPosition) {
    filterPosition.addEventListener("change", (event) => {
      state.filters.position = event.target.value;
      state.page = 1;
      applyPipeline();
    });
  }

  const filterStatus = document.getElementById("filterStatus");

  if (filterStatus) {
    filterStatus.addEventListener("change", (event) => {
      state.filters.status = event.target.value;
      state.page = 1;
      applyPipeline();
    });
  }

  const sortBy = document.getElementById("sortBy");

  if (sortBy) {
    sortBy.addEventListener("change", (event) => {
      state.sortBy = event.target.value;
      state.page = 1;
      applyPipeline();
    });
  }
}

/**
 * Rebuilds the "Filter by Position" options from whatever positions
 * currently exist.
 */
function populatePositionOptions() {
  const select = document.getElementById("filterPosition");

  if (!select) return;

  const current = select.value;

  const positions = [
    ...new Set(
      state.allStaff
        .map((s) => s.position)
        .filter(Boolean)
    ),
  ].sort();

  select.innerHTML =
    `<option value="">All Positions</option>` +
    positions
      .map(
        (p) =>
          `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`
      )
      .join("");

  /*
   * Preserve the existing selection where possible.
   */
  if (positions.includes(current)) {
    select.value = current;
  } else {
    select.value = "";
  }
}

/* ------------------------------------------------------------------ */
/* Table rendering                                                     */
/* ------------------------------------------------------------------ */

function renderStaff() {
  const tbody = document.getElementById("staffTableBody");
  const emptyState = document.getElementById("emptyState");
  const noResultsState = document.getElementById("noResultsState");
  const pagination = document.getElementById("pagination");

  if (!tbody) return;

  if (state.isLoading) {
    tbody.innerHTML = renderSkeletonRows(PAGE_SIZE);

    if (emptyState) emptyState.classList.remove("is-visible");
    if (noResultsState) noResultsState.classList.remove("is-visible");

    if (pagination) pagination.style.display = "none";

    return;
  }

  populatePositionOptions();

  /*
   * Nothing in the system at all.
   */
  if (state.allStaff.length === 0) {
    tbody.innerHTML = "";

    if (emptyState) emptyState.classList.add("is-visible");
    if (noResultsState) noResultsState.classList.remove("is-visible");

    if (pagination) pagination.style.display = "none";

    return;
  }

  /*
   * Search/filters returned nothing.
   */
  if (state.visibleStaff.length === 0) {
    tbody.innerHTML = "";

    if (emptyState) emptyState.classList.remove("is-visible");
    if (noResultsState) noResultsState.classList.add("is-visible");

    if (pagination) pagination.style.display = "none";

    return;
  }

  if (emptyState) emptyState.classList.remove("is-visible");
  if (noResultsState) noResultsState.classList.remove("is-visible");

  if (pagination) pagination.style.display = "flex";

  const totalPages = Math.max(
    1,
    Math.ceil(state.visibleStaff.length / state.pageSize)
  );

  state.page = Math.min(state.page, totalPages);

  const start = (state.page - 1) * state.pageSize;

  const pageRows = state.visibleStaff.slice(
    start,
    start + state.pageSize
  );

  tbody.innerHTML = pageRows.map(renderStaffRow).join("");

  wireRowActionEvents();

  renderPagination(totalPages);
}

function renderSkeletonRows(count) {
  const cols = 10;

  const row = `
    <tr>
      ${Array.from(
        { length: cols },
        () => `<td><span class="skeleton-cell"></span></td>`
      ).join("")}
    </tr>
  `;

  return row.repeat(count);
}

function renderStaffRow(staff) {
  /*
   * IMPORTANT:
   *
   * staff.id is the actual profiles database primary key currently being
   * returned by the Supabase query.
   *
   * The delete handler uses this exact UUID.
   */
  const fullName =
    `${staff.first_name || ""} ${staff.last_name || ""}`.trim() || "—";

  const isActive = staff.is_active !== false;

  const createdDate = staff.created_at
    ? new Date(staff.created_at).toLocaleDateString(
        undefined,
        {
          year: "numeric",
          month: "short",
          day: "numeric",
        }
      )
    : "—";

  const avatar = staff.avatar_url
    ? `
      <img
        class="staff-avatar"
        src="${escapeHtml(staff.avatar_url)}"
        alt=""
      >
    `
    : `
      <div class="staff-avatar">
        ${escapeHtml(getInitials(fullName))}
      </div>
    `;

  return `
    <tr data-id="${escapeHtml(staff.id)}">
      <td>
        <div class="staff-person">
          ${avatar}
          <span class="staff-name">
            ${escapeHtml(fullName)}
          </span>
        </div>
      </td>

      <td>
        ${escapeHtml(staff.staff_id || "—")}
      </td>

      <td class="staff-email-cell">
        ${escapeHtml(staff.email || "—")}
      </td>

      <td>
        ${escapeHtml(staff.phone || "—")}
      </td>

      <td>
        ${escapeHtml(staff.department || "—")}
      </td>

      <td>
        ${escapeHtml(staff.position || "—")}
      </td>

      <td>
        <span class="badge badge--role">
          ${escapeHtml(staff.role || "—")}
        </span>
      </td>

      <td>
        <span class="badge ${
          isActive
            ? "badge--active"
            : "badge--inactive"
        }">
          ${isActive ? "Active" : "Inactive"}
        </span>
      </td>

      <td>
        ${createdDate}
      </td>

      <td>
        <div class="row-actions">

          <button
            type="button"
            class="row-action-btn"
            data-action="view"
            aria-label="View ${escapeHtml(fullName)}"
            title="View"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
            >
              <path
                d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>

          <button
            type="button"
            class="row-action-btn"
            data-action="edit"
            aria-label="Edit ${escapeHtml(fullName)}"
            title="Edit"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
            >
              <path
                d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>

          <button
            type="button"
            class="row-action-btn"
            data-action="reset-password"
            aria-label="Reset password for ${escapeHtml(fullName)}"
            title="Reset Password"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
            >
              <rect
                x="3"
                y="11"
                width="18"
                height="10"
                rx="2"
              />
              <path
                d="M7 11V7a5 5 0 0 1 10 0v4"
                stroke-linecap="round"
              />
            </svg>
          </button>

          <button
            type="button"
            class="row-action-btn"
            data-action="toggle-status"
            aria-label="${
              isActive ? "Deactivate" : "Activate"
            } ${escapeHtml(fullName)}"
            title="${
              isActive ? "Deactivate" : "Activate"
            }"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
            >
              <path
                d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>

          <button
            type="button"
            class="row-action-btn is-danger"
            data-action="delete"
            aria-label="Delete ${escapeHtml(fullName)}"
            title="Delete"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
            >
              <path
                d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>

        </div>
      </td>
    </tr>
  `;
}

function wireRowActionEvents() {
  document
    .querySelectorAll("#staffTableBody tr")
    .forEach((row) => {
      const id = row.dataset.id;

      const staff = state.allStaff.find(
        (s) => String(s.id) === String(id)
      );

      if (!staff) return;

      row
        .querySelectorAll("[data-action]")
        .forEach((btn) => {
          btn.addEventListener("click", () => {
            handleRowAction(
              btn.dataset.action,
              staff
            );
          });
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

function viewStaff(staff) {
  alert(
    `${staff.first_name || ""} ${staff.last_name || ""}\n` +
      `Staff ID: ${staff.staff_id || "—"}\n` +
      `Email: ${staff.email || "—"}\n` +
      `Department: ${staff.department || "—"}\n` +
      `Position: ${staff.position || "—"}`
  );
}

function editStaff(staff) {
  alert(
    `Edit for ${
      staff.first_name || "this staff member"
    } is not implemented yet.`
  );
}

/**
 * Sends a password reset email for the given staff member.
 */
async function resetStaffPassword(staff) {
  if (!staff.email) {
    alert("This staff member has no email on file.");
    return;
  }

  if (
    !confirm(
      `Send a password reset email to ${staff.email}?`
    )
  ) {
    return;
  }

  try {
    await window.VSASAuth.resetPassword(staff.email);

    alert(
      `Password reset link sent to ${staff.email}.`
    );
  } catch (err) {
    console.error(
      "[VSAS] Failed to send password reset:",
      err
    );

    alert(
      err.message ||
        "Could not send the reset email. Please try again."
    );
  }
}

/**
 * Flips is_active on the profiles row.
 */
async function toggleStaffStatus(staff) {
  const nextStatus =
    staff.is_active === false ? true : false;

  const verb = nextStatus
    ? "reactivate"
    : "deactivate";

  if (
    !confirm(
      `Are you sure you want to ${verb} ${
        staff.first_name || "this staff member"
      }?`
    )
  ) {
    return;
  }

  try {
    const { error } = await window.supabaseClient
      .from("profiles")
      .update({
        is_active: nextStatus,
      })
      .eq("id", staff.id);

    if (error) {
      throw error;
    }

    staff.is_active = nextStatus;

    applyPipeline();
    renderStats();

    showToast(
      `${fullNameOf(staff)} was ${
        nextStatus
          ? "reactivated"
          : "deactivated"
      } successfully.`,
      "success"
    );
  } catch (err) {
    console.error(
      "[VSAS] Failed to update status:",
      err
    );

    alert(
      "Could not update this staff member's status. Please try again."
    );
  }
}

/**
 * Permanently deletes the profiles row for a staff member.
 *
 * IMPORTANT:
 *
 * The browser only uses the authenticated Supabase client.
 * No service-role key or secret is used here.
 *
 * The database primary key is `profiles.id`, which is already returned
 * by the existing staff query and attached to each rendered row.
 *
 * The UI is NOT modified until Supabase confirms that a real row was
 * deleted.
 */
async function deleteStaff(staff) {
  const fullName =
    `${staff.first_name || ""} ${staff.last_name || ""}`.trim() ||
    "this staff member";

  /*
   * Safety check: the record must have the actual database primary key.
   */
  if (!staff.id) {
    console.error(
      "[VSAS] Cannot delete staff: missing profiles.id.",
      staff
    );

    showToast(
      "Could not delete this staff member because the database record ID is missing.",
      "error"
    );

    return;
  }

  const confirmed = confirm(
    `Delete ${fullName}? This cannot be undone.`
  );

  if (!confirmed) {
    return;
  }

  /*
   * Prevent accidental duplicate clicks while the request is running.
   */
  const row = document.querySelector(
    `#staffTableBody tr[data-id="${CSS.escape(String(staff.id))}"]`
  );

  const deleteButton = row?.querySelector(
    '[data-action="delete"]'
  );

  if (deleteButton) {
    deleteButton.disabled = true;
    deleteButton.dataset.loading = "true";
    deleteButton.setAttribute(
      "aria-label",
      `Deleting ${fullName}`
    );
  }

  try {
    console.log(
      "[VSAS] Attempting to permanently delete profile:",
      {
        profileId: staff.id,
        staffId: staff.staff_id,
        name: fullName,
      }
    );

    /*
     * IMPORTANT:
     *
     * `.select("id")` asks Supabase/PostgREST to return the rows that
     * were actually deleted.
     *
     * This prevents us from treating a zero-row DELETE as a successful
     * deletion.
     */
    const {
      data: deletedRows,
      error,
    } = await window.supabaseClient
      .from("profiles")
      .delete()
      .eq("id", staff.id)
      .select("id");

    if (error) {
      throw error;
    }

    const deletedCount = Array.isArray(
      deletedRows
    )
      ? deletedRows.length
      : 0;

    /*
     * If zero rows came back, we cannot claim the database deletion
     * succeeded.
     *
     * This commonly points to:
     * - RLS DELETE policy preventing the operation
     * - wrong database identifier
     * - the row already being absent
     * - another database permission issue
     */
    if (deletedCount !== 1) {
      console.error(
        "[VSAS] Supabase DELETE returned zero deleted rows.",
        {
          profileId: staff.id,
          staffId: staff.staff_id,
          deletedRows,
        }
      );

      /*
       * Check whether the record still exists.
       *
       * This gives us a more useful diagnostic when RLS or another
       * database rule prevents the deletion.
       */
      let verificationError = null;
      let remainingRecord = null;

      try {
        const {
          data: verificationData,
          error: verifyError,
        } = await window.supabaseClient
          .from("profiles")
          .select("id")
          .eq("id", staff.id)
          .maybeSingle();

        verificationError = verifyError;
        remainingRecord = verificationData;
      } catch (verifyErr) {
        verificationError = verifyErr;
      }

      if (verificationError) {
        console.error(
          "[VSAS] Could not verify staff deletion:",
          verificationError
        );
      } else if (remainingRecord) {
        console.error(
          "[VSAS] Staff record STILL EXISTS in profiles after DELETE attempt.",
          {
            profileId: staff.id,
            record: remainingRecord,
          }
        );
      }

      throw new Error(
        "Supabase did not confirm deletion of this staff record. The database record was not removed. Check the browser console for the exact Supabase response and verify the profiles DELETE RLS policy."
      );
    }

    console.log(
      "[VSAS] Staff profile deleted successfully:",
      deletedRows[0]
    );

    /*
     * IMPORTANT:
     *
     * Do NOT just filter the local array and stop here.
     *
     * Reload the list directly from Supabase so the UI becomes an exact
     * representation of the database.
     */
    await reloadStaffFromDatabase();

    /*
     * Reset pagination safely after deletion.
     */
    const totalPages = Math.max(
      1,
      Math.ceil(
        state.visibleStaff.length /
          state.pageSize
      )
    );

    if (state.page > totalPages) {
      state.page = totalPages;
      renderStaff();
    }

    showToast(
      `${fullName} was deleted successfully.`,
      "success"
    );
  } catch (err) {
    /*
     * CRITICAL:
     *
     * The UI is deliberately NOT modified here.
     *
     * If Supabase fails, the staff member remains visible because we do
     * not have confirmation that the database record was deleted.
     */
    console.error(
      "[VSAS] Failed to permanently delete staff:",
      err
    );

    console.error(
      "[VSAS] Delete failure details:",
      {
        message: err?.message,
        code: err?.code,
        details: err?.details,
        hint: err?.hint,
        staffId: staff?.id,
        employeeStaffId: staff?.staff_id,
      }
    );

    showToast(
      err?.message ||
        "Deletion failed. Please try again.",
      "error"
    );
  } finally {
    /*
     * Re-enable the delete button if the row still exists.
     */
    const currentRow = document.querySelector(
      `#staffTableBody tr[data-id="${CSS.escape(String(staff.id))}"]`
    );

    const currentDeleteButton =
      currentRow?.querySelector(
        '[data-action="delete"]'
      );

    if (currentDeleteButton) {
      currentDeleteButton.disabled = false;
      currentDeleteButton.dataset.loading = "false";
      currentDeleteButton.setAttribute(
        "aria-label",
        `Delete ${fullName}`
      );
    }
  }
}

/* ------------------------------------------------------------------ */
/* Pagination                                                          */
/* ------------------------------------------------------------------ */

function renderPagination(totalPages) {
  const summary = document.getElementById(
    "paginationSummary"
  );

  const controls = document.getElementById(
    "paginationControls"
  );

  if (!summary || !controls) return;

  const start =
    (state.page - 1) *
      state.pageSize +
    1;

  const end = Math.min(
    state.page * state.pageSize,
    state.visibleStaff.length
  );

  summary.textContent = `Showing ${start}–${end} of ${state.visibleStaff.length}`;

  let html = `
    <button
      type="button"
      class="pagination-btn"
      data-page="prev"
      ${
        state.page === 1
          ? "disabled"
          : ""
      }
      aria-label="Previous page"
    >
      &larr;
    </button>
  `;

  for (
    let p = 1;
    p <= totalPages;
    p++
  ) {
    html += `
      <button
        type="button"
        class="pagination-btn ${
          p === state.page
            ? "is-active"
            : ""
        }"
        data-page="${p}"
      >
        ${p}
      </button>
    `;
  }

  html += `
    <button
      type="button"
      class="pagination-btn"
      data-page="next"
      ${
        state.page === totalPages
          ? "disabled"
          : ""
      }
      aria-label="Next page"
    >
      &rarr;
    </button>
  `;

  controls.innerHTML = html;

  controls
    .querySelectorAll("[data-page]")
    .forEach((btn) => {
      btn.addEventListener(
        "click",
        () => {
          const target =
            btn.dataset.page;

          if (
            target === "prev"
          ) {
            state.page = Math.max(
              1,
              state.page - 1
            );
          } else if (
            target === "next"
          ) {
            state.page = Math.min(
              totalPages,
              state.page + 1
            );
          } else {
            state.page =
              Number(target);
          }

          renderStaff();
        }
      );
    });
}

/* ------------------------------------------------------------------ */
/* Today's Attendance                                                  */
/* ------------------------------------------------------------------ */

function todayDateString() {
  const d = new Date();

  const y = d.getFullYear();
  const m = String(
    d.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    d.getDate()
  ).padStart(2, "0");

  return `${y}-${m}-${day}`;
}

function formatTimeShort(date) {
  return date.toLocaleTimeString(
    undefined,
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

async function loadAttendanceToday() {
  const dateLabelEl =
    document.getElementById(
      "attendanceDateLabel"
    );

  if (dateLabelEl) {
    dateLabelEl.textContent =
      new Date().toLocaleDateString(
        undefined,
        {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }
      );
  }

  try {
    const {
      data,
      error,
    } = await window.supabaseClient
      .from("attendance")
      .select(
        "id, user_id, attendance_date, check_in, check_out"
      )
      .eq(
        "attendance_date",
        todayDateString()
      );

    if (error) throw error;

    state.attendanceToday =
      data || [];
  } catch (err) {
    console.error(
      "[VSAS] Failed to load today's attendance:",
      err
    );

    state.attendanceToday = [];
  }

  renderAttendanceTable();
}

function subscribeAttendanceRealtime() {
  const today =
    todayDateString();

  attendanceChannel =
    window.supabaseClient
      .channel(
        "attendance-live"
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance",
          filter: `attendance_date=eq.${today}`,
        },
        () => {
          loadAttendanceToday();
        }
      )
      .subscribe();
}

function buildAttendanceRoster() {
  const activeStaff =
    state.allStaff.filter(
      (s) => s.is_active !== false
    );

  const roster =
    activeStaff.map(
      (staff) => ({
        staff,
        record:
          state.attendanceToday.find(
            (a) =>
              a.user_id ===
              staff.id
          ) || null,
      })
    );

  const rank = (r) => {
    if (
      r.record?.check_in &&
      !r.record?.check_out
    ) {
      return 0;
    }

    if (r.record?.check_out) {
      return 1;
    }

    return 2;
  };

  roster.sort((a, b) => {
    const diff =
      rank(a) - rank(b);

    if (diff !== 0) {
      return diff;
    }

    return fullNameOf(
      a.staff
    ).localeCompare(
      fullNameOf(b.staff)
    );
  });

  return roster;
}

function renderAttendanceTable() {
  const tbody =
    document.getElementById(
      "attendanceTableBody"
    );

  const emptyState =
    document.getElementById(
      "attendanceEmptyState"
    );

  if (!tbody) return;

  const roster =
    buildAttendanceRoster();

  if (roster.length === 0) {
    tbody.innerHTML = "";

    if (emptyState) {
      emptyState.style.display =
        "block";
    }
  } else {
    if (emptyState) {
      emptyState.style.display =
        "none";
    }

    tbody.innerHTML =
      roster
        .map(renderAttendanceRow)
        .join("");
  }

  updateAttendanceStatCards(
    roster
  );
}

function renderAttendanceRow({
  staff,
  record,
}) {
  const name =
    fullNameOf(staff);

  const checkIn =
    record?.check_in
      ? formatTimeShort(
          new Date(
            record.check_in
          )
        )
      : "—";

  const checkOut =
    record?.check_out
      ? formatTimeShort(
          new Date(
            record.check_out
          )
        )
      : "—";

  let statusLabel;
  let statusClass;

  if (
    !record ||
    !record.check_in
  ) {
    statusLabel =
      "Not Checked In";
    statusClass =
      "badge--inactive";
  } else if (
    !record.check_out
  ) {
    statusLabel =
      "Checked In";
    statusClass =
      "badge--active";
  } else {
    statusLabel =
      "Checked Out";
    statusClass =
      "badge--role";
  }

  return `
    <tr>
      <td>
        ${escapeHtml(name)}
      </td>

      <td>
        ${escapeHtml(
          staff.department ||
            "—"
        )}
      </td>

      <td>
        ${checkIn}
      </td>

      <td>
        ${checkOut}
      </td>

      <td>
        <span class="badge ${statusClass}">
          ${statusLabel}
        </span>
      </td>
    </tr>
  `;
}

function updateAttendanceStatCards(
  roster
) {
  const checkedIn =
    roster.filter(
      (r) =>
        r.record?.check_in &&
        !r.record?.check_out
    ).length;

  const checkedOut =
    roster.filter(
      (r) =>
        r.record?.check_out
    ).length;

  const notCheckedIn =
    roster.length -
    checkedIn -
    checkedOut;

  setTextIfPresent(
    "attendanceCheckedInCount",
    checkedIn
  );

  setTextIfPresent(
    "attendanceCheckedOutCount",
    checkedOut
  );

  setTextIfPresent(
    "attendanceNotCheckedInCount",
    notCheckedIn
  );
}

function setTextIfPresent(
  id,
  value
) {
  const el =
    document.getElementById(id);

  if (el) {
    el.textContent = value;
  }
}

/* ------------------------------------------------------------------ */
/* Add Staff modal                                                     */
/* ------------------------------------------------------------------ */

function wireModalEvents() {
  const openBtn =
    document.getElementById(
      "openAddStaffBtn"
    );

  if (openBtn) {
    openBtn.addEventListener(
      "click",
      openAddStaffModal
    );
  }

  const closeBtn =
    document.getElementById(
      "closeAddStaffBtn"
    );

  if (closeBtn) {
    closeBtn.addEventListener(
      "click",
      closeAddStaffModal
    );
  }

  const cancelBtn =
    document.getElementById(
      "cancelAddStaffBtn"
    );

  if (cancelBtn) {
    cancelBtn.addEventListener(
      "click",
      closeAddStaffModal
    );
  }

  const modal =
    document.getElementById(
      "addStaffModal"
    );

  if (modal) {
    modal.addEventListener(
      "click",
      (event) => {
        if (
          event.target.id ===
          "addStaffModal"
        ) {
          closeAddStaffModal();
        }
      }
    );
  }

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") {
        closeAddStaffModal();
      }
    }
  );

  const pictureInput =
    document.getElementById(
      "newProfilePicture"
    );

  if (pictureInput) {
    pictureInput.addEventListener(
      "change",
      (event) => {
        const label =
          document.getElementById(
            "uploadLabel"
          );

        const file =
          event.target.files[0];

        if (label) {
          label.textContent =
            file
              ? file.name
              : "Click to upload a photo (JPG or PNG, max 2MB)";
        }
      }
    );
  }

  const addForm =
    document.getElementById(
      "addStaffForm"
    );

  if (addForm) {
    addForm.addEventListener(
      "submit",
      handleAddStaffSubmit
    );
  }
}

function openAddStaffModal() {
  const form =
    document.getElementById(
      "addStaffForm"
    );

  if (form) {
    form.reset();
  }

  const uploadLabel =
    document.getElementById(
      "uploadLabel"
    );

  if (uploadLabel) {
    uploadLabel.textContent =
      "Click to upload a photo (JPG or PNG, max 2MB)";
  }

  clearAddStaffErrors();

  if (
    state.departments.length ===
    0
  ) {
    showAddStaffError(
      "No departments exist yet. Go to Departments and add one before creating staff."
    );
  }

  const modal =
    document.getElementById(
      "addStaffModal"
    );

  if (modal) {
    modal.classList.add(
      "is-open"
    );
  }

  const firstName =
    document.getElementById(
      "newFirstName"
    );

  if (firstName) {
    firstName.focus();
  }
}

function closeAddStaffModal() {
  const modal =
    document.getElementById(
      "addStaffModal"
    );

  if (modal) {
    modal.classList.remove(
      "is-open"
    );
  }
}

function clearAddStaffErrors() {
  const alertBox =
    document.getElementById(
      "addStaffAlert"
    );

  if (alertBox) {
    alertBox.style.display =
      "none";
  }

  document
    .querySelectorAll(
      "#addStaffForm .form-control"
    )
    .forEach((el) =>
      el.classList.remove(
        "is-invalid"
      )
    );

  document
    .querySelectorAll(
      "#addStaffForm .field-error"
    )
    .forEach((el) =>
      el.classList.remove(
        "is-visible"
      )
    );
}

/**
 * Validates the Add Staff form.
 */
function validateForm() {
  clearAddStaffErrors();

  let isValid = true;

  const getValue = (id) =>
    document.getElementById(id)
      ?.value
      ?.trim() || "";

  const values = {
    firstName: getValue(
      "newFirstName"
    ),

    lastName: getValue(
      "newLastName"
    ),

    email: getValue(
      "newEmail"
    ),

    phone: getValue(
      "newPhone"
    ),

    department:
      document.getElementById(
        "newDepartment"
      )?.value || "",

    position: getValue(
      "newPosition"
    ),

    role:
      document.getElementById(
        "newRole"
      )?.value || "",

    staffId: getValue(
      "newStaffId"
    ),

    tempPassword:
      document.getElementById(
        "newTempPassword"
      )?.value || "",

    profilePicture:
      document.getElementById(
        "newProfilePicture"
      )?.files?.[0] || null,
  };

  const markInvalid = (
    fieldId,
    errorId
  ) => {
    const field =
      document.getElementById(
        fieldId
      );

    const error =
      document.getElementById(
        errorId
      );

    if (field) {
      field.classList.add(
        "is-invalid"
      );
    }

    if (error) {
      error.classList.add(
        "is-visible"
      );
    }

    isValid = false;
  };

  if (!values.firstName) {
    markInvalid(
      "newFirstName",
      "newFirstNameError"
    );
  }

  if (!values.lastName) {
    markInvalid(
      "newLastName",
      "newLastNameError"
    );
  }

  if (
    !values.email ||
    !/\S+@\S+\.\S+/.test(
      values.email
    )
  ) {
    markInvalid(
      "newEmail",
      "newEmailError"
    );
  }

  if (
    values.phone &&
    !/^[+\d][\d\s-]{6,}$/.test(
      values.phone
    )
  ) {
    markInvalid(
      "newPhone",
      "newPhoneError"
    );
  }

  if (!values.department) {
    markInvalid(
      "newDepartment",
      "newDepartmentError"
    );
  }

  if (!values.position) {
    markInvalid(
      "newPosition",
      "newPositionError"
    );
  }

  if (!values.role) {
    markInvalid(
      "newRole",
      "newRoleError"
    );
  }

  if (!values.staffId) {
    markInvalid(
      "newStaffId",
      "newStaffIdError"
    );
  }

  if (
    !values.tempPassword ||
    values.tempPassword.length < 8
  ) {
    markInvalid(
      "newTempPassword",
      "newTempPasswordError"
    );
  }

  return {
    isValid,
    values,
  };
}

/**
 * Submits the Add Staff form to the "create-staff" Edge Function.
 *
 * The Edge Function is responsible for Service Role operations.
 * The browser never receives the Service Role Key.
 */
async function handleAddStaffSubmit(
  event
) {
  event.preventDefault();

  const {
    isValid,
    values,
  } = validateForm();

  if (!isValid) return;

  setModalLoading(true);

  try {
    const formData =
      new FormData();

    formData.append(
      "firstName",
      values.firstName
    );

    formData.append(
      "lastName",
      values.lastName
    );

    formData.append(
      "email",
      values.email
    );

    formData.append(
      "phone",
      values.phone
    );

    formData.append(
      "department",
      values.department
    );

    formData.append(
      "position",
      values.position
    );

    formData.append(
      "role",
      values.role
    );

    formData.append(
      "staffId",
      values.staffId
    );

    formData.append(
      "tempPassword",
      values.tempPassword
    );

    if (values.profilePicture) {
      formData.append(
        "profilePicture",
        values.profilePicture
      );
    }

    const {
      data,
      error,
    } =
      await window.supabaseClient.functions.invoke(
        "create-staff",
        {
          body: formData,
        }
      );

    if (error) {
      throw new Error(
        await extractFunctionErrorMessage(
          error
        )
      );
    }

    if (
      !data ||
      !data.profile
    ) {
      throw new Error(
        "Unexpected response from the server. Please try again."
      );
    }

    const newProfile =
      data.profile;

    /*
     * Keep the existing fast UI update for creation.
     */
    state.allStaff.unshift(
      newProfile
    );

    applyPipeline();
    renderStats();

    closeAddStaffModal();

    showToast(
      `${fullNameOf(
        newProfile
      )} was added successfully.`,
      "success"
    );
  } catch (err) {
    console.error(
      "[VSAS] Failed to create staff:",
      err
    );

    showAddStaffError(
      err.message ||
        "Could not create this staff member. Please try again."
    );
  } finally {
    setModalLoading(false);
  }
}

async function extractFunctionErrorMessage(
  error
) {
  try {
    if (
      error?.context &&
      typeof error.context
        .json === "function"
    ) {
      const body =
        await error.context.json();

      if (body?.error) {
        return body.error;
      }
    }
  } catch (_) {
    // Fall through.
  }

  return (
    error?.message ||
    "Could not create this staff member. Please try again."
  );
}

function fullNameOf(staff) {
  return (
    `${staff.first_name || ""} ${
      staff.last_name || ""
    }`
      .trim() ||
    "New staff member"
  );
}

function showAddStaffError(
  message
) {
  const alertBox =
    document.getElementById(
      "addStaffAlert"
    );

  const alertText =
    document.getElementById(
      "addStaffAlertText"
    );

  if (alertText) {
    alertText.textContent =
      message;
  }

  if (alertBox) {
    alertBox.style.display =
      "flex";
  }
}

function setModalLoading(
  isLoading
) {
  const btn =
    document.getElementById(
      "createStaffBtn"
    );

  if (!btn) return;

  btn.dataset.loading =
    isLoading
      ? "true"
      : "false";

  btn.disabled = isLoading;
}

/* ------------------------------------------------------------------ */
/* Lightweight toast notifications                                    */
/* ------------------------------------------------------------------ */

function showToast(
  message,
  kind = "success"
) {
  let container =
    document.getElementById(
      "vsasToastContainer"
    );

  if (!container) {
    container =
      document.createElement(
        "div"
      );

    container.id =
      "vsasToastContainer";

    container.style.cssText =
      "position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;";

    document.body.appendChild(
      container
    );
  }

  const toast =
    document.createElement(
      "div"
    );

  const bg =
    kind === "success"
      ? "#16a34a"
      : "#dc2626";

  toast.textContent =
    message;

  toast.style.cssText = `
    background:${bg};
    color:#fff;
    padding:12px 16px;
    border-radius:8px;
    box-shadow:0 4px 12px rgba(0,0,0,0.15);
    font-size:14px;
    font-family:inherit;
    max-width:320px;
    opacity:0;
    transform:translateY(8px);
    transition:opacity 0.2s ease, transform 0.2s ease;
  `;

  container.appendChild(
    toast
  );

  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform =
      "translateY(0)";
  });

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform =
      "translateY(8px)";

    setTimeout(
      () => toast.remove(),
      200
    );
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
    .map(
      (part) =>
        part[0].toUpperCase()
    )
    .join("");
}

function escapeHtml(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value)
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}