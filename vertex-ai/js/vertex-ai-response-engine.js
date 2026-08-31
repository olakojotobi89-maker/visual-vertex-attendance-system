/**
 * Vertex AI Response Engine
 * ---------------------------------------------------------------------------
 * Visual Vertex Technology Company
 *
 * PURPOSE
 * -------
 * Converts a user's question + retrieved knowledge into a useful,
 * natural-language response.
 *
 * PHASE 1
 * -------
 * - No paid AI API
 * - No external AI service
 * - Uses approved Visual Vertex / VSAS knowledge
 * - Uses VertexAISearch when available
 * - Understands common question variations
 * - Maintains lightweight conversation context
 * - Provides safe fallbacks when information is unavailable
 *
 * This module DOES NOT:
 * - manipulate the UI
 * - authenticate users
 * - access Supabase directly
 * - generate speech
 * - expose secrets
 *
 * ---------------------------------------------------------------------------
 */

(function () {
  "use strict";

  const CONFIG = window.VertexAIConfig || {};

  const responseConfig = CONFIG.response || {};

  const MAX_HISTORY =
    Number(responseConfig.maxHistory) > 0
      ? Number(responseConfig.maxHistory)
      : 8;

  const MAX_CONTEXT_RESULTS =
    Number(responseConfig.maxContextResults) > 0
      ? Number(responseConfig.maxContextResults)
      : 5;

  /*
   * -------------------------------------------------------------------------
   * Approved Visual Vertex knowledge
   * -------------------------------------------------------------------------
   *
   * This is intentionally focused on information we currently know about
   * Visual Vertex Technology Company and VSAS.
   */

  const KNOWLEDGE = [

    // -----------------------------------------------------------------------
    // COMPANY
    // -----------------------------------------------------------------------

    {
      id: "company",
      category: "company",

      keywords: [
        "visual vertex",
        "visual vertex technology",
        "visual vertex technology company",
        "vertex company",
        "company",
        "about visual vertex",
        "what does visual vertex do",
        "what is visual vertex"
      ],

      answer:
        "Visual Vertex Technology Company is a technology company focused on " +
        "providing digital and technology solutions. Its areas of service " +
        "include graphic design, web development, cybersecurity services, " +
        "data analytics, cloud solutions, and IT consultation."
    },

    {
      id: "company-services",
      category: "company",

      keywords: [
        "services",
        "what services",
        "services offered",
        "what do you offer",
        "what does the company offer",
        "company services",
        "visual vertex services"
      ],

      answer:
        "Visual Vertex Technology Company provides services across several " +
        "technology areas, including graphic design, web development, " +
        "cybersecurity, data analytics, cloud solutions, and IT consultation."
    },

    {
      id: "graphic-design",
      category: "company",

      keywords: [
        "graphic design",
        "graphics",
        "design",
        "flyer",
        "poster",
        "branding",
        "brand identity"
      ],

      answer:
        "Graphic design is one of Visual Vertex Technology Company's service " +
        "areas. The company works with visual communication and digital " +
        "creative materials, including branding, graphics, flyers, posters, " +
        "and related design work."
    },

    {
      id: "web-development",
      category: "company",

      keywords: [
        "web development",
        "website",
        "web design",
        "web developer",
        "frontend",
        "website development"
      ],

      answer:
        "Visual Vertex Technology Company provides web development and web " +
        "design services, covering the development of modern websites and " +
        "digital web-based solutions."
    },

    {
      id: "cybersecurity",
      category: "company",

      keywords: [
        "cybersecurity",
        "cyber security",
        "security",
        "information security",
        "digital security"
      ],

      answer:
        "Cybersecurity is one of Visual Vertex Technology Company's technology " +
        "service areas. The company focuses on helping organizations improve " +
        "their digital security and protect technology systems and information."
    },

    {
      id: "data-analytics",
      category: "company",

      keywords: [
        "data analytics",
        "data analysis",
        "analytics",
        "data"
      ],

      answer:
        "Visual Vertex Technology Company provides data analytics services, " +
        "helping organizations work with data to understand information and " +
        "support better decisions."
    },

    {
      id: "cloud",
      category: "company",

      keywords: [
        "cloud",
        "cloud solutions",
        "cloud computing",
        "cloud service"
      ],

      answer:
        "Cloud solutions are one of Visual Vertex Technology Company's service " +
        "areas. These solutions are focused on using cloud technologies to " +
        "support digital systems, applications, storage, and organizational needs."
    },

    {
      id: "it-consultation",
      category: "company",

      keywords: [
        "it consultation",
        "it consulting",
        "technology consultation",
        "consultation",
        "consulting"
      ],

      answer:
        "Visual Vertex Technology Company also provides IT consultation, " +
        "helping organizations identify technology needs, improve their " +
        "digital systems, and make informed technology decisions."
    },


    // -----------------------------------------------------------------------
    // VSAS
    // -----------------------------------------------------------------------

    {
      id: "vsas",
      category: "vsas",

      keywords: [
        "vsas",
        "what is vsas",
        "what does vsas mean",
        "staff administration system",
        "staff management system",
        "visual vertex staff administration system"
      ],

      answer:
        "VSAS stands for Visual Vertex Staff Administration System. It is the " +
        "internal staff and internship management platform used by Visual " +
        "Vertex Technology Company to organize staff-related activities and " +
        "administrative functions."
    },

    {
      id: "vsas-purpose",
      category: "vsas",

      keywords: [
        "purpose of vsas",
        "why was vsas created",
        "why vsas",
        "what is vsas used for",
        "use of vsas",
        "vsas purpose"
      ],

      answer:
        "VSAS was designed to provide a centralized platform for managing " +
        "staff and intern activities. It brings functions such as attendance, " +
        "departments, notifications, reports, and activity records into one " +
        "administrative system."
    },

    {
      id: "vsas-login",
      category: "vsas",

      keywords: [
        "login",
        "log in",
        "sign in",
        "how do i login",
        "how to login",
        "how do i sign in",
        "access vsas"
      ],

      answer:
        "To access VSAS, sign in using your authorized company account. After " +
        "authentication, the dashboard and available functions depend on your " +
        "assigned role and permissions."
    },

    {
      id: "vsas-dashboard",
      category: "vsas",

      keywords: [
        "dashboard",
        "vsas dashboard",
        "home page",
        "main page",
        "what is dashboard"
      ],

      answer:
        "The VSAS dashboard is the main working area of the system. The exact " +
        "information and features displayed depend on the user's role and " +
        "permissions."
    },


    // -----------------------------------------------------------------------
    // ATTENDANCE
    // -----------------------------------------------------------------------

    {
      id: "attendance",
      category: "attendance",

      keywords: [
        "attendance",
        "mark attendance",
        "mark my attendance",
        "clock in",
        "clock out",
        "check in",
        "check out",
        "attendance record",
        "record attendance",
        "present"
      ],

      answer:
        "Attendance is managed through the VSAS attendance system. Use the " +
        "attendance function available on your dashboard to record your " +
        "attendance. Your attendance record should accurately reflect your " +
        "actual participation."
    },

    {
      id: "attendance-problem",
      category: "attendance",

      keywords: [
        "attendance not working",
        "cannot mark attendance",
        "can't mark attendance",
        "attendance error",
        "attendance problem",
        "clock in not working",
        "check in not working"
      ],

      answer:
        "If you cannot record your attendance in VSAS, first make sure you are " +
        "properly signed in and that the attendance function is available to " +
        "your account. If the problem continues, report the issue through the " +
        "approved company support or administrative channel."
    },


    // -----------------------------------------------------------------------
    // INTERNSHIP
    // -----------------------------------------------------------------------

    {
      id: "internship",
      category: "internship",

      keywords: [
        "internship",
        "intern",
        "interns",
        "training",
        "programme",
        "program",
        "student",
        "students",
        "internship programme"
      ],

      answer:
        "The Visual Vertex internship and training programme provides " +
        "participants with practical exposure to areas such as graphic design, " +
        "web development, cybersecurity, business operations, and project-related " +
        "work. Participants are expected to attend scheduled activities, follow " +
        "company instructions, and use approved company systems."
    },

    {
      id: "internship-behaviour",
      category: "internship",

      keywords: [
        "intern rules",
        "internship rules",
        "what should interns do",
        "intern responsibilities",
        "intern responsibility",
        "student responsibility"
      ],

      answer:
        "Interns are expected to participate actively in scheduled activities, " +
        "follow company instructions, maintain professional conduct, and use " +
        "approved Visual Vertex systems and resources appropriately."
    },


    // -----------------------------------------------------------------------
    // DEPARTMENTS
    // -----------------------------------------------------------------------

    {
      id: "departments",
      category: "departments",

      keywords: [
        "department",
        "departments",
        "team",
        "teams",
        "which department",
        "staff department",
        "where do i work"
      ],

      answer:
        "VSAS uses departmental information to organize staff and interns. " +
        "The department and related functions available to you depend on " +
        "your account and assigned permissions."
    },


    // -----------------------------------------------------------------------
    // NOTIFICATIONS
    // -----------------------------------------------------------------------

    {
      id: "notifications",
      category: "notifications",

      keywords: [
        "notification",
        "notifications",
        "announcement",
        "announcements",
        "bell",
        "new notification",
        "what are notifications"
      ],

      answer:
        "VSAS notifications are used to communicate relevant updates and " +
        "announcements to users. Depending on your role, notifications may " +
        "relate to company activities, administration, attendance, announcements, " +
        "or other system events."
    },


    // -----------------------------------------------------------------------
    // REPORTS
    // -----------------------------------------------------------------------

    {
      id: "reports",
      category: "reports",

      keywords: [
        "report",
        "reports",
        "staff report",
        "attendance report",
        "generate report",
        "view report"
      ],

      answer:
        "VSAS reports provide authorized users with relevant administrative " +
        "and operational information. The reports available to you depend on " +
        "your assigned role and permissions."
    },


    // -----------------------------------------------------------------------
    // SECURITY
    // -----------------------------------------------------------------------

    {
      id: "security",
      category: "security",

      keywords: [
        "is vsas secure",
        "security",
        "vsas security",
        "account security",
        "password",
        "credentials",
        "protect my account"
      ],

      answer:
        "VSAS is designed with role-based access and security controls so that " +
        "users can access functions according to their assigned permissions. " +
        "Never share your password, authentication codes, private keys, or " +
        "other sensitive credentials with Vertex AI or another user."
    },


    // -----------------------------------------------------------------------
    // SUPPORT
    // -----------------------------------------------------------------------

    {
      id: "support",
      category: "support",

      keywords: [
        "help",
        "support",
        "problem",
        "issue",
        "error",
        "not working",
        "something is wrong",
        "system problem"
      ],

      answer:
        "I'm here to help you understand and use VSAS. If the issue requires " +
        "an administrative action that I cannot perform, use the approved " +
        "Visual Vertex support or administrative channel."
    }

  ];


  // =========================================================================
  // TEXT UTILITIES
  // =========================================================================

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFKC")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }


  function tokenize(text) {
    return normalize(text)
      .split(" ")
      .filter(function (word) {
        return word.length > 1;
      });
  }


  function includesAny(text, values) {
    return values.some(function (value) {
      return text.includes(normalize(value));
    });
  }


  // =========================================================================
  // INTENT DETECTION
  // =========================================================================

  function detectIntent(question) {
    const text = normalize(question);

    if (!text) {
      return "unknown";
    }

    if (
      /^(hi|hello|hey|hey there|good morning|good afternoon|good evening|yo)\b/
        .test(text)
    ) {
      return "greeting";
    }

    if (
      includesAny(text, [
        "thank you",
        "thanks",
        "thank u",
        "appreciate it"
      ])
    ) {
      return "thanks";
    }

    if (
      includesAny(text, [
        "who are you",
        "what are you",
        "what is vertex ai",
        "tell me about yourself"
      ])
    ) {
      return "assistant";
    }

    if (
      includesAny(text, [
        "visual vertex",
        "company",
        "services",
        "graphic design",
        "web development",
        "cybersecurity",
        "data analytics",
        "cloud",
        "consultation"
      ])
    ) {
      return "company";
    }

    if (
      includesAny(text, [
        "vsas",
        "staff administration",
        "staff management",
        "dashboard"
      ])
    ) {
      return "vsas";
    }

    if (
      includesAny(text, [
        "attendance",
        "clock in",
        "clock out",
        "check in",
        "check out",
        "present"
      ])
    ) {
      return "attendance";
    }

    if (
      includesAny(text, [
        "intern",
        "internship",
        "training",
        "programme",
        "program",
        "student"
      ])
    ) {
      return "internship";
    }

    if (
      includesAny(text, [
        "department",
        "departments",
        "team"
      ])
    ) {
      return "departments";
    }

    if (
      includesAny(text, [
        "notification",
        "notifications",
        "announcement",
        "announcements"
      ])
    ) {
      return "notifications";
    }

    if (
      includesAny(text, [
        "report",
        "reports"
      ])
    ) {
      return "reports";
    }

    if (
      includesAny(text, [
        "security",
        "password",
        "credentials",
        "secure"
      ])
    ) {
      return "security";
    }

    if (
      includesAny(text, [
        "help",
        "problem",
        "issue",
        "error",
        "not working"
      ])
    ) {
      return "support";
    }

    return "unknown";
  }


  // =========================================================================
  // KNOWLEDGE MATCHING
  // =========================================================================

  function scoreKnowledge(question, item) {
    const query = normalize(question);
    const queryTokens = new Set(tokenize(query));

    let score = 0;

    item.keywords.forEach(function (keyword) {
      const normalizedKeyword = normalize(keyword);

      if (!normalizedKeyword) {
        return;
      }

      if (query.includes(normalizedKeyword)) {
        score += normalizedKeyword.split(" ").length * 5;
      }

      const keywordTokens = tokenize(normalizedKeyword);

      keywordTokens.forEach(function (token) {
        if (queryTokens.has(token)) {
          score += 1;
        }
      });
    });

    return score;
  }


  function findBestKnowledge(question) {
    const ranked = KNOWLEDGE
      .map(function (item) {
        return {
          item: item,
          score: scoreKnowledge(question, item)
        };
      })
      .filter(function (result) {
        return result.score > 0;
      })
      .sort(function (a, b) {
        return b.score - a.score;
      });

    return ranked.slice(0, MAX_CONTEXT_RESULTS);
  }


  // =========================================================================
  // EXISTING SEARCH ENGINE INTEGRATION
  // =========================================================================

  function searchExistingKnowledge(question) {
    try {
      const searchEngine = window.VertexAISearch;

      if (!searchEngine) {
        return [];
      }

      const methods = [
        "search",
        "query",
        "find",
        "retrieve"
      ];

      for (let i = 0; i < methods.length; i += 1) {
        const method = methods[i];

        if (typeof searchEngine[method] !== "function") {
          continue;
        }

        const result = searchEngine[method](question);

        if (Array.isArray(result)) {
          return result.slice(0, MAX_CONTEXT_RESULTS);
        }

        if (result && Array.isArray(result.results)) {
          return result.results.slice(0, MAX_CONTEXT_RESULTS);
        }
      }
    } catch (error) {
      console.warn(
        "[Vertex AI] Existing knowledge search failed:",
        error
      );
    }

    return [];
  }


  // =========================================================================
  // CONVERSATION MEMORY
  // =========================================================================

  const history = [];

  function remember(role, content) {
    history.push({
      role: role,
      content: String(content || ""),
      timestamp: Date.now()
    });

    while (history.length > MAX_HISTORY) {
      history.shift();
    }
  }


  function getLastUserMessage() {
    for (let i = history.length - 1; i >= 0; i -= 1) {
      if (history[i].role === "user") {
        return history[i].content;
      }
    }

    return "";
  }


  // =========================================================================
  // SPECIAL RESPONSES
  // =========================================================================

  function greetingResponse() {
    return (
      "Hello! I'm Vertex AI, the assistant for Visual Vertex Technology " +
      "Company and the VSAS platform. I can help you with company information, " +
      "VSAS, attendance, internship activities, departments, notifications, " +
      "reports, and general guidance."
    );
  }


  function thanksResponse() {
    return "You're welcome! I'm here whenever you need help.";
  }


  function assistantResponse() {
    return (
      "I'm Vertex AI, the digital assistant integrated into VSAS. My role is " +
      "to help staff and interns understand Visual Vertex Technology Company " +
      "information and use the VSAS platform more effectively."
    );
  }


  function unknownResponse(question) {
    const previous = getLastUserMessage();

    if (
      previous &&
      normalize(question).length < 25 &&
      (
        normalize(question).includes("that") ||
        normalize(question).includes("it") ||
        normalize(question).includes("this") ||
        normalize(question).includes("more")
      )
    ) {
      return (
        "Sure. I can continue from your previous question, but I need a " +
        "little more detail about what you mean. Tell me what part you want " +
        "me to explain further."
      );
    }

    return (
      "I understand your question, but I don't currently have enough verified " +
      "information in my Visual Vertex knowledge base to give you a reliable " +
      "answer. I don't want to invent company information.\n\n" +
      "If your question is about VSAS, tell me what you're trying to do and " +
      "I'll guide you based on the information available to me."
    );
  }


  // =========================================================================
  // RESPONSE CLEANUP
  // =========================================================================

  function cleanResponse(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .replace(/\n /g, "\n")
      .trim();
  }


  // =========================================================================
  // MAIN RESPONSE GENERATOR
  // =========================================================================

  function generateResponse(question, options) {
    options = options || {};

    const rawQuestion = String(question || "").trim();

    if (!rawQuestion) {
      return {
        success: false,
        text: "Please enter a question and I'll do my best to help.",
        intent: "unknown",
        confidence: 0
      };
    }

    const intent = detectIntent(rawQuestion);

    remember("user", rawQuestion);

    let response = "";
    let confidence = 0;

    // -----------------------------------------------------------------------
    // Special conversational responses
    // -----------------------------------------------------------------------

    if (intent === "greeting") {
      response = greetingResponse();
      confidence = 1;
    }

    else if (intent === "thanks") {
      response = thanksResponse();
      confidence = 1;
    }

    else if (intent === "assistant") {
      response = assistantResponse();
      confidence = 1;
    }

    else {

      // ---------------------------------------------------------------
      // First use the existing VertexAISearch layer.
      // ---------------------------------------------------------------

      const existingResults =
        searchExistingKnowledge(rawQuestion);

      // ---------------------------------------------------------------
      // Then use the response engine's local matching layer.
      // ---------------------------------------------------------------

      const localResults =
        findBestKnowledge(rawQuestion);

      if (localResults.length > 0) {
        const best = localResults[0];

        response = best.item.answer;

        confidence =
          Math.min(
            0.98,
            0.50 + (best.score / 30)
          );

        // -------------------------------------------------------------
        // Add useful clarification for broad questions.
        // -------------------------------------------------------------

        if (
          intent === "vsas" &&
          normalize(rawQuestion).length < 18
        ) {
          response +=
            " If you want, you can also ask me about VSAS attendance, " +
            "departments, notifications, reports, login, or system support.";
        }

        if (
          intent === "company" &&
          normalize(rawQuestion).length < 20
        ) {
          response +=
            " You can ask me about our services, graphic design, web " +
            "development, cybersecurity, data analytics, cloud solutions, " +
            "or IT consultation.";
        }
      }

      else if (existingResults.length > 0) {

        const first = existingResults[0];

        if (typeof first === "string") {
          response = first;
        }

        else if (first.content) {
          response = first.content;
        }

        else if (first.answer) {
          response = first.answer;
        }

        else if (first.text) {
          response = first.text;
        }

        else {
          response = unknownResponse(rawQuestion);
        }

        confidence = 0.70;
      }

      else {
        response = unknownResponse(rawQuestion);
        confidence = 0.10;
      }
    }

    response = cleanResponse(response);

    remember("assistant", response);

    return {
      success: true,
      text: response,
      intent: intent,
      confidence: Number(confidence.toFixed(2)),
      source:
        confidence >= 0.5
          ? "visual-vertex-knowledge"
          : "fallback"
    };
  }


  // =========================================================================
  // PUBLIC API
  // =========================================================================

  window.VertexAIResponseEngine = {

    version: "1.0.0",

    respond: function (question, options) {
      return generateResponse(question, options);
    },

    ask: function (question, options) {
      return generateResponse(question, options);
    },

    detectIntent: detectIntent,

    getHistory: function () {
      return history.slice();
    },

    clearHistory: function () {
      history.length = 0;
    },

    getKnowledge: function () {
      return KNOWLEDGE.slice();
    }
  };


  console.log(
    "[Vertex AI] Response Engine initialized successfully."
  );

})();

