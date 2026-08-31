/**
 * Vertex AI UI Controller
 * ----------------------------------------------------------------------
 * UI-only controller for the global Vertex AI Assistant.
 *
 * Responsibilities:
 * - Open / close / minimize the assistant
 * - Handle launcher, overlay, close and minimize controls
 * - Handle suggested questions
 * - Render messages safely
 * - Handle the input form
 * - Show / hide typing indicator
 * - Auto-scroll conversation
 * - Provide a small public API for future Vertex AI modules
 *
 * NOT responsible for:
 * - AI/API calls
 * - Supabase
 * - Knowledge-base search
 * - Authentication
 * - RLS
 * - Caching
 * - Voice synthesis
 *
 * The temporary mock response exists ONLY for interface testing and
 * must be replaced by the future knowledge/AI controller.
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
  const MOCK_RESPONSE_DELAY_MS = 650;

  let elements = null;
  let initialized = false;
  let closeTimer = null;
  let mockResponseTimer = null;

  /**
   * Resolve all required DOM elements.
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
   * Check that the minimum interface exists.
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
   * Update the panel state and accessibility attributes.
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
   * Open the Vertex AI panel.
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
   * Close the Vertex AI panel.
   *
   * The data state changes immediately so CSS can animate the closing state.
   * The hidden attribute is applied shortly afterward.
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
   * Toggle the panel.
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
   * Minimize the assistant without clearing the conversation.
   *
   * For the current UI, minimize returns the panel to its closed state.
   * Conversation DOM remains untouched.
   */
  function minimize() {
    close();
  }

  /**
   * Safely create a message element.
   *
   * User-controlled text is inserted with textContent, never innerHTML.
   */
  function createMessageElement(role, text) {
    const message = document.createElement("div");

    const normalizedRole = ["user", "assistant", "system"].includes(role)
      ? role
      : "system";

    message.className =
      "vertex-ai-message vertex-ai-message--" + normalizedRole;

    message.setAttribute("data-vertex-ai-message-role", normalizedRole);

    const content = document.createElement("div");
    content.className = "vertex-ai-message-content";
    content.textContent = String(text ?? "");

    message.appendChild(content);

    return message;
  }

  /**
   * Add a message to the conversation.
   *
   * @param {"user"|"assistant"|"system"} role
   * @param {string} text
   * @returns {HTMLElement|null}
   */
  function addMessage(role, text) {
    if (!elements || !elements.messages) {
      return null;
    }

    const message = createMessageElement(role, text);

    elements.messages.appendChild(message);

    if (elements.welcome) {
      elements.welcome.hidden = true;
    }

    scrollToLatest();

    return message;
  }

  /**
   * Clear all conversation messages.
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
   * Show the typing indicator.
   */
  function showTyping() {
    if (!elements || !elements.typing) {
      return;
    }

    elements.typing.hidden = false;
    scrollToLatest();
  }

  /**
   * Hide the typing indicator.
   */
  function hideTyping() {
    if (!elements || !elements.typing) {
      return;
    }

    elements.typing.hidden = true;
  }

  /**
   * Scroll the conversation area to the newest content.
   */
  function scrollToLatest() {
    if (!elements || !elements.messages) {
      return;
    }

    window.requestAnimationFrame(function () {
      elements.messages.scrollTop = elements.messages.scrollHeight;
    });
  }

  /**
   * Enable/disable the send button according to input content.
   */
  function updateSendState() {
    if (!elements || !elements.input || !elements.send) {
      return;
    }

    const hasText = elements.input.value.trim().length > 0;

    elements.send.disabled = !hasText;
  }

  /**
   * Temporarily respond to a submitted question.
   *
   * THIS IS ONLY A UI TEST RESPONSE.
   * The future Vertex AI controller will replace this mechanism.
   */
  function submitMockQuestion(question) {
    const cleanQuestion = String(question || "").trim();

    if (!cleanQuestion) {
      return;
    }

    addMessage("user", cleanQuestion);

    elements.input.value = "";
    updateSendState();

    showTyping();

    if (mockResponseTimer) {
      window.clearTimeout(mockResponseTimer);
    }

    mockResponseTimer = window.setTimeout(function () {
      hideTyping();

      addMessage(
        "assistant",
        "Vertex AI knowledge retrieval is not connected yet. " +
        "This interface is ready for the knowledge engine."
      );

      mockResponseTimer = null;
    }, MOCK_RESPONSE_DELAY_MS);
  }

  /**
   * Handle form submission.
   */
  function handleFormSubmit(event) {
    event.preventDefault();

    if (!elements || !elements.input) {
      return;
    }

    const question = elements.input.value.trim();

    if (!question) {
      updateSendState();
      return;
    }

    submitMockQuestion(question);
  }

  /**
   * Handle textarea keyboard behavior.
   *
   * Enter submits.
   * Shift + Enter creates a new line.
   */
  function handleInputKeydown(event) {
    if (event.key !== "Enter") {
      return;
    }

    if (event.shiftKey) {
      return;
    }

    event.preventDefault();

    if (elements && elements.form) {
      elements.form.requestSubmit();
    }
  }

  /**
   * Handle suggested question buttons.
   */
  function handleSuggestion(button) {
    if (!elements || !elements.input || !button) {
      return;
    }

    const question = button.textContent.trim();

    if (!question) {
      return;
    }

    elements.input.value = question;
    updateSendState();

    elements.form.requestSubmit();
  }

  /**
   * Central delegated click handler.
   */
  function handleRootClick(event) {
    const actionElement = event.target.closest("[data-vertex-ai-action]");

    if (!actionElement || !elements.root.contains(actionElement)) {
      return;
    }

    const action = actionElement.getAttribute("data-vertex-ai-action");

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
       * Voice actions are intentionally not implemented here.
       * vertex-ai-voice.js will handle them later.
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
   * Handle global keyboard interactions.
   *
   * Escape only affects Vertex AI when the panel is open.
   */
  function handleDocumentKeydown(event) {
    if (event.key !== "Escape") {
      return;
    }

    if (!elements || !elements.panel) {
      return;
    }

    const isOpen =
      elements.panel.getAttribute("data-vertex-ai-state") === "open";

    if (!isOpen) {
      return;
    }

    event.preventDefault();
    close();
  }

  /**
   * Initialize the UI.
   */
  function init() {
    if (initialized) {
      return window.VertexAIUI;
    }

    elements = resolveElements();

    if (!hasRequiredElements()) {
      console.warn(
        "[Vertex AI] UI initialization skipped: required elements were not found."
      );

      return null;
    }

    /*
     * Establish the initial closed state without changing the HTML file.
     */
    elements.panel.hidden = true;
    setPanelState(false);

    if (elements.overlay) {
      elements.overlay.hidden = true;
      elements.overlay.setAttribute("aria-hidden", "true");
    }

    updateSendState();

    /*
     * One delegated listener handles all Vertex AI action buttons.
     */
    elements.root.addEventListener("click", handleRootClick);

    /*
     * Form submission.
     */
    elements.form.addEventListener("submit", handleFormSubmit);

    /*
     * Keyboard input.
     */
    elements.input.addEventListener("keydown", handleInputKeydown);

    /*
     * Keep send button state synchronized.
     */
    elements.input.addEventListener("input", updateSendState);

    /*
     * Escape handling is attached once at document level.
     */
    document.addEventListener("keydown", handleDocumentKeydown);

    initialized = true;

    return window.VertexAIUI;
  }

  /**
   * Public UI API.
   *
   * The future vertex-ai.js controller can use this API without needing
   * to know how the DOM implementation works.
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

  /*
   * Automatically initialize when the interface already exists.
   *
   * This allows the file to work when vertex-ai.html has already been
   * inserted into the document.
   */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();