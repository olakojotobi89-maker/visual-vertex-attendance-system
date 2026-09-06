"use strict";
(function () {
  function text(value) { return String(value || "").trim(); }
  function previous(context) { return (Array.isArray(context) ? context : []).filter(function (item) { return item && item.role === "user"; }).slice(-3); }
  function analyze(question, context) {
    const value = text(question);
    const lower = value.toLowerCase();
    const recent = previous(context);
    const last = recent.length ? text(recent[recent.length - 1].content).toLowerCase() : "";
    const serious = /unauthori[sz]ed|breach|hacked|stolen|compromised|accessed?\s+(?:our|the)\s+database|database access|security incident|malware|ransomware|legal|lawsuit|danger|data loss|delete production/i.test(value);
    const frustrated = !serious && /stupid|killing me|frustrat|annoy|not working|broken|fighting|hours|keeps failing|can't|cannot/i.test(value);
    const celebration = /finally|indexed|launched|shipped|passed|worked|success|achieved|done|ranking|we did it/i.test(value) && /!|finally|worked|success|achieved|launched|shipped|indexed|ranking/i.test(value);
    const correction = /^(no[, ]|that's not|that is not|i meant|forget that|actually forget|not what i|wrong question|explain that again|make it simpler)/i.test(value);
    const greeting = /^(hey|hi|hello|yo|good morning|good afternoon|good evening)\b/i.test(value);
    const technical = /\b(api|apis|code|bug|debug|javascript|typescript|html|css|sql|database|foreign key|constraint|error|deploy|deployment|supabase|function|program|python|codebase)\b/i.test(value);
    const research = /\b(current|latest|recent|today|news|research|trend|what happened|weather|price)\b/i.test(value);
    const writing = /^(write|draft|compose|rewrite|edit|polish)\b/i.test(value);
    const planning = /\b(plan|planning|roadmap|project|brainstorm|ideas|organize|build)\b/i.test(value);
    const explanation = /^(explain|how does|why does|what is|what are|make it simpler|break down)\b/i.test(value);
    const apiFollowUp = /\b(use one|use it|that in vsas|this in vsas|an api|apis? in vsas)\b/i.test(lower) && /\bapi|apis\b/i.test(last);
    let intent = "question";
    if (correction) intent = "correction";
    else if (serious) intent = "security-incident";
    else if (greeting) intent = "greeting";
    else if (writing) intent = "writing";
    else if (research) intent = "research";
    else if (planning) intent = "planning";
    else if (apiFollowUp) intent = "follow-up";
    else if (explanation) intent = "explanation";
    else if (technical) intent = "technical-problem";
    else if (/\bthanks|thank you|appreciate\b/i.test(value)) intent = "thanks";
    else if (/\bhow are you|what can you do|who are you\b/i.test(value)) intent = "casual";
    return Object.freeze({ intent: intent, mood: serious ? "serious" : frustrated ? "frustrated" : celebration ? "celebratory" : greeting || intent === "casual" ? "friendly" : technical ? "technical" : "normal", serious: serious, frustrated: frustrated, celebration: celebration, correction: correction, apiFollowUp: apiFollowUp, recent: recent });
  }
  window.VertexAIEmotionContext = Object.freeze({ analyze });
})();
