/**
 * Vertex AI Cache
 * ----------------------------------------------------------------------
 * Lightweight client-side cache for frequently requested Vertex AI
 * knowledge responses.
 *
 * Responsibilities:
 * - Cache successful knowledge responses
 * - Return cached responses quickly
 * - Expire stale entries
 * - Limit cache size
 * - Normalize cache keys
 * - Persist cache between page loads when possible
 * - Provide invalidation and clearing methods
 *
 * NOT responsible for:
 * - AI requests
 * - Knowledge searching
 * - Supabase queries
 * - Authentication
 * - Authorization
 * - Voice
 * - UI rendering
 *
 * IMPORTANT:
 * Cached information must never be treated as an authorization boundary.
 * Sensitive or user-specific information should not be cached here.
 * ----------------------------------------------------------------------
 */

(function () {
  "use strict";

  const CONFIG = window.VertexAIConfig || {};
  const cacheConfig = CONFIG.cache || {};

  const ENABLED = cacheConfig.enabled !== false;

  const TTL_MS =
    Number(cacheConfig.ttlMs) > 0
      ? Number(cacheConfig.ttlMs)
      : 15 * 60 * 1000;

  const MAX_ENTRIES =
    Number(cacheConfig.maxEntries) > 0
      ? Number(cacheConfig.maxEntries)
      : 100;

  const STORAGE_PREFIX =
    typeof cacheConfig.storagePrefix === "string"
      ? cacheConfig.storagePrefix
      : "vsas_vertex_ai_";

  const CACHE_VERSION =
    Number(cacheConfig.version) > 0
      ? Number(cacheConfig.version)
      : 1;

  const STORAGE_KEY =
    STORAGE_PREFIX + "cache_v" + CACHE_VERSION;

  const memoryCache = new Map();

  let storageAvailable = false;

  /**
   * Determine whether localStorage is available.
   */
  function detectStorage() {
    try {
      const testKey = STORAGE_PREFIX + "__test__";

      window.localStorage.setItem(testKey, "1");
      window.localStorage.removeItem(testKey);

      return true;
    } catch (error) {
      return false;
    }
  }

  storageAvailable = detectStorage();

  /**
   * Normalize a question into a stable cache key.
   *
   * Example:
   *
   * "  How do I use VSAS? "
   *
   * becomes:
   *
   * "how do i use vsas?"
   */
  function normalizeKey(question) {
    if (question === null || question === undefined) {
      return "";
    }

    let value = String(question);

    if (typeof value.normalize === "function") {
      value = value.normalize("NFKC");
    }

    return value
      .replace(/\r\n?/g, "\n")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  /**
   * Read persisted cache from localStorage.
   */
  function loadPersistentCache() {
    if (!ENABLED || !storageAvailable) {
      return;
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw);

      if (!parsed || typeof parsed !== "object") {
        return;
      }

      const entries = Array.isArray(parsed.entries)
        ? parsed.entries
        : [];

      const now = Date.now();

      entries.forEach(function (entry) {
        if (!entry || typeof entry !== "object") {
          return;
        }

        if (
          typeof entry.key !== "string" ||
          !entry.key ||
          typeof entry.timestamp !== "number"
        ) {
          return;
        }

        if (now - entry.timestamp >= TTL_MS) {
          return;
        }

        memoryCache.set(entry.key, {
          value: entry.value,
          timestamp: entry.timestamp
        });
      });

      enforceLimit();
    } catch (error) {
      /*
       * Cache failure should never break Vertex AI.
       */
      memoryCache.clear();
    }
  }

  /**
   * Persist the current memory cache.
   */
  function persistCache() {
    if (!ENABLED || !storageAvailable) {
      return;
    }

    try {
      const entries = Array.from(memoryCache.entries()).map(
        function ([key, entry]) {
          return {
            key,
            value: entry.value,
            timestamp: entry.timestamp
          };
        }
      );

      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: CACHE_VERSION,
          entries
        })
      );
    } catch (error) {
      /*
       * Storage quota or privacy restrictions should not break the app.
       */
    }
  }

  /**
   * Remove expired entries.
   */
  function removeExpired() {
    if (!ENABLED) {
      return;
    }

    const now = Date.now();

    for (const [key, entry] of memoryCache.entries()) {
      if (
        !entry ||
        typeof entry.timestamp !== "number" ||
        now - entry.timestamp >= TTL_MS
      ) {
        memoryCache.delete(key);
      }
    }
  }

  /**
   * Enforce maximum cache size.
   *
   * The oldest entries are removed first.
   */
  function enforceLimit() {
    while (memoryCache.size > MAX_ENTRIES) {
      const oldestKey = memoryCache.keys().next().value;

      if (oldestKey === undefined) {
        break;
      }

      memoryCache.delete(oldestKey);
    }
  }

  /**
   * Store a response in cache.
   *
   * @param {string} question
   * @param {*} response
   * @returns {boolean}
   */
  function set(question, response) {
    if (!ENABLED) {
      return false;
    }

    const key = normalizeKey(question);

    if (!key) {
      return false;
    }

    /*
     * Move an existing entry to the end of the Map so it behaves
     * like a recently used item.
     */
    memoryCache.delete(key);

    memoryCache.set(key, {
      value: response,
      timestamp: Date.now()
    });

    enforceLimit();
    persistCache();

    return true;
  }

  /**
   * Retrieve a cached response.
   *
   * @param {string} question
   * @returns {*|null}
   */
  function get(question) {
    if (!ENABLED) {
      return null;
    }

    const key = normalizeKey(question);

    if (!key) {
      return null;
    }

    const entry = memoryCache.get(key);

    if (!entry) {
      return null;
    }

    if (
      typeof entry.timestamp !== "number" ||
      Date.now() - entry.timestamp >= TTL_MS
    ) {
      memoryCache.delete(key);
      persistCache();

      return null;
    }

    /*
     * Refresh insertion order.
     */
    memoryCache.delete(key);
    memoryCache.set(key, entry);

    return entry.value;
  }

  /**
   * Determine whether a valid cached response exists.
   *
   * @param {string} question
   * @returns {boolean}
   */
  function has(question) {
    return get(question) !== null;
  }

  /**
   * Remove a specific cached question.
   *
   * @param {string} question
   * @returns {boolean}
   */
  function remove(question) {
    const key = normalizeKey(question);

    if (!key) {
      return false;
    }

    const existed = memoryCache.delete(key);

    if (existed) {
      persistCache();
    }

    return existed;
  }

  /**
   * Clear the entire Vertex AI cache.
   */
  function clear() {
    memoryCache.clear();

    if (!storageAvailable) {
      return;
    }

    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      /*
       * Ignore storage errors.
       */
    }
  }

  /**
   * Remove expired entries and synchronize storage.
   */
  function cleanup() {
    if (!ENABLED) {
      return;
    }

    const before = memoryCache.size;

    removeExpired();

    if (memoryCache.size !== before) {
      persistCache();
    }
  }

  /**
   * Return cache statistics.
   */
  function getStats() {
    cleanup();

    return Object.freeze({
      enabled: ENABLED,
      size: memoryCache.size,
      maxEntries: MAX_ENTRIES,
      ttlMs: TTL_MS,
      storageAvailable
    });
  }

  /**
   * Return whether the cache is enabled.
   */
  function isEnabled() {
    return ENABLED;
  }

  /**
   * Initialize cache state.
   */
  function init() {
    if (!ENABLED) {
      return;
    }

    loadPersistentCache();
    cleanup();
  }

  /**
   * Public API.
   */
  window.VertexAICache = Object.freeze({
    init,
    get,
    set,
    has,
    remove,
    clear,
    cleanup,
    getStats,
    normalizeKey,
    isEnabled
  });

  init();

  if (
    CONFIG.development &&
    CONFIG.development.consoleLogging === true
  ) {
    console.info(
      "[Vertex AI] Cache module loaded.",
      getStats()
    );
  }
})();