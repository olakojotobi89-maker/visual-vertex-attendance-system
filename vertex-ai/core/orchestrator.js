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
  function conversationalResponse(question, analysis) {
    const lower = question.toLowerCase();
    if (analysis && analysis.intent === "greeting") return "Hey! 👋 I'm Vertex AI. What are we working on today?";
    if (analysis && analysis.intent === "correction") return "Got you. Thanks for clarifying. Tell me the part you meant, and I'll adjust.";
    if (/\bforeign key constraint\b/i.test(question)) return "A foreign key constraint means the row you are inserting or updating refers to a record that does not exist in the referenced table. Check the referenced ID, insert the parent record first, and confirm the column types match. If this is happening during a delete, look for dependent rows or use the intended cascade policy rather than removing the constraint blindly.";
    if (/\b(database access|accessed our database|unauthori[sz]ed.*database|security incident|breach)\b/i.test(question)) return "Treat this as a potential security incident. Preserve logs and timestamps, revoke or rotate exposed credentials, review authentication and database audit events, and restrict access while the incident is investigated. Do not delete evidence or make broad production changes before the responsible administrator or security lead reviews them.";
    if (/\bsky blue\b/i.test(question)) return "The sky looks blue because air molecules scatter shorter blue wavelengths of sunlight more strongly than longer red wavelengths. At sunrise and sunset, the longer path through the atmosphere scatters more blue away, leaving warmer colors visible.";
    if (/\bquantum computing\b/i.test(question)) return "Quantum computers use quantum states called qubits. Unlike ordinary bits, qubits can represent combinations of states, and algorithms use interference to amplify useful answers. They are promising for specific problems, but they are not simply faster replacements for everyday computers.";
    if (/\b(explain|what is|what are)\s+apis?\b/i.test(question)) return "An API is a controlled way for one software system to communicate with another. It defines the request format, the response format, and the rules for access. In simple terms, it is the contract between two pieces of software.";
    if (/\bthinking about learning python|learn python\b/i.test(question)) return "Python is a solid place to start. I'd learn the basics through a small project, then add functions, files, APIs, and testing as you need them. A simple attendance report or CSV cleanup tool would give you useful practice quickly.";
    if (/\b(i am|i'm) bored\b/i.test(question)) return "We can fix that. We could brainstorm a useful project, learn a technical concept, or explore a strange question. A small VSAS improvement would be a good place to start if you want something practical.";
    if (/\btell me something interesting\b/i.test(question)) return "A day on Venus is longer than its year: Venus takes about 243 Earth days to rotate once, but about 225 Earth days to orbit the Sun. Space has a talent for making simple calendars complicated.";
    if (/\bwhat can you do|who are you\b/i.test(question)) return "I'm Vertex AI, the assistant built into VSAS. I can explain concepts, work with VSAS knowledge, calculate things, help draft writing, research current topics when sources are available, and help you reason through technical problems.";
    if (analysis && analysis.apiFollowUp) return "In VSAS, an API could connect the dashboard to a controlled backend operation, such as retrieving attendance records or submitting a check-in. The browser should call an authenticated endpoint, and the server should enforce permissions instead of trusting the client.";
    return null;
  }
  async function run(request) {
    const question = request.question;
    const context = request.context || [];
    const emotion = window.VertexAIEmotionContext;
    const toneEngine = window.VertexAIToneEngine;
    const style = window.VertexAIResponseStyle;
    const analysis = emotion && typeof emotion.analyze === "function" ? emotion.analyze(question, context) : null;
    const tone = toneEngine && typeof toneEngine.select === "function" ? toneEngine.select(analysis) : "normal";
    const direct = conversationalResponse(question, analysis);
    if (direct) return style && typeof style.apply === "function" ? style.apply({ success: true, text: direct, source: "local-conversation", confidence: 0.9 }, analysis, tone) : { success: true, text: direct, source: "local-conversation", confidence: 0.9, intent: analysis && analysis.intent };
    const researcher = window.VertexAIWebResearcher;
    const intent = writingResponse(question) ? "writing" : researcher && researcher.needsResearch(question) ? "research" : analysis ? analysis.intent : "knowledge-or-tool";
    if (intent === "writing") return style.apply({ success: true, text: writingResponse(question), source: "local-writing", intent: intent, confidence: 0.78 }, analysis, tone);
    if (intent === "research") {
      const result = await researcher.search(question, request.onProgress || function () {}, request.signal);
      if (!result.sources.length) return { success: false, text: "I could not verify that information from the available web source. Please try again with a more specific question or check the source directly.", source: "research-unavailable", intent: intent, confidence: 0, sources: [] };
      const combined = result.sources.map(function (source) { return source.excerpt; }).join(" ");
      const incumbent = combined.match(/(?:the )?incumbent president(?: is| of Nigeria is)\s+([A-Z][A-Za-z .'-]+?)(?:,|\.|\s+who)/i);
      if (/\bpresident\b/i.test(question) && incumbent) {
        return style.apply({ success: true, text: "The current president of Nigeria is **" + incumbent[1].trim() + "**, according to the retrieved sources.", source: "web-research", intent: intent, confidence: 0.82, sources: result.sources }, analysis, tone);
      }
      const summary = result.sources.map(function (source) { return source.title + ": " + source.excerpt.slice(0, 600); }).join("\n\n");
      return style.apply({ success: true, text: "Here is a summary based on the sources I could retrieve:\n\n" + summary, source: "web-research", intent: intent, confidence: 0.72, sources: result.sources }, analysis, tone);
    }
    const retrieval = searchKnowledge(question);
    const provider = window.VertexAILocalProvider;
    if (!provider) return { success: false, text: "Vertex AI is still initializing. Please try again.", source: "initialization", intent: intent, confidence: 0 };
    const result = await provider.respond({ question: question, retrieval: retrieval, context: context, signal: request.signal });
    return style && typeof style.apply === "function" ? style.apply(result, analysis, tone) : result;
  }
  window.VertexAIOrchestrator = Object.freeze({ run });
})();
