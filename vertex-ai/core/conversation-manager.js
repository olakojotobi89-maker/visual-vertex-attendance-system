"use strict";
(function () {
  const CONFIG = window.VertexAIConfig || {};
  const conversationConfig = CONFIG.conversation || {};
  const maxMessages = Number(conversationConfig.maxMessagesPerConversation) > 0 ? Number(conversationConfig.maxMessagesPerConversation) : 100;
  const maxConversations = 20;
  const prefix = "vsas_vertex_conversations_v1_";
  let userKey = "anonymous";
  let state = { activeId: "", conversations: [] };

  function key() { return prefix + userKey; }
  function makeId() { return "conversation-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8); }
  function titleFrom(text) {
    const value = String(text || "").replace(/\s+/g, " ").trim();
    return value ? value.slice(0, 42) + (value.length > 42 ? "..." : "") : "New conversation";
  }
  function persist() {
    try { localStorage.setItem(key(), JSON.stringify(state)); } catch (error) { console.warn("[Vertex AI] Conversation storage unavailable.", error); }
  }
  function load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(key()) || "null");
      if (parsed && Array.isArray(parsed.conversations)) state = parsed;
    } catch (error) { state = { activeId: "", conversations: [] }; }
    if (!state.conversations.length) create();
    if (!state.conversations.some(function (item) { return item.id === state.activeId; })) state.activeId = state.conversations[0].id;
  }
  function create() {
    const item = { id: makeId(), title: "New conversation", createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
    state.conversations.unshift(item);
    state.activeId = item.id;
    state.conversations = state.conversations.slice(0, maxConversations);
    persist();
    return item;
  }
  function active() { return state.conversations.find(function (item) { return item.id === state.activeId; }) || null; }
  function addMessage(role, content, meta) {
    const item = active() || create();
    item.messages.push({ id: makeId(), role: role, content: String(content || "").slice(0, 12000), meta: meta || null, createdAt: Date.now() });
    item.messages = item.messages.slice(-maxMessages);
    item.updatedAt = Date.now();
    if (role === "user" && item.title === "New conversation") item.title = titleFrom(content);
    persist();
    return item.messages[item.messages.length - 1];
  }
  function clear() { const item = active(); if (item) { item.messages = []; item.title = "New conversation"; item.updatedAt = Date.now(); persist(); } }
  function rename(id, title) { const item = state.conversations.find(function (entry) { return entry.id === id; }); if (item) { item.title = titleFrom(title); item.updatedAt = Date.now(); persist(); } return item; }
  function remove(id) { state.conversations = state.conversations.filter(function (item) { return item.id !== id; }); if (!state.conversations.length) create(); else if (state.activeId === id) state.activeId = state.conversations[0].id; persist(); }
  function select(id) { if (state.conversations.some(function (item) { return item.id === id; })) { state.activeId = id; persist(); } return active(); }
  function init(scope) { userKey = String(scope || "anonymous").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "anonymous"; load(); return api; }
  function getContext(limit) { return (active() ? active().messages : []).slice(-(Number(limit) || 12)).map(function (message) { return { role: message.role, content: message.content }; }); }
  const api = { init, create, active, addMessage, clear, rename, remove, select, getContext, list: function () { return state.conversations.slice(); }, getState: function () { return JSON.parse(JSON.stringify(state)); } };
  window.VertexAIConversationManager = api;
})();
