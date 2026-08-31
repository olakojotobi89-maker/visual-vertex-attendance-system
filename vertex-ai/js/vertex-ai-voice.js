/**
 * Vertex AI Voice Controller
 * ----------------------------------------------------------------------
 * Voice layer for the Vertex AI Assistant.
 *
 * Phase 1 uses the browser's native SpeechSynthesis API.
 *
 * Responsibilities:
 * - Discover available browser voices
 * - Select a consistent preferred voice
 * - Speak assistant responses
 * - Stop speech
 * - Pause / resume speech
 * - Track speaking state
 * - Connect with the existing Vertex AI voice controls
 *
 * NOT responsible for:
 * - AI requests
 * - Knowledge search
 * - Supabase
 * - Authentication
 * - Security authorization
 * - Caching
 * - Conversation management
 *
 * IMPORTANT:
 * Browser voices are device/browser dependent.
 * A truly identical branded voice across all users will require a
 * dedicated voice provider later. This module is designed so that
 * provider can be replaced without changing the UI.
 * ----------------------------------------------------------------------
 */

(function () {
  "use strict";

  const CONFIG = window.VertexAIConfig || {};
  const voiceConfig = CONFIG.voice || {};
  const speechConfig = voiceConfig.speech || {};

  const DEFAULT_RATE =
    Number(speechConfig.rate) > 0
      ? Number(speechConfig.rate)
      : 1.0;

  const DEFAULT_PITCH =
    Number.isFinite(Number(speechConfig.pitch))
      ? Number(speechConfig.pitch)
      : 1.0;

  const DEFAULT_VOLUME =
    Number.isFinite(Number(speechConfig.volume))
      ? Number(speechConfig.volume)
      : 1.0;

  const PREFERRED_VOICE_NAME =
    typeof speechConfig.voiceName === "string"
      ? speechConfig.voiceName.trim()
      : "";

  let voices = [];
  let selectedVoice = null;
  let initialized = false;
  let speaking = false;
  let paused = false;
  let currentText = "";

  /**
   * Determine whether browser speech synthesis is supported.
   */
  function isSupported() {
    return (
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      typeof window.SpeechSynthesisUtterance === "function"
    );
  }

  /**
   * Load the voices available on this device/browser.
   */
  function loadVoices() {
    if (!isSupported()) {
      voices = [];
      selectedVoice = null;
      return [];
    }

    voices = window.speechSynthesis.getVoices() || [];

    selectedVoice = selectBestVoice(voices);

    updateVoiceControls();

    return voices;
  }

  /**
   * Select the configured voice if it exists.
   *
   * Otherwise select a stable English voice using a preference order.
   */
  function selectBestVoice(availableVoices) {
    if (!Array.isArray(availableVoices) || !availableVoices.length) {
      return null;
    }

    /*
     * Exact configured voice.
     */
    if (PREFERRED_VOICE_NAME) {
      const exact = availableVoices.find(function (voice) {
        return (
          voice.name.toLowerCase() ===
          PREFERRED_VOICE_NAME.toLowerCase()
        );
      });

      if (exact) {
        return exact;
      }
    }

    /*
     * Prefer English voices.
     */
    const englishVoices = availableVoices.filter(function (voice) {
      return /^en(-|_)/i.test(voice.lang || "");
    });

    const candidates =
      englishVoices.length > 0
        ? englishVoices
        : availableVoices;

    /*
     * Prefer commonly available high-quality system voice names.
     * This is only a preference; availability varies by device.
     */
    const preferredNames = [
      "Microsoft David",
      "Microsoft Mark",
      "Microsoft George",
      "Google UK English Male",
      "Google US English",
      "Daniel",
      "Alex"
    ];

    for (const preferredName of preferredNames) {
      const match = candidates.find(function (voice) {
        return voice.name
          .toLowerCase()
          .includes(preferredName.toLowerCase());
      });

      if (match) {
        return match;
      }
    }

    /*
     * Prefer a male-sounding voice where the browser exposes a useful
     * conventional name. This is only a heuristic.
     */
    const maleNames = [
      "male",
      "david",
      "mark",
      "daniel",
      "alex",
      "george"
    ];

    for (const voice of candidates) {
      const name = String(voice.name || "").toLowerCase();

      if (maleNames.some(function (keyword) {
        return name.includes(keyword);
      })) {
        return voice;
      }
    }

    /*
     * Final deterministic fallback.
     */
    return candidates[0] || null;
  }

  /**
   * Normalize speech text.
   */
  function normalizeSpeechText(text) {
    if (text === null || text === undefined) {
      return "";
    }

    let value = String(text);

    if (typeof value.normalize === "function") {
      value = value.normalize("NFKC");
    }

    /*
     * Remove excessive whitespace.
     */
    value = value
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return value;
  }

  /**
   * Speak text.
   *
   * @param {string} text
   * @param {Object} options
   * @returns {boolean}
   */
  function speak(text, options) {
    if (!isSupported()) {
      return false;
    }

    const value = normalizeSpeechText(text);

    if (!value) {
      return false;
    }

    const opts =
      options && typeof options === "object"
        ? options
        : {};

    /*
     * Stop current speech before starting the next response.
     */
    window.speechSynthesis.cancel();

    const utterance =
      new window.SpeechSynthesisUtterance(value);

    utterance.rate =
      Number.isFinite(Number(opts.rate))
        ? Number(opts.rate)
        : DEFAULT_RATE;

    utterance.pitch =
      Number.isFinite(Number(opts.pitch))
        ? Number(opts.pitch)
        : DEFAULT_PITCH;

    utterance.volume =
      Number.isFinite(Number(opts.volume))
        ? Number(opts.volume)
        : DEFAULT_VOLUME;

    const requestedVoice =
      typeof opts.voice === "object"
        ? opts.voice
        : selectedVoice;

    if (requestedVoice) {
      utterance.voice = requestedVoice;
    }

    currentText = value;
    speaking = true;
    paused = false;

    utterance.onstart = function () {
      speaking = true;
      paused = false;
      updateVoiceControls();
    };

    utterance.onpause = function () {
      paused = true;
      updateVoiceControls();
    };

    utterance.onresume = function () {
      paused = false;
      speaking = true;
      updateVoiceControls();
    };

    utterance.onend = function () {
      speaking = false;
      paused = false;
      updateVoiceControls();
    };

    utterance.onerror = function () {
      speaking = false;
      paused = false;
      updateVoiceControls();
    };

    window.speechSynthesis.speak(utterance);

    updateVoiceControls();

    return true;
  }

  /**
   * Stop speech completely.
   */
  function stop() {
    if (!isSupported()) {
      return;
    }

    window.speechSynthesis.cancel();

    speaking = false;
    paused = false;
    currentText = "";

    updateVoiceControls();
  }

  /**
   * Pause current speech.
   */
  function pause() {
    if (!isSupported() || !speaking) {
      return;
    }

    window.speechSynthesis.pause();

    paused = true;

    updateVoiceControls();
  }

  /**
   * Resume paused speech.
   */
  function resume() {
    if (!isSupported() || !paused) {
      return;
    }

    window.speechSynthesis.resume();

    paused = false;
    speaking = true;

    updateVoiceControls();
  }

  /**
   * Toggle pause/resume.
   */
  function togglePause() {
    if (paused) {
      resume();
    } else {
      pause();
    }
  }

  /**
   * Return whether speech is currently active.
   */
  function isSpeaking() {
    return speaking;
  }

  /**
   * Return whether speech is currently paused.
   */
  function isPaused() {
    return paused;
  }

  /**
   * Return the currently selected voice.
   */
  function getSelectedVoice() {
    return selectedVoice;
  }

  /**
   * Return available voices.
   */
  function getVoices() {
    return voices.slice();
  }

  /**
   * Select a voice by exact name.
   *
   * @param {string} name
   * @returns {boolean}
   */
  function setVoice(name) {
    if (!name) {
      return false;
    }

    const normalizedName = String(name)
      .trim()
      .toLowerCase();

    const voice = voices.find(function (item) {
      return (
        String(item.name || "")
          .trim()
          .toLowerCase() === normalizedName
      );
    });

    if (!voice) {
      return false;
    }

    selectedVoice = voice;

    updateVoiceControls();

    return true;
  }

  /**
   * Update existing voice-control elements in the Vertex AI interface.
   *
   * This is intentionally limited to UI state.
   */
  function updateVoiceControls() {
    const root = document.querySelector("#vertex-ai-root");

    if (!root) {
      return;
    }

    const toggleButton =
      root.querySelector("#vertex-ai-voice-toggle");

    const playButton =
      root.querySelector("#vertex-ai-voice-play");

    const stopButton =
      root.querySelector("#vertex-ai-voice-stop");

    if (toggleButton) {
      toggleButton.setAttribute(
        "aria-pressed",
        voiceEnabled() ? "true" : "false"
      );

      toggleButton.setAttribute(
        "aria-label",
        voiceEnabled()
          ? "Turn voice responses off"
          : "Turn voice responses on"
      );
    }

    if (playButton) {
      playButton.disabled = !currentText;
    }

    if (stopButton) {
      stopButton.disabled = !speaking;
    }
  }

  /**
   * Read the current voice-enabled preference.
   *
   * This is stored locally because it is a UI preference, not
   * authentication information.
   */
  function voiceEnabled() {
    try {
      const value = window.localStorage.getItem(
        "vsas_vertex_ai_voice_enabled"
      );

      if (value === null) {
        return voiceConfig.enabled !== false;
      }

      return value === "true";
    } catch (error) {
      return voiceConfig.enabled !== false;
    }
  }

  /**
   * Enable or disable voice responses.
   */
  function setEnabled(enabled) {
    const value = Boolean(enabled);

    try {
      window.localStorage.setItem(
        "vsas_vertex_ai_voice_enabled",
        value ? "true" : "false"
      );
    } catch (error) {
      /*
       * Local preference storage is optional.
       */
    }

    if (!value) {
      stop();
    }

    updateVoiceControls();

    return value;
  }

  /**
   * Toggle voice responses.
   */
  function toggleEnabled() {
    return setEnabled(!voiceEnabled());
  }

  /**
   * Speak the last response again.
   */
  function replay() {
    if (!currentText) {
      return false;
    }

    return speak(currentText);
  }

  /**
   * Get voice state.
   */
  function getState() {
    return Object.freeze({
      supported: isSupported(),
      enabled: voiceEnabled(),
      speaking,
      paused,
      voiceName: selectedVoice
        ? selectedVoice.name
        : null,
      voiceLanguage: selectedVoice
        ? selectedVoice.lang
        : null
    });
  }

  /**
   * Initialize the voice module.
   */
  function init() {
    if (initialized) {
      return window.VertexAIVoice;
    }

    if (!isSupported()) {
      initialized = true;
      return window.VertexAIVoice;
    }

    /*
     * Some browsers populate voices asynchronously.
     */
    loadVoices();

    if ("onvoiceschanged" in window.speechSynthesis) {
      window.speechSynthesis.addEventListener(
        "voiceschanged",
        loadVoices
      );
    }

    initialized = true;

    updateVoiceControls();

    return window.VertexAIVoice;
  }

  /**
   * Public API.
   */
  window.VertexAIVoice = Object.freeze({
    init,
    speak,
    stop,
    pause,
    resume,
    togglePause,
    replay,
    isSupported,
    isSpeaking,
    isPaused,
    getVoices,
    getSelectedVoice,
    setVoice,
    setEnabled,
    toggleEnabled,
    voiceEnabled,
    getState
  });

  init();

  if (
    CONFIG.development &&
    CONFIG.development.consoleLogging === true
  ) {
    console.info(
      "[Vertex AI] Voice module loaded.",
      getState()
    );
  }
})();