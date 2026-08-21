/* Sidebar toggle — handles both behaviors with one button:
   - Desktop/tablet (>720px): collapses sidebar to icons-only (.is-collapsed)
   - Mobile (<=720px): slides sidebar in/out as an overlay (.is-open) with a backdrop
   Add this after your other scripts, or merge it into staff-management.js */

(function () {
  const shell = document.getElementById('dashboardShell');
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('sidebarToggle');
  let backdrop = document.getElementById('sidebarBackdrop');

  // Create the backdrop if it isn't already in the HTML
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'sidebarBackdrop';
    backdrop.className = 'sidebar-backdrop';
    document.body.appendChild(backdrop);
  }

  const isMobile = () => window.matchMedia('(max-width: 720px)').matches;

  function openMobileSidebar() {
    sidebar.classList.add('is-open');
    backdrop.classList.add('is-visible');
    toggleBtn.setAttribute('aria-expanded', 'true');
  }

  function closeMobileSidebar() {
    sidebar.classList.remove('is-open');
    backdrop.classList.remove('is-visible');
    toggleBtn.setAttribute('aria-expanded', 'false');
  }

  toggleBtn.addEventListener('click', () => {
    if (isMobile()) {
      sidebar.classList.contains('is-open') ? closeMobileSidebar() : openMobileSidebar();
    } else {
      shell.classList.toggle('is-collapsed');
      shell.classList.toggle('is-expanded');
    }
  });

  backdrop.addEventListener('click', closeMobileSidebar);

  // Close the mobile sidebar automatically if the viewport is resized past the breakpoint
  window.addEventListener('resize', () => {
    if (!isMobile()) closeMobileSidebar();
  });

  // Close on nav link tap (mobile) so the overlay doesn't linger after navigation
  sidebar.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', () => { if (isMobile()) closeMobileSidebar(); });
  });
})();