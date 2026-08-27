/**
 * service-worker.js
 * -----------------------------------------------------------------------
 * VSAS — PWA installability layer.
 *
 * Scope is intentionally minimal:
 *   - Enables "Add to Home Screen" / install prompts by providing a
 *     registered service worker with a fetch handler.
 *   - Caches a tiny, PUBLIC application shell (the marketing landing
 *     page + manifest + app icon) so an offline launch shows something
 *     branded instead of a browser error.
 *   - Uses a "stale-while-revalidate" cache ONLY for same-origin static
 *     assets (css/js/fonts/images), so repeat visits feel snappier.
 *
 * What it deliberately does NOT do:
 *   - It never caches or intercepts cross-origin requests. The Supabase
 *     REST/Realtime endpoints live on a different origin
 *     (*.supabase.co), so they are always skipped and always go
 *     straight to the network, untouched.
 *   - It never caches HTML pages other than the public index.html
 *     shell, so no authenticated/staff data (dashboards, attendance,
 *     notifications, reports, etc.) is ever written to the cache.
 *   - It never caches non-GET requests (POST/PUT/PATCH/DELETE).
 *   - It does not implement push notifications. The existing Supabase
 *     Realtime notification system in js/notifications.js is untouched
 *     and this worker never intercepts it.
 *
 * Bump CACHE_VERSION when you deploy changes so old caches are cleared.
 * -----------------------------------------------------------------------
 */

"use strict";

const CACHE_VERSION = "vsas-shell-v1";

/* Only public, non-sensitive files belong here. */
const PRECACHE_URLS = [
  "index.html",
  "manifest.json",
  "images/icons/icon-192.png",
];

/* Same-origin static assets eligible for stale-while-revalidate caching.
   Note: .html is intentionally excluded — page shells are always fetched
   fresh from the network so signed-in users never see stale app screens. */
const STATIC_ASSET_RE = /\.(?:css|js|png|jpg|jpeg|svg|gif|webp|ico|woff|woff2|ttf)$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => {
        /* Precaching is a nice-to-have; never block install on it. */
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name !== CACHE_VERSION)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  /* Only ever handle simple GETs. Everything else (auth calls, writes,
     Supabase mutations, etc.) is left completely untouched. */
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  /* Cross-origin requests — including every Supabase REST/Realtime call —
     are never intercepted, cached, or delayed. */
  if (url.origin !== self.location.origin) return;

  /* Page navigations: always try the network first so users get the
     current, authenticated app. Only fall back to the cached public
     landing page if the network is unreachable (offline). */
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("index.html").then((cached) => cached || Response.error())
      )
    );
    return;
  }

  /* Same-origin static assets: stale-while-revalidate. */
  if (STATIC_ASSET_RE.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_VERSION).then((cache) =>
        cache.match(request).then((cached) => {
          const networkFetch = fetch(request)
            .then((response) => {
              if (response && response.ok) {
                cache.put(request, response.clone());
              }
              return response;
            })
            .catch(() => cached);

          return cached || networkFetch;
        })
      )
    );
    return;
  }

  /* Anything else (e.g. manifest.json itself, unknown same-origin
     requests): let the browser handle it normally, untouched. */
});
