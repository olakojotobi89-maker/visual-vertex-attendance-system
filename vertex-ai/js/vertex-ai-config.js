/**
 * Vertex AI Configuration
 * ----------------------------------------------------------------------
 * Central configuration for the Vertex AI Assistant.
 *
 * This file contains configuration only.
 *
 * It does NOT:
 * - connect to Supabase
 * - perform AI requests
 * - contain API keys
 * - authenticate users
 * - search the knowledge base
 * - manipulate the DOM
 * - control voice playback
 *
 * Other Vertex AI modules consume this configuration.
 * ----------------------------------------------------------------------
 */

(function () {
  "use strict";

  /**
   * Prevent accidental mutation of nested configuration objects.
   */
  function deepFreeze(object) {
    Object.getOwnPropertyNames(object).forEach(function (property) {
      const value = object[property];

      if (
        value &&
        typeof value === "object" &&
        !Object.isFrozen(value)
      ) {
        deepFreeze(value);
      }
    });

    return Object.freeze(object);
  }

  /**
   * Vertex AI configuration.
   *
   * IMPORTANT:
   * Never place secrets, API keys, passwords, service-role keys,
   * private tokens, or other credentials in this file.
   */
  const config = {
    app: {
      name: "Vertex AI",
      companyName: "Visual Vertex Technology Company",
      moduleVersion: "1.0.0",
      environment: "development"
    },

    /**
     * UI-related configuration.
     */
    ui: {
      selectors: {
        root: "#vertex-ai-root",
        panel: "#vertex-ai-panel",
        launcher: "#vertex-ai-launcher",
        messages: "#vertex-ai-messages",
        input: "#vertex-ai-input",
        form: "#vertex-ai-input-form",
        typing: "#vertex-ai-typing-indicator"
      },

      behavior: {
        autoFocusInputOnOpen: true,
        autoScrollMessages: true,
        submitOnEnter: true,
        allowShiftEnterForNewLine: true,
        showWelcomeUntilFirstMessage: true
      }
    },

    /**
     * Knowledge engine configuration.
     *
     * These values will be consumed by vertex-ai-search.js later.
     */
    knowledge: {
      tableName: "vertex_ai_knowledge",
      categoriesTableName: "vertex_ai_categories",

      search: {
        maxResults: 5,
        minimumScore: 0.45,
        strongMatchScore: 0.75,

        /**
         * Maximum number of characters sent through the client-side
         * search pipeline at one time.
         */
        maxQueryLength: 500
      },

      categories: {
        company: "company",
        vsas: "vsas",
        internship: "internship",
        attendance: "attendance",
        departments: "departments",
        policies: "policies",
        notifications: "notifications",
        reports: "reports",
        support: "support"
      }
    },

    /**
     * Local cache configuration.
     *
     * This will be consumed by vertex-ai-cache.js.
     */
    cache: {
      enabled: true,

      /**
       * Frequently requested answers can be retained locally.
       */
      ttlMs: 15 * 60 * 1000,

      /**
       * Maximum cached question/answer entries.
       */
      maxEntries: 100,

      /**
       * Prefix prevents collisions with unrelated VSAS localStorage data.
       */
      storagePrefix: "vsas_vertex_ai_",

      /**
       * Cache version allows us to invalidate old cached structures
       * when the architecture changes.
       */
      version: 1
    },

    /**
     * Temporary development behavior.
     *
     * This is ONLY for the current interface-development stage.
     * It will be disabled when the real knowledge engine is connected.
     */
    development: {
      mockResponsesEnabled: true,
      mockResponseDelayMs: 650,
      consoleLogging: true
    },

    /**
     * Voice configuration.
     *
     * The actual voice implementation will live in
     * vertex-ai-voice.js.
     */
    voice: {
      enabled: true,

      /**
       * Browser speech synthesis is the Phase 1 fallback.
       *
       * A dedicated Visual Vertex voice provider can replace this later.
       */
      provider: "browser",

      autoSpeakResponses: false,

      speech: {
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0,

        /**
         * Empty string means use the browser's selected/default voice.
         *
         * We intentionally do not hard-code a browser voice because
         * available voices differ between devices.
         */
        voiceName: ""
      }
    },

    /**
     * Conversation configuration.
     */
    conversation: {
      maxMessageLength: 2000,
      maxMessagesPerConversation: 100,

      /**
       * Number of recent messages that future AI integration may use
       * as conversation context.
       */
      contextMessageLimit: 12
    },

    /**
     * Security-related configuration.
     *
     * This does NOT implement security.
     * vertex-ai-security.js will perform the actual checks.
     */
    security: {
      requireAuthentication: true,

      /**
       * Roles that are allowed to use the general Vertex AI assistant.
       *
       * These are intentionally configurable rather than hard-coded
       * throughout the application.
       */
      allowedRoles: [
        "admin",
        "administrator",
        "staff",
        "intern",
        "manager"
      ],

      /**
       * Maximum question size accepted by the UI pipeline.
       */
      maxQuestionLength: 500
    },

    /**
     * Future AI provider configuration.
     *
     * No provider is connected yet.
     *
     * DO NOT put API keys here.
     */
    ai: {
      enabled: false,
      provider: null,
      model: null
    }
  };

  const frozenConfig = deepFreeze(config);

  /**
   * Public Vertex AI configuration namespace.
   *
   * Other modules can read:
   *
   * window.VertexAIConfig.knowledge.search.maxResults
   *
   * but cannot modify the configuration.
   */
  window.VertexAIConfig = frozenConfig;

  /**
   * Optional development confirmation.
   *
   * Logging can be disabled through development.consoleLogging.
   */
  if (frozenConfig.development.consoleLogging) {
    console.info(
      "[Vertex AI] Configuration loaded:",
      frozenConfig.app.name,
      "v" + frozenConfig.app.moduleVersion
    );
  }
})();