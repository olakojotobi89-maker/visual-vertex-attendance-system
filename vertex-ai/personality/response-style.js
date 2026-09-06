"use strict";
(function () {
  const openings = {
    normal: ["Here's the useful part:", "The short version is:", "Here's how I'd look at it:"],
    technical: ["Here's what is probably happening:", "The key detail is:", "Let's isolate the actual cause:"],
    teaching: ["Think of it this way:", "The simplest way to see it is:", "Here's the connection:"],
    supportive: ["Yeah, that sounds frustrating. Let's narrow it down.", "Let's stop guessing and isolate the failure:", "We can work through this one piece at a time:"],
    celebratory: ["Nice, that's a real step forward! 🎉", "That is a good sign. 🔥", "Excellent, that means the hard part is moving:"],
    friendly: ["Hey! What are we working on?", "Good to see you. What can I help with?", "Yep, I'm here. What's up?"],
    serious: ["Let's treat this as a security issue and keep the response practical:", "That needs careful handling. Here's what to do next:", "This is important, so let's preserve evidence and reduce risk first:"],
    professional: ["A practical way to approach this is:", "Here's a clean plan:", "The recommendation is:"]
  };
  function stripOpening(value) {
    return String(value || "").replace(/^(certainly|of course|absolutely|sure|great question)[,!\. ]+/i, "").trim();
  }
  function apply(result, analysis, tone) {
    const output = Object.assign({}, result || {});
    let body = stripOpening(output.text || "");
    if (!body) return output;
    if (analysis && analysis.intent === "greeting") body = "Hey! 👋 I'm Vertex AI. What are we working on today?";
    else if (analysis && analysis.intent === "thanks") body = "You're welcome. What should we tackle next?";
    else if (analysis && analysis.intent === "correction") body = "Got you — thanks for clarifying. Let's reset and focus on what you meant.";
    else if (analysis && analysis.intent === "casual" && /bored/i.test(analysis.recent.map(function (item) { return item.content; }).join(" "))) body = "We can fix that. We could brainstorm a project, learn something technical, or explore a weird question. Pick a direction.";
    else if (tone === "serious" && /database|security|unauthori[sz]ed|breach/i.test(body)) body = "⚠️ " + body;
    else if (tone === "celebratory" && !/^nice|^that is|^excellent/i.test(body.toLowerCase())) body = "Nice, that's a real step forward! 🎉 " + body;
    else if (tone === "supportive" && !/^yeah|^let's/i.test(body.toLowerCase())) body = "Yeah, I can see why that is frustrating. " + body;
    else if (tone !== "serious" && tone !== "celebratory" && tone !== "friendly" && body.split(/\s+/).length > 8 && !/^```/.test(body) && !/^(here|the short version|think of it|the key detail|let's|a practical way|the recommendation)/i.test(body)) body = (openings[tone] || openings.normal)[body.length % (openings[tone] || openings.normal).length] + "\n\n" + body;
    output.text = body;
    output.tone = tone;
    output.mood = analysis ? analysis.mood : "normal";
    output.intent = analysis ? analysis.intent : output.intent;
    return output;
  }
  window.VertexAIResponseStyle = Object.freeze({ apply });
})();
