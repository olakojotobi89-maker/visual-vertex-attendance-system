"use strict";
/**
 * Vertex AI Assistant — Main Orchestrator
 * ----------------------------------------------------------------------
 * Visual Vertex Technology Company
 *
 * Central controller for the Vertex AI assistant.
 *
 * Pipeline:
 *
 *   User Question
 *        ↓
 *   Security Validation
 *        ↓
 *   Cache
 *        ↓
 *   Response Engine
 *        ↓
 *   Existing Knowledge Search
 *        ↓
 *   Verified Response
 *        ↓
 *   UI
 *        ↓
 *   Optional Voice
 *
 * This module does NOT:
 * - contain API keys
 * - make external AI calls
 * - directly query Supabase
 * - implement authentication
 * - implement RLS
 * - contain the complete knowledge database
 * - implement voice generation
 * ----------------------------------------------------------------------
 */

(function () {
  "use strict";


  /* ================================================================
     CONFIGURATION
     ================================================================ */

  const CONFIG =
    window.VertexAIConfig || {};

  const assistantConfig =
    CONFIG.assistant || {};

  const MOCK_DELAY_MS =
    Number(
      assistantConfig.mockResponseDelayMs
    ) >= 0
      ? Number(
          assistantConfig.mockResponseDelayMs
        )
      : 450;


  const MAX_QUESTION_LENGTH =
    Number(
      assistantConfig.maxQuestionLength
    ) > 0
      ? Number(
          assistantConfig.maxQuestionLength
        )
      : 500;


  const UNKNOWN_RESPONSE =
    assistantConfig.unknownResponse ||
    "I could not find enough approved information to answer that question reliably.";


  let initialized = false;

  let busy = false;

  let lastAssistantResponse = "";

  let responseTimer = null;


  /* ================================================================
     MODULE ACCESS
     ================================================================ */

  function getUI() {

    return window.VertexAIUI || null;

  }


  function getSecurity() {

    return window.VertexAISecurity || null;

  }


  function getCache() {

    return window.VertexAICache || null;

  }


  function getSearch() {

    return window.VertexAISearch || null;

  }


  function getVoice() {

    return window.VertexAIVoice || null;

  }


  function getResponseEngine() {

    return (
      window.VertexAIResponseEngine ||
      null
    );

  }


  /* ================================================================
     QUESTION VALIDATION
     ================================================================ */

  function validateQuestion(question) {

    const security =
      getSecurity();


    if (
      security &&
      typeof security.validateQuestion ===
        "function"
    ) {

      const result =
        security.validateQuestion(
          question
        );


      if (
        !result ||
        result.valid !== true
      ) {

        return {
          valid: false,
          value: "",
          reason:
            result &&
            result.reason
              ? result.reason
              : "Question failed validation."
        };

      }


      return {
        valid: true,

        value:
          String(
            result.value || ""
          ).slice(
            0,
            MAX_QUESTION_LENGTH
          )
      };

    }


    const value =
      String(
        question || ""
      )
        .trim()
        .slice(
          0,
          MAX_QUESTION_LENGTH
        );


    if (!value) {

      return {
        valid: false,
        value: "",
        reason:
          "Question is empty."
      };

    }


    return {
      valid: true,
      value
    };

  }


  /* ================================================================
     CACHE
     ================================================================ */

  function getCachedAnswer(question) {

    const cache =
      getCache();


    if (
      !cache ||
      typeof cache.get !==
        "function"
    ) {

      return null;

    }


    try {

      const cached =
        cache.get(question);


      if (
        cached === null ||
        cached === undefined
      ) {

        return null;

      }


      if (
        typeof cached ===
          "object" &&
        cached !== null &&
        Object.prototype.hasOwnProperty.call(
          cached,
          "answer"
        )
      ) {

        return (
          cached.answer ||
          null
        );

      }


      if (
        typeof cached ===
        "string"
      ) {

        return cached;

      }

    } catch (error) {

      console.warn(
        "[Vertex AI] Cache read failed:",
        error
      );

    }


    return null;

  }


  function cacheAnswer(
    question,
    answer,
    result
  ) {

    const cache =
      getCache();


    if (
      !cache ||
      typeof cache.set !==
        "function"
    ) {

      return;

    }


    try {

      cache.set(
        question,
        {
          answer,
          result:
            result || null
        }
      );

    } catch (error) {

      console.warn(
        "[Vertex AI] Cache write failed:",
        error
      );

    }

  }


  /* ================================================================
     EXISTING KNOWLEDGE SEARCH
     ================================================================ */

  function retrieveKnowledge(
    question
  ) {

    const search =
      getSearch();


    if (!search) {

      return null;

    }


    try {

      if (
        typeof search.retrieve ===
        "function"
      ) {

        return search.retrieve(
          question
        );

      }


      if (
        typeof search.findBestMatch ===
        "function"
      ) {

        const result =
          search.findBestMatch(
            question
          );


        if (!result) {

          return null;

        }


        return {

          source:
            "knowledge",

          cached: false,

          query:
            question,

          answer:
            result.content ||
            result.answer ||
            result.text ||
            "",

          result

        };

      }

    } catch (error) {

      console.warn(
        "[Vertex AI] Knowledge retrieval failed:",
        error
      );

    }


    return null;

  }


  /* ================================================================
     RESPONSE ENGINE
     ================================================================ */

  function generateResponse(
    question,
    retrieval
  ) {

    const engine =
      getResponseEngine();


    /*
     * --------------------------------------------------------------
     * PRIMARY RESPONSE ENGINE
     * --------------------------------------------------------------
     */

    if (
      engine &&
      typeof engine.respond ===
        "function"
    ) {

      try {

        const result =
          engine.respond(
            question,
            {
              retrieval:
                retrieval || null
            }
          );


        if (
          result &&
          result.success === true &&
          typeof result.text ===
            "string" &&
          result.text.trim()
        ) {

          return {

            answer:
              result.text.trim(),

            source:
              result.source ||
              "response-engine",

            intent:
              result.intent ||
              "unknown",

            confidence:
              Number(
                result.confidence || 0
              ),

            result

          };

        }

      } catch (error) {

        console.error(
          "[Vertex AI] Response Engine error:",
          error
        );

      }

    }


    /*
     * --------------------------------------------------------------
     * SECONDARY FALLBACK
     * --------------------------------------------------------------
     *
     * If the Response Engine is unavailable but the existing search
     * system has an approved answer, use it.
     */

    if (
      retrieval &&
      typeof retrieval.answer ===
        "string" &&
      retrieval.answer.trim()
    ) {

      return {

        answer:
          retrieval.answer.trim(),

        source:
          "approved-knowledge",

        intent:
          "knowledge",

        confidence:
          0.70,

        result:
          retrieval.result ||
          null

      };

    }


    /*
     * --------------------------------------------------------------
     * FINAL FALLBACK
     * --------------------------------------------------------------
     */

    return {

      answer:
        UNKNOWN_RESPONSE,

      source:
        "fallback",

      intent:
        "unknown",

      confidence:
        0,

      result:
        null

    };

  }


  /* ================================================================
     VOICE
     ================================================================ */

  function speakResponse(
    text
  ) {

    const voice =
      getVoice();


    if (
      !voice ||
      typeof voice.speak !==
        "function"
    ) {

      return false;

    }


    try {

      if (
        typeof voice.voiceEnabled ===
          "function" &&
        !voice.voiceEnabled()
      ) {

        return false;

      }


      return voice.speak(
        text
      );

    } catch (error) {

      console.warn(
        "[Vertex AI] Voice failed:",
        error
      );

      return false;

    }

  }


  /* ================================================================
     UI
     ================================================================ */

  function addAssistantMessage(
    text
  ) {

    const ui =
      getUI();


    if (
      !ui ||
      typeof ui.addMessage !==
        "function"
    ) {

      return false;

    }


    ui.addMessage(
      "assistant",
      text
    );


    lastAssistantResponse =
      text;


    return true;

  }


  function addUserMessage(
    text
  ) {

    const ui =
      getUI();


    if (
      !ui ||
      typeof ui.addMessage !==
        "function"
    ) {

      return false;

    }


    ui.addMessage(
      "user",
      text
    );


    return true;

  }


  function showTyping() {

    const ui =
      getUI();


    if (
      ui &&
      typeof ui.showTyping ===
        "function"
    ) {

      ui.showTyping();

    }

  }


  function hideTyping() {

    const ui =
      getUI();


    if (
      ui &&
      typeof ui.hideTyping ===
        "function"
    ) {

      ui.hideTyping();

    }

  }


  /* ================================================================
     STATUS
     ================================================================ */

  function setStatus(
    status
  ) {

    const root =
      document.querySelector(
        "#vertex-ai-root"
      );


    if (!root) {

      return;

    }


    const statusElement =
      root.querySelector(
        "#vertex-ai-status"
      );


    if (!statusElement) {

      return;

    }


    statusElement.textContent =
      String(
        status || ""
      );

  }


  /* ================================================================
     PROCESS QUESTION
     ================================================================ */

  function processQuestion(
    question
  ) {

    if (busy) {

      return Promise.resolve(
        false
      );

    }


    const validation =
      validateQuestion(
        question
      );


    if (!validation.valid) {

      const ui =
        getUI();


      if (
        ui &&
        typeof ui.addMessage ===
          "function"
      ) {

        ui.addMessage(
          "system",
          validation.reason ||
            "Please enter a valid question."
        );

      }


      return Promise.resolve(
        false
      );

    }


    const cleanQuestion =
      validation.value;


    busy = true;


    addUserMessage(
      cleanQuestion
    );


    showTyping();


    setStatus(
      "Thinking..."
    );


    return new Promise(
      function (resolve) {

        responseTimer =
          window.setTimeout(
            function () {

              try {

                /* ==================================================
                   STEP 1 — CACHE
                   ================================================== */

                const cachedAnswer =
                  getCachedAnswer(
                    cleanQuestion
                  );


                if (cachedAnswer) {

                  finishResponse(
                    cachedAnswer,
                    "Answered from cache"
                  );


                  resolve(true);

                  return;

                }


                /* ==================================================
                   STEP 2 — EXISTING KNOWLEDGE
                   ================================================== */

                setStatus(
                  "Searching approved knowledge..."
                );


                const retrieval =
                  retrieveKnowledge(
                    cleanQuestion
                  );


                /* ==================================================
                   STEP 3 — RESPONSE ENGINE
                   ================================================== */

                setStatus(
                  "Preparing your answer..."
                );


                const generated =
                  generateResponse(
                    cleanQuestion,
                    retrieval
                  );


                const answer =
                  generated.answer;


                /* ==================================================
                   STEP 4 — CACHE GOOD ANSWERS
                   ================================================== */

                if (
                  generated.confidence >=
                    0.50 &&
                  answer &&
                  answer !==
                    UNKNOWN_RESPONSE
                ) {

                  cacheAnswer(
                    cleanQuestion,
                    answer,
                    generated.result
                  );

                }


                /* ==================================================
                   STEP 5 — SEND TO UI
                   ================================================== */

                let status =
                  "Ready to help";


                if (
                  generated.source ===
                  "visual-vertex-knowledge"
                ) {

                  status =
                    "Answered from Visual Vertex knowledge";

                }

                else if (
                  generated.source ===
                  "vertex-ai-search"
                ) {

                  status =
                    "Answered from approved knowledge";

                }

                else if (
                  generated.source ===
                  "vertex-ai-search"
                ) {

                  status =
                    "Answered from knowledge";

                }

                else if (
                  generated.source ===
                  "fallback"
                ) {

                  status =
                    "Ready to help";

                }


                finishResponse(
                  answer,
                  status
                );


                /*
                 * Development logging
                 */

                if (
                  CONFIG.development &&
                  CONFIG.development.consoleLogging ===
                    true
                ) {

                  console.info(
                    "[Vertex AI] Response:",
                    {
                      question:
                        cleanQuestion,

                      intent:
                        generated.intent,

                      confidence:
                        generated.confidence,

                      source:
                        generated.source
                    }
                  );

                }


                resolve(true);

              } catch (error) {

                console.error(
                  "[Vertex AI] Response processing error:",
                  error
                );


                finishResponse(

                  "I encountered a temporary problem while processing that question. Please try again.",

                  "Temporary error"

                );


                resolve(false);

              }

            },

            MOCK_DELAY_MS

          );

      }

    );

  }


  /* ================================================================
     FINISH RESPONSE
     ================================================================ */

  function finishResponse(
    answer,
    status
  ) {

    hideTyping();


    setStatus(
      status ||
        "Ready to help"
    );


    addAssistantMessage(
      answer
    );


    /*
     * Voice remains optional.
     */

    speakResponse(
      answer
    );


    busy = false;

    responseTimer = null;

  }


  /* ================================================================
     CANCEL
     ================================================================ */

  function cancelPendingResponse() {

    if (
      responseTimer !==
      null
    ) {

      window.clearTimeout(
        responseTimer
      );

      responseTimer =
        null;

    }


    hideTyping();


    busy = false;


    setStatus(
      "Ready to help"
    );

  }


  /* ================================================================
     REPLAY
     ================================================================ */

  function replayLastResponse() {

    if (
      !lastAssistantResponse
    ) {

      return false;

    }


    const voice =
      getVoice();


    if (!voice) {

      return false;

    }


    if (
      typeof voice.replay ===
        "function"
    ) {

      return voice.replay();

    }


    if (
      typeof voice.speak ===
        "function"
    ) {

      return voice.speak(
        lastAssistantResponse
      );

    }


    return false;

  }


  /* ================================================================
     CLEAR CONVERSATION
     ================================================================ */

  function clearConversation() {

    cancelPendingResponse();


    lastAssistantResponse =
      "";


    const engine =
      getResponseEngine();


    /*
     * Clear the Response Engine's conversation memory.
     */

    if (
      engine &&
      typeof engine.clearHistory ===
        "function"
    ) {

      engine.clearHistory();

    }


    const ui =
      getUI();


    if (
      ui &&
      typeof ui.clearConversation ===
        "function"
    ) {

      ui.clearConversation();

    }


    setStatus(
      "Ready to help"
    );

  }


  /* ================================================================
     OPEN / CLOSE / TOGGLE
     ================================================================ */

  function open() {

    const ui =
      getUI();


    if (
      ui &&
      typeof ui.open ===
        "function"
    ) {

      ui.open();

    }

  }


  function close() {

    const ui =
      getUI();


    if (
      ui &&
      typeof ui.close ===
        "function"
    ) {

      ui.close();

    }

  }


  function toggle() {

    const ui =
      getUI();


    if (
      ui &&
      typeof ui.toggle ===
        "function"
    ) {

      ui.toggle();

    }

  }


  /* ================================================================
     STATE
     ================================================================ */

  function getState() {

    return Object.freeze({

      initialized,

      busy,

      hasLastResponse:
        Boolean(
          lastAssistantResponse
        ),

      modules:
        Object.freeze({

          ui:
            Boolean(
              getUI()
            ),

          security:
            Boolean(
              getSecurity()
            ),

          cache:
            Boolean(
              getCache()
            ),

          search:
            Boolean(
              getSearch()
            ),

          voice:
            Boolean(
              getVoice()
            ),

          responseEngine:
            Boolean(
              getResponseEngine()
            )

        })

    });

  }


  /* ================================================================
     INITIALIZATION
     ================================================================ */

  function init() {

    if (initialized) {

      return getState();

    }


    /*
     * Cache
     */

    const cache =
      getCache();


    if (
      cache &&
      typeof cache.init ===
        "function"
    ) {

      try {

        cache.init();

      } catch (error) {

        console.warn(
          "[Vertex AI] Cache initialization failed:",
          error
        );

      }

    }


    /*
     * Voice
     */

    const voice =
      getVoice();


    if (
      voice &&
      typeof voice.init ===
        "function"
    ) {

      try {

        voice.init();

      } catch (error) {

        console.warn(
          "[Vertex AI] Voice initialization failed:",
          error
        );

      }

    }


    /*
     * UI
     */

    const ui =
      getUI();


    if (
      ui &&
      typeof ui.init ===
        "function"
    ) {

      try {

        ui.init({

          onSubmit:
            processQuestion

        });

      } catch (error) {

        console.error(
          "[Vertex AI] UI initialization failed:",
          error
        );

      }

    }


    initialized = true;


    setStatus(
      "Ready to help"
    );


    console.info(
      "[Vertex AI] Main orchestrator initialized."
    );


    console.info(
      "[Vertex AI] Response Engine:",
      getResponseEngine()
        ? "CONNECTED"
        : "NOT CONNECTED"
    );


    return getState();

  }


  /* ================================================================
     PUBLIC API
     ================================================================ */

  window.VertexAI =
    Object.freeze({

      init,

      open,

      close,

      toggle,

      processQuestion,

      clearConversation,

      cancelPendingResponse,

      replayLastResponse,

      getState

    });


  /* ================================================================
     START
     ================================================================ */

  init();


})();
