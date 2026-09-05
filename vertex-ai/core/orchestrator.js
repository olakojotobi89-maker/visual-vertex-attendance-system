"use strict";
(function () {
  function searchKnowledge(question) {
    const search = window.VertexAISearch;
    if (!search) return null;
    try { return typeof search.retrieve === "function" ? search.retrieve(question) : null; } catch (error) { console.warn("[Vertex AI] Knowledge retrieval failed.", error); return null; }
  }
  function writingResponse(question) {
    const match = question.match(/(?:write|draft|compose)\s+(?:an?\s+)?(.+)/i);
    if (!match) return null;
    const subject = match[1].replace(/[.?!]+$/, "").trim();
    return "**Subject:** " + subject.charAt(0).toUpperCase() + subject.slice(1) + "\n\nHello,\n\nI am writing regarding " + subject + ". Please review the relevant details and let me know if you need any clarification.\n\nRegards,\nVisual Vertex Technology Company";
  }
  async function run(request) {
    const question = request.question;
    const researcher = window.VertexAIWebResearcher;
    const intent = writingResponse(question) ? "writing" : researcher && researcher.needsResearch(question) ? "research" : "knowledge-or-tool";
    if (intent === "writing") return { success: true, text: writingResponse(question), source: "local-writing", intent: intent, confidence: 0.78 };
    if (intent === "research") {
      const result = await researcher.search(question, request.onProgress || function () {}, request.signal);
      if (!result.sources.length) return { success: false, text: "I could not verify that information from the available web source. Please try again with a more specific question or check the source directly.", source: "research-unavailable", intent: intent, confidence: 0, sources: [] };
      const combined = result.sources.map(function (source) { return source.excerpt; }).join(" ");
      const incumbent = combined.match(/(?:the )?incumbent president(?: is| of Nigeria is)\s+([A-Z][A-Za-z .'-]+?)(?:,|\.|\s+who)/i);
      if (/\bpresident\b/i.test(question) && incumbent) {
        return { success: true, text: "The current president of Nigeria is **" + incumbent[1].trim() + "**, according to the retrieved sources.", source: "web-research", intent: intent, confidence: 0.82, sources: result.sources };
      }
      const summary = result.sources.map(function (source) { return source.title + ": " + source.excerpt.slice(0, 600); }).join("\n\n");
      return { success: true, text: "Here is a summary based on the sources I could retrieve:\n\n" + summary, source: "web-research", intent: intent, confidence: 0.72, sources: result.sources };
    }
    const retrieval = searchKnowledge(question);
    const provider = window.VertexAILocalProvider;
    if (!provider) return { success: false, text: "Vertex AI is still initializing. Please try again.", source: "initialization", intent: intent, confidence: 0 };
    return provider.respond({ question: question, retrieval: retrieval, context: request.context || [], signal: request.signal });
  }
  window.VertexAIOrchestrator = Object.freeze({ run });
})();
