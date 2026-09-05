"use strict";
(function () {
  const CONTAINER_ID = "vertex-ai-container";
  const STYLE_ID = "vertex-ai-embed-style";
  const SCRIPT_BASE = "./vertex-ai/";
  let launcher = null;
  let loadingPromise = null;
  let mounted = false;

  const scripts = [
    "js/vertex-ai-config.js",
    "js/vertex-ai-security.js",
    "js/vertex-ai-cache.js",
    "knowledge/company-knowledge.js",
    "knowledge/vsas-knowledge.js",
    "knowledge/internship-knowledge.js",
    "knowledge/knowledge-index.js",
    "js/vertex-ai-search.js",
    "js/vertex-ai-response-engine.js",
    "core/conversation-manager.js",
    "core/local-tools.js",
    "core/web-researcher.js",
    "providers/local-provider.js",
    "core/orchestrator.js",
    "js/vertex-ai-chat-ui.js",
    "js/vertex-ai-controller.js"
  ];

  function addLauncherStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = "#vertex-ai-embed-launcher{position:fixed;right:24px;bottom:24px;z-index:10000;width:58px;height:58px;display:grid;place-items:center;border:0;border-radius:50%;background:#111;color:#fff;box-shadow:0 10px 28px rgba(0,0,0,.18);cursor:pointer}#vertex-ai-embed-launcher:hover{background:#c91524;transform:translateY(-2px)}#vertex-ai-embed-launcher:focus-visible{outline:3px solid rgba(201,21,36,.32);outline-offset:4px}#vertex-ai-embed-launcher .vertex-ai-launcher-icon{width:24px;height:24px;position:relative;display:block}#vertex-ai-embed-launcher .vertex-ai-launcher-icon:before{content:\"\";position:absolute;inset:2px 1px 4px;border:2px solid currentColor;border-radius:8px}#vertex-ai-embed-launcher .vertex-ai-launcher-icon:after{content:\"\";position:absolute;left:6px;bottom:1px;width:7px;height:7px;border-left:2px solid currentColor;border-bottom:2px solid currentColor;transform:skewY(-28deg)}@media(max-width:640px){#vertex-ai-embed-launcher{right:16px;bottom:calc(16px + env(safe-area-inset-bottom));width:56px;height:56px}}";
    document.head.appendChild(style);
  }

  function createLauncher() {
    if (launcher) return launcher;
    addLauncherStyle();
    launcher = document.createElement("button");
    launcher.id = "vertex-ai-embed-launcher";
    launcher.type = "button";
    launcher.title = "Ask Vertex AI";
    launcher.setAttribute("aria-label", "Ask Vertex AI");
    launcher.setAttribute("aria-haspopup", "dialog");
    launcher.setAttribute("aria-controls", "vertex-ai-panel");
    launcher.innerHTML = '<span class="vertex-ai-launcher-icon" aria-hidden="true"></span>';
    launcher.addEventListener("click", openAssistant);
    document.body.appendChild(launcher);
    return launcher;
  }

  function loadStyle() {
    if (document.querySelector('link[data-vertex-ai-style]')) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = SCRIPT_BASE + "Vertex.css";
      link.dataset.vertexAiStyle = "true";
      link.onload = resolve;
      link.onerror = reject;
      document.head.appendChild(link);
    });
  }

  function loadScript(relativePath) {
    return new Promise(function (resolve, reject) {
      const script = document.createElement("script");
      script.src = SCRIPT_BASE + relativePath;
      script.async = false;
      script.onload = resolve;
      script.onerror = function () { reject(new Error("Vertex AI module failed to load: " + relativePath)); };
      document.body.appendChild(script);
    });
  }

  async function authenticate() {
    if (!window.VSASAuth || typeof window.VSASAuth.requireAuth !== "function") return null;
    try { return await window.VSASAuth.requireAuth(); } catch (error) { return null; }
  }

  async function mount() {
    if (mounted) return;
    const auth = await authenticate();
    if (!auth || !auth.user || !auth.profile || auth.profile.is_active === false) {
      if (launcher) launcher.remove();
      launcher = null;
      return;
    }
    const container = document.getElementById(CONTAINER_ID);
    if (!container) throw new Error("Vertex AI mount point was not found.");
    await loadStyle();
    const response = await fetch("./vertex-ai/vertex-ai.html", { credentials: "same-origin" });
    if (!response.ok) throw new Error("Vertex AI interface returned HTTP " + response.status + ".");
    container.innerHTML = await response.text();
    for (const script of scripts) await loadScript(script);
    if (window.VertexAI && typeof window.VertexAI.init === "function") await window.VertexAI.init();
    mounted = true;
    if (launcher) launcher.remove();
    launcher = null;
    if (window.VertexAIChatUI) window.VertexAIChatUI.open();
  }

  function showFailure(error) {
    console.error("[Vertex AI] Lazy initialization failed:", error);
    if (!launcher) return;
    launcher.disabled = false;
    launcher.title = "Vertex AI is temporarily unavailable";
    launcher.setAttribute("aria-label", "Vertex AI is temporarily unavailable");
    launcher.dataset.vertexAiError = "true";
  }

  function openAssistant() {
    if (mounted && window.VertexAIChatUI) { window.VertexAIChatUI.open(); return; }
    if (loadingPromise) return;
    if (launcher) launcher.disabled = true;
    loadingPromise = mount().catch(showFailure).finally(function () { loadingPromise = null; if (launcher) launcher.disabled = false; });
  }

  function init() {
    if (!document.getElementById(CONTAINER_ID)) return;
    createLauncher();
  }

  window.VertexAIEmbed = Object.freeze({ init, open: openAssistant });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
