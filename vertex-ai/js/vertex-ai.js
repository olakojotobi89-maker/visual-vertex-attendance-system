/**
 * Vertex AI Assistant — Main Orchestrator
 * ----------------------------------------------------------------------
 * Central controller for the internal Vertex AI assistant.
 *
 * This module connects:
 *
 *   vertex-ai-ui.js
 *          ↓
 *   vertex-ai-security.js
 *          ↓
 *   vertex-ai-cache.js
 *          ↓
 *   vertex-ai-search.js
 *          ↓
 *   vertex-ai-voice.js
 *
 * This is the orchestration layer.
 *
 * It does NOT:
 * - contain API keys
 * - make external AI calls
 * - directly query Supabase
 * - implement authentication
 * - implement RLS
 * - contain the knowledge database
 * - implement the voice provider
 *
 * Those responsibilities belong to their respective modules.
 * ----------------------------------------------------------------------
 */

(function () {
  "use strict";

  const CONFIG = window.VertexAIConfig || {};

  const assistantConfig = CONFIG.assistant || {};

  const MOCK_DELAY_MS =
    Number(assistantConfig.mockResponseDelayMs) >= 0
      ? Number(assistantConfig.mockResponseDelayMs)
      : 450;

  const MAX_QUESTION_LENGTH =
    Number(assistantConfig.maxQuestionLength) > 0
      ? Number(assistantConfig.maxQuestionLength)
      : 500;

  const UNKNOWN_RESPONSE =
    assistantConfig.unknownResponse ||
    "I could not find an approved answer to that question in the current Vertex AI knowledge base.";

  const TEMPORARY_RESPONSE =
    "Vertex AI knowledge retrieval is connected in development mode. " +
    "The interface is ready for the production company knowledge engine.";

  let initialized = false;
  let busy = false;
  let lastAssistantResponse = "";
  let responseTimer = null;

  /**
   * --------------------------------------------------------------------
   * Module availability helpers
   * --------------------------------------------------------------------
   */

  function getUI() {
    return window.VertexAIUI || null;
  }

  function getSecurity() {
    return window.VertexAISecurity || null;
  }

  function getCache() {
    return window.VertexAICache || null;
  }

  function getSearch() {
    return window.VertexAISearch || null;
  }

  function getVoice() {
    return window.VertexAIVoice || null;
  }

  /**
   * --------------------------------------------------------------------
   * Question validation
   * --------------------------------------------------------------------
   */

  function validateQuestion(question) {
    const security = getSecurity();

    if (security && typeof security.validateQuestion === "function") {
      const result = security.validateQuestion(question);

      if (!result || result.valid !== true) {
        return {
          valid: false,
          value: "",
          reason:
            result && result.reason
              ? result.reason
              : "Question failed validation."
        };
      }

      return {
        valid: true,
        value: String(result.value).slice(
          0,
          MAX_QUESTION_LENGTH
        )
      };
    }

    const value = String(question || "")
      .trim()
      .slice(0, MAX_QUESTION_LENGTH);

    if (!value) {
      return {
        valid: false,
        value: "",
        reason: "Question is empty."
      };
    }

    return {
      valid: true,
      value
    };
  }

  /**
   * --------------------------------------------------------------------
   * Cache lookup
   * --------------------------------------------------------------------
   */

  function getCachedAnswer(question) {
    const cache = getCache();

    if (!cache || typeof cache.get !== "function") {
      return null;
    }

    const cached = cache.get(question);

    if (cached === null || cached === undefined) {
      return null;
    }

    if (
      typeof cached === "object" &&
      cached !== null &&
      Object.prototype.hasOwnProperty.call(cached, "answer")
    ) {
      return cached.answer || null;
    }

    return typeof cached === "string"
      ? cached
      : null;
  }

  /**
   * --------------------------------------------------------------------
   * Search knowledge
   * --------------------------------------------------------------------
   */

  function retrieveKnowledge(question) {
    const search = getSearch();

    if (!search) {
      return null;
    }

    if (typeof search.retrieve === "function") {
      return search.retrieve(question);
    }

    if (typeof search.findBestMatch === "function") {
      const result = search.findBestMatch(question);

      if (!result) {
        return null;
      }

      return {
        source: "knowledge",
        cached: false,
        query: question,
        answer: result.content,
        result
      };
    }

    return null;
  }

  /**
   * --------------------------------------------------------------------
   * Generate temporary development response
   * --------------------------------------------------------------------
   *
   * This exists only until the production AI/knowledge generation layer
   * is connected.
   */

  function createTemporaryResponse(question, retrieval) {
    /*
     * If the local knowledge search found an approved answer,
     * return that answer.
     */
    if (
      retrieval &&
      typeof retrieval.answer === "string" &&
      retrieval.answer.trim()
    ) {
      return retrieval.answer.trim();
    }

    /*
     * Clearly marked development fallback.
     *
     * This must never pretend to be a real AI-generated answer.
     */
    if (CONFIG.development && CONFIG.development.mockResponses === true) {
      return TEMPORARY_RESPONSE;
    }

    return UNKNOWN_RESPONSE;
  }

  /**
   * --------------------------------------------------------------------
   * Voice
   * --------------------------------------------------------------------
   */

  function speakResponse(text) {
    const voice = getVoice();

    if (!voice || typeof voice.speak !== "function") {
      return false;
    }

    if (
      typeof voice.voiceEnabled === "function" &&
      !voice.voiceEnabled()
    ) {
      return false;
    }

    return voice.speak(text);
  }

  /**
   * --------------------------------------------------------------------
   * Add assistant message
   * --------------------------------------------------------------------
   */

  function addAssistantMessage(text) {
    const ui = getUI();

    if (!ui || typeof ui.addMessage !== "function") {
      return false;
    }

    ui.addMessage("assistant", text);

    lastAssistantResponse = text;

    return true;
  }

  /**
   * --------------------------------------------------------------------
   * Add user message
   * --------------------------------------------------------------------
   */

  function addUserMessage(text) {
    const ui = getUI();

    if (!ui || typeof ui.addMessage !== "function") {
      return false;
    }

    ui.addMessage("user", text);

    return true;
  }

  /**
   * --------------------------------------------------------------------
   * Typing indicator
   * --------------------------------------------------------------------
   */

  function showTyping() {
    const ui = getUI();

    if (ui && typeof ui.showTyping === "function") {
      ui.showTyping();
    }
  }

  function hideTyping() {
    const ui = getUI();

    if (ui && typeof ui.hideTyping === "function") {
      ui.hideTyping();
    }
  }

  /**
   * --------------------------------------------------------------------
   * Update assistant status
   * --------------------------------------------------------------------
   */

  function setStatus(status) {
    const root = document.querySelector("#vertex-ai-root");

    if (!root) {
      return;
    }

    const statusElement =
      root.querySelector("#vertex-ai-status");

    if (!statusElement) {
      return;
    }

    /*
     * Status strings originate internally.
     * textContent prevents HTML injection.
     */
    statusElement.textContent = String(status || "");
  }

  /**
   * --------------------------------------------------------------------
   * Process a question
   * --------------------------------------------------------------------
   */

  function processQuestion(question) {
    if (busy) {
      return Promise.resolve(false);
    }

    const validation = validateQuestion(question);

    if (!validation.valid) {
      const ui = getUI();

      if (
        ui &&
        typeof ui.addMessage === "function"
      ) {
        ui.addMessage(
          "system",
          validation.reason || "Please enter a valid question."
        );
      }

      return Promise.resolve(false);
    }

    const cleanQuestion = validation.value;

    busy = true;

    addUserMessage(cleanQuestion);

    showTyping();
    setStatus("Searching approved knowledge...");

    /*
     * Give the browser a chance to render the user message and typing
     * indicator before doing retrieval work.
     */
    return new Promise(function (resolve) {
      responseTimer = window.setTimeout(function () {
        try {
          /*
           * ----------------------------------------------------------
           * STEP 1 — Cache
           * ----------------------------------------------------------
           */

          const cachedAnswer =
            getCachedAnswer(cleanQuestion);

          if (cachedAnswer) {
            finishResponse(
              cachedAnswer,
              "Answered from cache"
            );

            resolve(true);
            return;
          }

          /*
           * ----------------------------------------------------------
           * STEP 2 — Knowledge retrieval
           * ----------------------------------------------------------
           */

          const retrieval =
            retrieveKnowledge(cleanQuestion);

          const answer =
            createTemporaryResponse(
              cleanQuestion,
              retrieval
            );

          /*
           * ----------------------------------------------------------
           * STEP 3 — Store successful answer
           * ----------------------------------------------------------
           */

          if (
            retrieval &&
            retrieval.answer &&
            getCache() &&
            typeof getCache().set === "function"
          ) {
            getCache().set(cleanQuestion, {
              answer,
              result: retrieval.result || null
            });
          }

          finishResponse(
            answer,
            retrieval && retrieval.result
              ? "Answered from approved knowledge"
              : "Knowledge match not found"
          );

          resolve(true);
        } catch (error) {
          console.error(
            "[Vertex AI] Response processing error:",
            error
          );

          finishResponse(
            "Vertex AI encountered a temporary problem while processing that question.",
            "Temporary error"
          );

          resolve(false);
        }
      }, MOCK_DELAY_MS);
    });
  }

  /**
   * --------------------------------------------------------------------
   * Finish response
   * --------------------------------------------------------------------
   */

  function finishResponse(answer, status) {
    hideTyping();

    setStatus(status || "Ready to help");

    addAssistantMessage(answer);

    /*
     * Voice is deliberately optional.
     */
    speakResponse(answer);

    busy = false;
    responseTimer = null;
  }

  /**
   * --------------------------------------------------------------------
   * Stop current processing
   * --------------------------------------------------------------------
   */

  function cancelPendingResponse() {
    if (responseTimer !== null) {
      window.clearTimeout(responseTimer);
      responseTimer = null;
    }

    hideTyping();

    busy = false;

    setStatus("Ready to help");
  }

  /**
   * --------------------------------------------------------------------
   * Replay last assistant response
   * --------------------------------------------------------------------
   */

  function replayLastResponse() {
    if (!lastAssistantResponse) {
      return false;
    }

    const voice = getVoice();

    if (!voice) {
      return false;
    }

    if (typeof voice.replay === "function") {
      return voice.replay();
    }

    if (typeof voice.speak === "function") {
      return voice.speak(lastAssistantResponse);
    }

    return false;
  }

  /**
   * --------------------------------------------------------------------
   * Clear conversation
   * --------------------------------------------------------------------
   */

  function clearConversation() {
    cancelPendingResponse();

    lastAssistantResponse = "";

    const ui = getUI();

    if (ui && typeof ui.clearConversation === "function") {
      ui.clearConversation();
    }

    setStatus("Ready to help");
  }

  /**
   * --------------------------------------------------------------------
   * Open assistant
   * --------------------------------------------------------------------
   */

  function open() {
    const ui = getUI();

    if (ui && typeof ui.open === "function") {
      ui.open();
    }
  }

  /**
   * --------------------------------------------------------------------
   * Close assistant
   * --------------------------------------------------------------------
   */

  function close() {
    const ui = getUI();

    if (ui && typeof ui.close === "function") {
      ui.close();
    }
  }

  /**
   * --------------------------------------------------------------------
   * Toggle assistant
   * --------------------------------------------------------------------
   */

  function toggle() {
    const ui = getUI();

    if (ui && typeof ui.toggle === "function") {
      ui.toggle();
    }
  }

  /**
   * --------------------------------------------------------------------
   * Get state
   * --------------------------------------------------------------------
   */

  function getState() {
    return Object.freeze({
      initialized,
      busy,
      hasLastResponse: Boolean(lastAssistantResponse),
      modules: Object.freeze({
        ui: Boolean(getUI()),
        security: Boolean(getSecurity()),
        cache: Boolean(getCache()),
        search: Boolean(getSearch()),
        voice: Boolean(getVoice())
      })
    });
  }

  /**
   * --------------------------------------------------------------------
   * Initialize
   * --------------------------------------------------------------------
   */

  function init() {
    if (initialized) {
      return getState();
    }

    /*
     * Initialize supporting modules if they expose init().
     */
    const cache = getCache();

    if (
      cache &&
      typeof cache.init === "function"
    ) {
      cache.init();
    }

    const voice = getVoice();

    if (
      voice &&
      typeof voice.init === "function"
    ) {
      voice.init();
    }

    const ui = getUI();

    if (
      ui &&
      typeof ui.init === "function"
    ) {
      ui.init({
        onSubmit: processQuestion
      });
    }

    initialized = true;

    setStatus("Ready to help");

    if (
      CONFIG.development &&
      CONFIG.development.consoleLogging === true
    ) {
      console.info(
        "[Vertex AI] Main orchestrator initialized.",
        getState()
      );
    }

    return getState();
  }

  /**
   * --------------------------------------------------------------------
   * Public API
   * --------------------------------------------------------------------
   */

  window.VertexAI = Object.freeze({
    init,
    open,
    close,
    toggle,
    processQuestion,
    clearConversation,
    cancelPendingResponse,
    replayLastResponse,
    getState
  });

  /*
   * Initialize when the script is loaded.
   */
  init();
})();