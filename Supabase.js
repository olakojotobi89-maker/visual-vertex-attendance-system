/* =========================================================
   VSMS — Supabase Client
   js/supabase.js

   Creates a single, reusable Supabase client and exposes it
   globally as `window.supabaseClient` so that every
   page-specific script (auth.js, dashboard.js, attendance.js,
   etc.) can call it without re-initializing the SDK.

   Load order matters — this file must be included AFTER the
   Supabase SDK script tag and BEFORE any page-specific script
   that uses `window.supabaseClient`:

     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
     <script src="../js/supabase.js"></script>
     <script src="../js/login.js"></script>

   SECURITY NOTE:
   Only the Project URL and the Publishable (anon/public) Key
   belong here. Never place the Secret Key (sb_secret_...) in
   any frontend file — it must live only in a trusted backend
   / server environment (e.g. the future Node.js + Express API).
   ========================================================= */

(function () {
  "use strict";

  var SUPABASE_URL = "https://yiudsgcuxbzbtxzbsgra.supabase.co";
  var SUPABASE_PUBLISHABLE_KEY = "YOUR_PUBLISHABLE_KEY_HERE"; // Replace with your actual publishable (anon) key.

  if (typeof window.supabase === "undefined") {
    console.error(
      "Supabase SDK not found. Make sure the CDN script is loaded before js/supabase.js:\n" +
      '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>'
    );
    return;
  }

  // Avoid re-creating the client if this script is accidentally included twice.
  if (!window.supabaseClient) {
    window.supabaseClient = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY
    );
  }
})();