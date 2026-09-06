"use strict";
(function () {
  function respond(request) {
    const tools = window.VertexAILocalTools;
    if (tools && typeof tools.run === "function") { const toolResult = tools.run(request.question); if (toolResult) return Promise.resolve({ success: true, text: toolResult.text, source: "local-tool", intent: toolResult.tool, confidence: 1, meta: { tool: toolResult.tool } }); }
    const retrieval = request.retrieval;
    const engine = window.VertexAIResponseEngine;
    if (engine && typeof engine.respond === "function") {
      const result = engine.respond(request.question, { retrieval: retrieval || null, context: request.context || [] });
      if (result && result.success && result.text) return Promise.resolve(result);
    }
    if (retrieval && retrieval.answer) return Promise.resolve({ success: true, text: retrieval.answer, source: "approved-knowledge", intent: "knowledge", confidence: 0.7 });
    return Promise.resolve({ success: true, text: "I don't have enough verified context to answer that confidently yet. Give me a little more detail and I'll work through it with you.", source: "fallback", intent: "unknown", confidence: 0 });
  }
  window.VertexAILocalProvider = Object.freeze({ id: "local", respond });
})();
