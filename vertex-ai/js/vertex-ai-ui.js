"use strict";
/**
 * Vertex AI UI Controller
 * ----------------------------------------------------------------------
 * Controls the Vertex AI Assistant interface.
 *
 * IMPORTANT:
 * This file does NOT contain the AI engine or knowledge base.
 *
 * It sends user questions to:
 *
 *      VertexAI.processQuestion()
 *
 * The main orchestrator then connects to:
 *
 *      VertexAIResponseEngine
 *
 * ----------------------------------------------------------------------
 */

(function () {
  "use strict";

  const SELECTORS = {
    root: "#vertex-ai-root",
    overlay: "#vertex-ai-overlay",
    launcher: "#vertex-ai-launcher",
    panel: "#vertex-ai-panel",
    minimize: "#vertex-ai-minimize",
    close: "#vertex-ai-close",
    messages: "#vertex-ai-messages",
    welcome: "#vertex-ai-welcome",
    typing: "#vertex-ai-typing-indicator",
    form: "#vertex-ai-input-form",
    input: "#vertex-ai-input",
    send: "#vertex-ai-send"
  };

  const CLOSE_TRANSITION_MS = 220;

  let elements = null;
  let initialized = false;
  let closeTimer = null;

  /**
   * --------------------------------------------------------------------
   * Resolve DOM elements
   * --------------------------------------------------------------------
   */

  function resolveElements() {
    const root = document.querySelector(SELECTORS.root);

    if (!root) {
      return null;
    }

    return {
      root,
      overlay: root.querySelector(SELECTORS.overlay),
      launcher: root.querySelector(SELECTORS.launcher),
      panel: root.querySelector(SELECTORS.panel),
      minimize: root.querySelector(SELECTORS.minimize),
      close: root.querySelector(SELECTORS.close),
      messages: root.querySelector(SELECTORS.messages),
      welcome: root.querySelector(SELECTORS.welcome),
      typing: root.querySelector(SELECTORS.typing),
      form: root.querySelector(SELECTORS.form),
      input: root.querySelector(SELECTORS.input),
      send: root.querySelector(SELECTORS.send)
    };
  }

  /**
   * --------------------------------------------------------------------
   * Required elements
   * --------------------------------------------------------------------
   */

  function hasRequiredElements() {
    return Boolean(
      elements &&
      elements.root &&
      elements.panel &&
      elements.launcher &&
      elements.form &&
      elements.input &&
      elements.messages
    );
  }

  /**
   * --------------------------------------------------------------------
   * Panel state
   * --------------------------------------------------------------------
   */

  function setPanelState(isOpen) {
    if (!elements || !elements.panel || !elements.launcher) {
      return;
    }

    elements.panel.setAttribute(
      "data-vertex-ai-state",
      isOpen ? "open" : "closed"
    );

    elements.panel.setAttribute(
      "aria-hidden",
      isOpen ? "false" : "true"
    );

    elements.launcher.setAttribute(
      "aria-expanded",
      isOpen ? "true" : "false"
    );
  }

  /**
   * --------------------------------------------------------------------
   * Open assistant
   * --------------------------------------------------------------------
   */

  function open() {
    if (!hasRequiredElements()) {
      return;
    }

    if (closeTimer) {
      window.clearTimeout(closeTimer);
      closeTimer = null;
    }

    elements.panel.hidden = false;

    if (elements.overlay) {
      elements.overlay.hidden = false;
      elements.overlay.setAttribute("aria-hidden", "false");
    }

    setPanelState(true);

    window.requestAnimationFrame(function () {
      if (elements.input) {
        elements.input.focus({ preventScroll: true });
      }
    });
  }

  /**
   * --------------------------------------------------------------------
   * Close assistant
   * --------------------------------------------------------------------
   */

  function close() {
    if (!hasRequiredElements()) {
      return;
    }

    if (closeTimer) {
      window.clearTimeout(closeTimer);
    }

    setPanelState(false);

    if (elements.overlay) {
      elements.overlay.setAttribute("aria-hidden", "true");
    }

    closeTimer = window.setTimeout(function () {
      if (!elements || !elements.panel) {
        return;
      }

      elements.panel.hidden = true;

      if (elements.overlay) {
        elements.overlay.hidden = true;
      }

      closeTimer = null;
    }, CLOSE_TRANSITION_MS);
  }

  /**
   * --------------------------------------------------------------------
   * Toggle assistant
   * --------------------------------------------------------------------
   */

  function toggle() {
    if (!hasRequiredElements()) {
      return;
    }

    const isOpen =
      elements.panel.getAttribute("data-vertex-ai-state") === "open";

    if (isOpen) {
      close();
    } else {
      open();
    }
  }

  /**
   * --------------------------------------------------------------------
   * Minimize assistant
   * --------------------------------------------------------------------
   */

  function minimize() {
    close();
  }

  /**
   * --------------------------------------------------------------------
   * Create message safely
   * --------------------------------------------------------------------
   */

  function createMessageElement(role, text) {
    const message = document.createElement("div");

    const normalizedRole = [
      "user",
      "assistant",
      "system"
    ].includes(role)
      ? role
      : "system";

    message.className =
      "vertex-ai-message vertex-ai-message--" +
      normalizedRole;

    message.setAttribute(
      "data-vertex-ai-message-role",
      normalizedRole
    );

    const content = document.createElement("div");

    content.className =
      "vertex-ai-message-content";

    /*
     * SECURITY:
     * Never use innerHTML for AI/user generated text.
     */

    content.textContent = String(text ?? "");

    message.appendChild(content);

    return message;
  }

  /**
   * --------------------------------------------------------------------
   * Add message
   * --------------------------------------------------------------------
   */

  function addMessage(role, text) {
    if (!elements || !elements.messages) {
      return null;
    }

    const message =
      createMessageElement(role, text);

    elements.messages.appendChild(message);

    if (elements.welcome) {
      elements.welcome.hidden = true;
    }

    scrollToLatest();

    return message;
  }

  /**
   * --------------------------------------------------------------------
   * Clear conversation
   * --------------------------------------------------------------------
   */

  function clearConversation() {
    if (!elements || !elements.messages) {
      return;
    }

    elements.messages.replaceChildren();

    if (elements.welcome) {
      elements.welcome.hidden = false;
    }

    hideTyping();
  }

  /**
   * --------------------------------------------------------------------
   * Typing indicator
   * --------------------------------------------------------------------
   */

  function showTyping() {
    if (!elements || !elements.typing) {
      return;
    }

    elements.typing.hidden = false;

    scrollToLatest();
  }

  function hideTyping() {
    if (!elements || !elements.typing) {
      return;
    }

    elements.typing.hidden = true;
  }

  /**
   * --------------------------------------------------------------------
   * Scroll conversation
   * --------------------------------------------------------------------
   */

  function scrollToLatest() {
    if (!elements || !elements.messages) {
      return;
    }

    window.requestAnimationFrame(function () {
      elements.messages.scrollTop =
        elements.messages.scrollHeight;
    });
  }

  /**
   * --------------------------------------------------------------------
   * Send button state
   * --------------------------------------------------------------------
   */

  function updateSendState() {
    if (!elements || !elements.input) {
      return;
    }

    const hasText =
      elements.input.value.trim().length > 0;

    if (elements.send) {
      elements.send.disabled = !hasText;
    }
  }

  /**
   * --------------------------------------------------------------------
   * Get Main Vertex AI Controller
   * --------------------------------------------------------------------
   */

  function getVertexAI() {
    if (
      window.VertexAI &&
      typeof window.VertexAI.processQuestion === "function"
    ) {
      return window.VertexAI;
    }

    return null;
  }

  /**
   * --------------------------------------------------------------------
   * Submit real AI question
   * --------------------------------------------------------------------
   *
   * IMPORTANT:
   *
   * The old version of this file used a fake response:
   *
   * "Vertex AI knowledge retrieval is not connected yet..."
   *
   * That behavior has been completely removed.
   *
   * Questions are now sent to:
   *
   *      VertexAI.processQuestion()
   *
   * which connects to the real Response Engine.
   */

  async function submitQuestion(question) {
    const cleanQuestion =
      String(question || "").trim();

    if (!cleanQuestion) {
      return;
    }

    const vertexAI = getVertexAI();

    /*
     * If the main orchestrator isn't ready yet,
     * do not pretend that an AI response exists.
     */

    if (!vertexAI) {
      console.error(
        "[Vertex AI UI] Main VertexAI controller is not available."
      );

      hideTyping();

      addMessage(
        "system",
        "Vertex AI is still initializing. Please try again in a moment."
      );

      return;
    }

    /*
     * The orchestrator handles adding the user message,
     * typing indicator, knowledge retrieval and assistant response.
     */

    try {
      await vertexAI.processQuestion(
        cleanQuestion
      );
    } catch (error) {
      console.error(
        "[Vertex AI UI] Question processing failed:",
        error
      );

      hideTyping();

      addMessage(
        "system",
        "Vertex AI encountered a temporary problem while processing your question."
      );
    }
  }

  /**
   * --------------------------------------------------------------------
   * Form submission
   * --------------------------------------------------------------------
   */

  function handleFormSubmit(event) {
    event.preventDefault();

    if (!elements || !elements.input) {
      return;
    }

    const question =
      elements.input.value.trim();

    if (!question) {
      updateSendState();
      return;
    }

    /*
     * Clear the input immediately.
     */

    elements.input.value = "";

    updateSendState();

    /*
     * Send question to the real Vertex AI controller.
     */

    submitQuestion(question);
  }

  /**
   * --------------------------------------------------------------------
   * Keyboard behavior
   * --------------------------------------------------------------------
   */

  function handleInputKeydown(event) {
    if (event.key !== "Enter") {
      return;
    }

    /*
     * Shift + Enter creates a new line.
     */

    if (event.shiftKey) {
      return;
    }

    event.preventDefault();

    if (elements && elements.form) {
      elements.form.requestSubmit();
    }
  }

  /**
   * --------------------------------------------------------------------
   * Suggested question
   * --------------------------------------------------------------------
   */

  function handleSuggestion(button) {
    if (
      !elements ||
      !elements.input ||
      !elements.form ||
      !button
    ) {
      return;
    }

    /*
     * Prefer an explicit question attribute if provided.
     */

    const question =
      button.getAttribute(
        "data-question"
      ) ||
      button.textContent.trim();

    if (!question) {
      return;
    }

    elements.input.value = question;

    updateSendState();

    elements.form.requestSubmit();
  }

  /**
   * --------------------------------------------------------------------
   * Root click delegation
   * --------------------------------------------------------------------
   */

  function handleRootClick(event) {
    const target = event.target;

    if (!target || typeof target.closest !== "function") {
      return;
    }

    const actionElement =
      target.closest(
        "[data-vertex-ai-action]"
      );

    if (
      !actionElement ||
      !elements.root.contains(actionElement)
    ) {
      return;
    }

    const action =
      actionElement.getAttribute(
        "data-vertex-ai-action"
      );

    switch (action) {

      case "toggle-panel":
        toggle();
        break;

      case "close":
        close();
        break;

      case "minimize":
        minimize();
        break;

      case "ask-suggestion":
        handleSuggestion(actionElement);
        break;

      /*
       * Voice controls are handled by the
       * dedicated voice module.
       */

      case "toggle-voice":
      case "play-voice":
      case "stop-voice":
        break;

      default:
        break;
    }
  }

  /**
   * --------------------------------------------------------------------
   * Escape key
   * --------------------------------------------------------------------
   */

  function handleDocumentKeydown(event) {
    if (event.key !== "Escape") {
      return;
    }

    if (!elements || !elements.panel) {
      return;
    }

    const isOpen =
      elements.panel.getAttribute(
        "data-vertex-ai-state"
      ) === "open";

    if (!isOpen) {
      return;
    }

    event.preventDefault();

    close();
  }

  /**
   * --------------------------------------------------------------------
   * Initialize UI
   * --------------------------------------------------------------------
   */

  function init() {
    if (initialized) {
      return window.VertexAIUI;
    }

    elements =
      resolveElements();

    if (!hasRequiredElements()) {
      console.warn(
        "[Vertex AI] UI initialization skipped: required elements were not found."
      );

      return null;
    }

    /*
     * Initial closed state.
     */

    elements.panel.hidden = true;

    setPanelState(false);

    if (elements.overlay) {
      elements.overlay.hidden = true;

      elements.overlay.setAttribute(
        "aria-hidden",
        "true"
      );
    }

    updateSendState();

    /*
     * UI events.
     */

    elements.root.addEventListener(
      "click",
      handleRootClick
    );

    elements.form.addEventListener(
      "submit",
      handleFormSubmit
    );

    elements.input.addEventListener(
      "keydown",
      handleInputKeydown
    );

    elements.input.addEventListener(
      "input",
      updateSendState
    );

    document.addEventListener(
      "keydown",
      handleDocumentKeydown
    );

    initialized = true;

    console.info(
      "[Vertex AI] UI controller initialized."
    );

    return window.VertexAIUI;
  }

  /**
   * --------------------------------------------------------------------
   * Public API
   * --------------------------------------------------------------------
   */

  window.VertexAIUI = {
    init,
    open,
    close,
    toggle,
    minimize,
    addMessage,
    showTyping,
    hideTyping,
    clearConversation,
    scrollToLatest
  };

  /**
   * --------------------------------------------------------------------
   * Auto initialization
   * --------------------------------------------------------------------
   */

  if (
    document.readyState === "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );

  } else {

    init();

  }

})();
