/**
 * Vertex AI Security Layer
 * ----------------------------------------------------------------------
 * Client-side security and input-safety primitives for Vertex AI.
 *
 * Responsibilities:
 * - Normalize user input
 * - Validate question length
 * - Validate supported roles
 * - Detect obviously unsafe input patterns
 * - Safely prepare text for the UI
 * - Provide security decisions to future modules
 * - Prevent accidental unsafe DOM rendering
 *
 * IMPORTANT:
 * This is NOT the final authorization boundary.
 *
 * Real authorization must eventually be enforced by:
 * - Supabase Authentication
 * - Supabase Row Level Security (RLS)
 * - Secure server-side/database policies
 *
 * This module must NEVER contain:
 * - API keys
 * - passwords
 * - service-role keys
 * - Supabase secrets
 * - AI provider credentials
 * ----------------------------------------------------------------------
 */

(function () {
  "use strict";

  const CONFIG = window.VertexAIConfig || {};

  const securityConfig = CONFIG.security || {};

  const MAX_QUESTION_LENGTH =
    Number(securityConfig.maxQuestionLength) > 0
      ? Number(securityConfig.maxQuestionLength)
      : 500;

  const MAX_MESSAGE_LENGTH =
    Number(CONFIG.conversation?.maxMessageLength) > 0
      ? Number(CONFIG.conversation.maxMessageLength)
      : 2000;

  const ALLOWED_ROLES = Array.isArray(securityConfig.allowedRoles)
    ? securityConfig.allowedRoles.map(normalizeRole)
    : [];

  /*
   * These patterns are NOT an authorization system.
   *
   * They are lightweight client-side checks intended to catch obvious
   * malformed or suspicious input before it reaches later modules.
   */
  const BLOCKED_PATTERNS = [
    /<\s*script\b/i,
    /javascript\s*:/i,
    /vbscript\s*:/i,
    /data\s*:\s*text\/html/i,
    /<\s*iframe\b/i,
    /<\s*object\b/i,
    /<\s*embed\b/i,
    /<\s*form\b/i
  ];

  /**
   * Normalize a role into a predictable lowercase representation.
   *
   * @param {*} role
   * @returns {string}
   */
  function normalizeRole(role) {
    if (typeof role !== "string") {
      return "";
    }

    return role
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
  }

  /**
   * Normalize user-provided text.
   *
   * This does NOT attempt to interpret or execute HTML.
   * It simply normalizes whitespace and Unicode representation.
   *
   * @param {*} value
   * @param {number} maxLength
   * @returns {string}
   */
  function normalizeText(value, maxLength) {
    if (value === null || value === undefined) {
      return "";
    }

    let text = String(value);

    /*
     * Normalize Unicode where supported.
     */
    if (typeof text.normalize === "function") {
      text = text.normalize("NFKC");
    }

    /*
     * Normalize line endings.
     */
    text = text.replace(/\r\n?/g, "\n");

    /*
     * Remove null characters and other C0 control characters while
     * preserving tabs and newlines.
     */
    text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");

    /*
     * Normalize excessive horizontal whitespace.
     */
    text = text.replace(/[ \t]+/g, " ");

    /*
     * Prevent an unnecessarily large number of blank lines.
     */
    text = text.replace(/\n{3,}/g, "\n\n");

    text = text.trim();

    if (Number.isFinite(maxLength) && maxLength > 0) {
      text = text.slice(0, maxLength);
    }

    return text;
  }

  /**
   * Check whether text contains an obviously unsafe pattern.
   *
   * @param {string} text
   * @returns {boolean}
   */
  function containsBlockedPattern(text) {
    if (!text) {
      return false;
    }

    return BLOCKED_PATTERNS.some(function (pattern) {
      return pattern.test(text);
    });
  }

  /**
   * Validate a question before it reaches the search/AI pipeline.
   *
   * @param {*} question
   * @returns {{
   *   valid: boolean,
   *   value: string,
   *   reason: string|null
   * }}
   */
  function validateQuestion(question) {
    const value = normalizeText(question, MAX_QUESTION_LENGTH);

    if (!value) {
      return {
        valid: false,
        value: "",
        reason: "empty_question"
      };
    }

    if (value.length > MAX_QUESTION_LENGTH) {
      return {
        valid: false,
        value,
        reason: "question_too_long"
      };
    }

    if (containsBlockedPattern(value)) {
      return {
        valid: false,
        value: "",
        reason: "unsafe_input"
      };
    }

    return {
      valid: true,
      value,
      reason: null
    };
  }

  /**
   * Validate a message before rendering or storing it.
   *
   * @param {*} message
   * @returns {{
   *   valid: boolean,
   *   value: string,
   *   reason: string|null
   * }}
   */
  function validateMessage(message) {
    const value = normalizeText(message, MAX_MESSAGE_LENGTH);

    if (!value) {
      return {
        valid: false,
        value: "",
        reason: "empty_message"
      };
    }

    if (containsBlockedPattern(value)) {
      return {
        valid: false,
        value: "",
        reason: "unsafe_message"
      };
    }

    return {
      valid: true,
      value,
      reason: null
    };
  }

  /**
   * Check whether a role is allowed to access Vertex AI.
   *
   * IMPORTANT:
   * This is only a client-side pre-check.
   * Supabase/backend authorization remains authoritative.
   *
   * @param {*} role
   * @returns {boolean}
   */
  function isRoleAllowed(role) {
    const normalizedRole = normalizeRole(role);

    if (!normalizedRole) {
      return false;
    }

    return ALLOWED_ROLES.includes(normalizedRole);
  }

  /**
   * Return a sanitized plain-text representation.
   *
   * The UI should use textContent when rendering this value.
   * This function intentionally does NOT return HTML.
   *
   * @param {*} value
   * @param {number} maxLength
   * @returns {string}
   */
  function sanitizeText(value, maxLength) {
    return normalizeText(
      value,
      Number.isFinite(maxLength) ? maxLength : MAX_MESSAGE_LENGTH
    );
  }

  /**
   * Safely create a text node.
   *
   * This provides future modules with a simple way to create safe
   * message content without using innerHTML.
   *
   * @param {*} value
   * @returns {Text}
   */
  function createSafeTextNode(value) {
    return document.createTextNode(
      sanitizeText(value, MAX_MESSAGE_LENGTH)
    );
  }

  /**
   * Safely set plain text on an element.
   *
   * @param {Element|null} element
   * @param {*} value
   * @returns {boolean}
   */
  function setSafeText(element, value) {
    if (!element || !(element instanceof Element)) {
      return false;
    }

    element.textContent = sanitizeText(value, MAX_MESSAGE_LENGTH);

    return true;
  }

  /**
   * Validate a message role.
   *
   * @param {*} role
   * @returns {"user"|"assistant"|"system"|null}
   */
  function validateMessageRole(role) {
    const normalizedRole = normalizeRole(role);

    if (
      normalizedRole === "user" ||
      normalizedRole === "assistant" ||
      normalizedRole === "system"
    ) {
      return normalizedRole;
    }

    return null;
  }

  /**
   * Return a safe security snapshot for future modules.
   */
  function getConfig() {
    return Object.freeze({
      requireAuthentication:
        securityConfig.requireAuthentication !== false,

      maxQuestionLength: MAX_QUESTION_LENGTH,

      maxMessageLength: MAX_MESSAGE_LENGTH,

      allowedRoles: Object.freeze([...ALLOWED_ROLES])
    });
  }

  /**
   * Generate a consistent security error object.
   *
   * @param {string} reason
   * @returns {{allowed: false, reason: string}}
   */
  function deny(reason) {
    return {
      allowed: false,
      reason: reason || "security_check_failed"
    };
  }

  /**
   * Basic client-side access check.
   *
   * Future authentication integration can provide a user object:
   *
   * {
   *   authenticated: true,
   *   role: "staff"
   * }
   *
   * This function deliberately does not trust arbitrary permissions
   * supplied by the UI as the final authorization decision.
   *
   * @param {Object} user
   * @returns {{allowed: boolean, reason: string}}
   */
  function checkAccess(user) {
    if (!user || typeof user !== "object") {
      if (securityConfig.requireAuthentication !== false) {
        return deny("authentication_required");
      }

      return {
        allowed: true,
        reason: null
      };
    }

    if (securityConfig.requireAuthentication !== false) {
      const authenticated =
        user.authenticated === true ||
        user.isAuthenticated === true;

      if (!authenticated) {
        return deny("authentication_required");
      }
    }

    /*
     * If authentication exists but no recognized role is available,
     * deny access rather than assuming permission.
     */
    const role = user.role || user.userRole || user.appRole;

    if (!isRoleAllowed(role)) {
      return deny("role_not_authorized");
    }

    return {
      allowed: true,
      reason: null
    };
  }

  /**
   * Public API.
   */
  window.VertexAISecurity = Object.freeze({
    normalizeRole,
    normalizeText,
    sanitizeText,
    validateQuestion,
    validateMessage,
    validateMessageRole,
    containsBlockedPattern,
    isRoleAllowed,
    createSafeTextNode,
    setSafeText,
    checkAccess,
    getConfig
  });

  if (
    CONFIG.development &&
    CONFIG.development.consoleLogging === true
  ) {
    console.info("[Vertex AI] Security module loaded.");
  }
})();