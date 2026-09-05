"use strict";
(function () {
  const MAX_RESULTS = 4;
  const TIMEOUT_MS = 7000;
  const cache = new Map();
  function timeoutFetch(url, signal) { return fetch(url, { signal: signal, headers: { Accept: "application/json" } }); }
  async function search(query, onProgress, signal) {
    const key = String(query || "").trim().toLowerCase();
    if (!key) return { sources: [], text: "" };
    if (cache.has(key)) return cache.get(key);
    onProgress("Searching current sources...");
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);
    if (signal) signal.addEventListener("abort", function () { controller.abort(); }, { once: true });
    try {
      const url = "https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=" + encodeURIComponent(key) + "&srlimit=" + MAX_RESULTS + "&format=json&origin=*";
      const response = await timeoutFetch(url, controller.signal);
      if (!response.ok) throw new Error("Search service returned HTTP " + response.status);
      const data = await response.json();
      const hits = Array.isArray(data.query && data.query.search) ? data.query.search : [];
      if (!hits.length) return { sources: [], text: "" };
      onProgress("Reading relevant sources...");
      const sources = [];
      for (const hit of hits.slice(0, MAX_RESULTS)) {
        if (signal && signal.aborted) throw new DOMException("Research cancelled", "AbortError");
        const pageUrl = "https://en.wikipedia.org/wiki/" + encodeURIComponent(String(hit.title || "").replace(/ /g, "_"));
        const summaryUrl = "https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(String(hit.title || "").replace(/ /g, "_"));
        try {
          const summaryResponse = await timeoutFetch(summaryUrl, controller.signal);
          if (!summaryResponse.ok) continue;
          const summary = await summaryResponse.json();
          const extract = String(summary.extract || "").replace(/\s+/g, " ").trim().slice(0, 1400);
          if (extract) sources.push({ title: String(hit.title || "Source"), url: pageUrl, excerpt: extract });
        } catch (error) { if (error.name === "AbortError") throw error; }
      }
      onProgress("Comparing the available information...");
      const result = { sources: sources, text: sources.map(function (source) { return source.title + ": " + source.excerpt; }).join("\n\n") };
      cache.set(key, result);
      return result;
    } finally { clearTimeout(timer); }
  }
  function needsResearch(question) { return /\b(current|latest|recent|today|this week|news|who is the president|research|threats|trend|what happened|weather|price)\b/i.test(question); }
  window.VertexAIWebResearcher = Object.freeze({ search, needsResearch });
})();
