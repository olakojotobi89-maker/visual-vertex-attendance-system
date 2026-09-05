"use strict";
(function () {
  let initialized = false; let initPromise = null; let activeRequest = null; let lastQuestion = ""; let authContext = null;
  function manager() { return window.VertexAIConversationManager; }
  function ui() { return window.VertexAIChatUI; }
  function setHistory() { const state = manager().getState(); ui().renderHistory(state.conversations, state.activeId); }
  function renderActive() { ui().renderConversation(manager().active()); setHistory(); }
  function addSystem(text) { ui().addMessage("assistant", text, null); }
  async function ask(question) {
    if (activeRequest) return;
    const security = window.VertexAISecurity; const validation = security && security.validateQuestion ? security.validateQuestion(question) : { valid: Boolean(question), value: question };
    if (!validation.valid) { addSystem("I could not use that message because it is empty or contains unsafe markup."); return; }
    const clean = validation.value; lastQuestion = clean; manager().addMessage("user", clean); renderActive(); ui().setBusy(true, "Thinking..."); ui().showTyping(); ui().setStatus("Working on your request..."); activeRequest = new AbortController();
    try {
      const result = await window.VertexAIOrchestrator.run({ question: clean, context: manager().getContext(12), signal: activeRequest.signal, onProgress: function (label) { ui().setStatus(label); ui().setBusy(true, label); } });
      if (activeRequest.signal.aborted) return;
      const content = result.text || "I could not produce a response."; const meta = { sources: result.sources || [], intent: result.intent, source: result.source };
      manager().addMessage("assistant", content, meta); renderActive(); ui().setStatus(result.source === "web-research" ? "Research complete" : "Ready to help"); ui().setBusy(false); ui().hideTyping(); document.querySelector("#vertex-ai-regenerate").disabled = false;
    } catch (error) { if (error.name !== "AbortError") { manager().addMessage("assistant", "I could not complete that request. Please try again.", { error: true }); renderActive(); ui().setStatus("Unable to complete request"); } ui().setBusy(false); ui().hideTyping(); } finally { activeRequest = null; }
  }
  function init() {
    if (initialized) return Promise.resolve(window.VertexAI);
    if (initPromise) return initPromise;
    initPromise = (async function () {
      for (let attempt = 0; attempt < 20 && !window.VSASAuth; attempt++) await new Promise(function (resolve) { setTimeout(resolve, 50); });
      if (window.VSASAuth && typeof window.VSASAuth.requireAuth === "function") { try { authContext = await window.VSASAuth.requireAuth(); } catch (error) { authContext = null; } }
      if (!authContext || !authContext.user) throw new Error("Vertex AI requires an authenticated VSAS user.");
      const scope = authContext.user.id; manager().init(scope);
      ui().init({ submit: ask, "new-conversation": function () { manager().create(); renderActive(); ui().open(); }, "clear-conversation": function () { manager().clear(); renderActive(); }, "select-conversation": function (element) { manager().select(element.dataset.conversationId); renderActive(); }, "rename-conversation": function (element) { const item = manager().active(); const title = window.prompt("Conversation name", item && item.title); if (title) { manager().rename(element.dataset.conversationId, title); setHistory(); } }, "delete-conversation": function (element) { manager().remove(element.dataset.conversationId); renderActive(); }, "stop-generation": function () { if (activeRequest) activeRequest.abort(); ui().setBusy(false); ui().hideTyping(); ui().setStatus("Generation stopped"); }, regenerate: function () { if (lastQuestion) ask(lastQuestion); }, "copy-message": function (element) { navigator.clipboard && navigator.clipboard.writeText(element.dataset.copyText || ""); }, "copy-code": function (element) { navigator.clipboard && navigator.clipboard.writeText(element.dataset.copyText || ""); } });
      renderActive(); initialized = true; return window.VertexAI;
    })();
    return initPromise;
  }
  window.VertexAI = { init, processQuestion: ask, getAuthContext: function () { return authContext; } };
})();
