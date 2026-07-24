/**
 * supabase.js
 * -----------------------------------------------------------------------
 * Creates a single, shared Supabase client for the whole VSAS site and
 * exposes it as `window.supabaseClient`.
 *
 * Must be loaded AFTER the Supabase CDN script and BEFORE auth.js:
 *   1. https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2
 *   2. js/supabase.js   (this file)
 *   3. js/auth.js
 * -----------------------------------------------------------------------
 */

(function initSupabaseClient() {
  // TODO: replace with your actual Supabase project credentials.
  // The anon/public key is safe to expose client-side; it is protected by
  // your Row Level Security (RLS) policies on the "profiles" table.
  const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
  const SUPABASE_ANON_KEY = "YOUR-PUBLIC-ANON-KEY";

  if (typeof window.supabase === "undefined") {
    console.error(
      "[VSAS] Supabase library not found. Make sure the Supabase CDN <script> " +
      "tag is loaded before js/supabase.js."
    );
    return;
  }

  /**
   * Custom storage adapter for "Remember Me".
   *
   * Supabase persists the session by calling storage.setItem() right after
   * a successful sign-in. auth.js sets a "vsas_remember_me" flag in
   * localStorage BEFORE calling signInWithPassword(), so this adapter
   * knows where to write the session token:
   *   - remember me checked   -> localStorage   (survives browser restarts)
   *   - remember me unchecked -> sessionStorage  (cleared when tab/browser closes)
   */
  const rememberAwareStorage = {
    getItem(key) {
      return sessionStorage.getItem(key) ?? localStorage.getItem(key);
    },
    setItem(key, value) {
      const remember = localStorage.getItem("vsas_remember_me") === "true";
      if (remember) {
        localStorage.setItem(key, value);
        sessionStorage.removeItem(key);
      } else {
        sessionStorage.setItem(key, value);
        localStorage.removeItem(key);
      }
    },
    removeItem(key) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    },
  };

  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: rememberAwareStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
})();