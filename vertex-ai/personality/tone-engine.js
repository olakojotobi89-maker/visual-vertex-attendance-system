"use strict";
(function () {
  function select(analysis) {
    if (!analysis) return "normal";
    if (analysis.serious) return "serious";
    if (analysis.celebration) return "celebratory";
    if (analysis.frustrated) return "supportive";
    if (analysis.intent === "greeting" || analysis.intent === "casual" || analysis.intent === "thanks") return "friendly";
    if (analysis.intent === "technical-problem") return "technical";
    if (analysis.intent === "writing" || analysis.intent === "planning") return "professional";
    if (analysis.intent === "explanation" || analysis.intent === "follow-up") return "teaching";
    return "normal";
  }
  window.VertexAIToneEngine = Object.freeze({ select });
})();
