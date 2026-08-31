/**
 * ============================================================================
 * VISUAL VERTEX — VERTEX AI KNOWLEDGE SEARCH ENGINE
 * ============================================================================
 *
 * File:
 *   VSAS/vertex-ai/js/vertex-ai-search.js
 *
 * PURPOSE
 * -------
 * This module is the local knowledge retrieval engine for Vertex AI.
 *
 * It does NOT:
 *   - call an external AI API
 *   - contain API keys
 *   - connect directly to Supabase
 *   - authenticate users
 *   - manipulate the UI
 *   - generate speech
 *
 * It DOES:
 *   - normalize questions
 *   - expand useful synonyms
 *   - detect likely categories
 *   - search approved local knowledge
 *   - rank knowledge by relevance
 *   - calculate confidence
 *   - integrate with VertexAISecurity
 *   - integrate with VertexAICache
 *   - expose a clean API to vertex-ai.js
 *
 * KNOWLEDGE SOURCES
 * -----------------
 * The preferred architecture is:
 *
 *   company-knowledge.js
 *   vsas-knowledge.js
 *   internship-knowledge.js
 *   knowledge-index.js
 *
 * These modules expose approved knowledge to this search engine.
 *
 * ============================================================================
 */

(function () {
  "use strict";


  /* ==========================================================================
     1. CONFIGURATION
     ========================================================================== */

  const CONFIG = window.VertexAIConfig || {};

  const KNOWLEDGE_CONFIG =
    CONFIG.knowledge && typeof CONFIG.knowledge === "object"
      ? CONFIG.knowledge
      : {};

  const SEARCH_CONFIG =
    KNOWLEDGE_CONFIG.search &&
    typeof KNOWLEDGE_CONFIG.search === "object"
      ? KNOWLEDGE_CONFIG.search
      : {};


  const MAX_RESULTS =
    Number(SEARCH_CONFIG.maxResults) > 0
      ? Math.min(Number(SEARCH_CONFIG.maxResults), 20)
      : 5;


  const MINIMUM_SCORE =
    Number(SEARCH_CONFIG.minimumScore) >= 0
      ? Number(SEARCH_CONFIG.minimumScore)
      : 0.28;


  const STRONG_MATCH_SCORE =
    Number(SEARCH_CONFIG.strongMatchScore) >= 0
      ? Number(SEARCH_CONFIG.strongMatchScore)
      : 0.72;


  const MAX_QUERY_LENGTH =
    Number(SEARCH_CONFIG.maxQueryLength) > 0
      ? Number(SEARCH_CONFIG.maxQueryLength)
      : 500;


  const MAX_INDEX_DOCUMENTS = 5000;


  /* ==========================================================================
     2. SEARCH WEIGHTS
     ========================================================================== */

  const WEIGHTS = Object.freeze({
    exactQuestion: 0.38,
    exactPhrase: 0.30,
    title: 0.22,
    keyword: 0.34,
    content: 0.16,
    category: 0.08,
    priority: 0.05,
    fuzzy: 0.08
  });


  /* ==========================================================================
     3. STOP WORDS
     ========================================================================== */

  const STOP_WORDS = new Set([
    "a",
    "an",
    "and",
    "are",
    "am",
    "be",
    "but",
    "by",
    "can",
    "could",
    "do",
    "does",
    "for",
    "from",
    "how",
    "i",
    "in",
    "is",
    "it",
    "me",
    "my",
    "of",
    "on",
    "or",
    "our",
    "please",
    "should",
    "tell",
    "the",
    "to",
    "what",
    "when",
    "where",
    "which",
    "who",
    "why",
    "will",
    "with",
    "would",
    "you",
    "your"
  ]);


  /* ==========================================================================
     4. SYNONYM MAP
     ========================================================================== */

  const SYNONYMS = Object.freeze({

    attendance: [
      "attendance",
      "present",
      "clock",
      "clockin",
      "clockout",
      "checkin",
      "checkin",
      "record"
    ],

    login: [
      "login",
      "signin",
      "sign",
      "authentication",
      "access",
      "account"
    ],

    staff: [
      "staff",
      "employee",
      "employees",
      "worker",
      "workers",
      "personnel"
    ],

    intern: [
      "intern",
      "interns",
      "internship",
      "trainee",
      "training",
      "student",
      "students"
    ],

    company: [
      "company",
      "organization",
      "business",
      "visual",
      "vertex"
    ],

    department: [
      "department",
      "departments",
      "team",
      "teams",
      "unit"
    ],

    notification: [
      "notification",
      "notifications",
      "announcement",
      "announcements",
      "alert",
      "alerts"
    ],

    report: [
      "report",
      "reports",
      "record",
      "records",
      "summary"
    ],

    help: [
      "help",
      "support",
      "problem",
      "issue",
      "error",
      "trouble"
    ],

    website: [
      "website",
      "web",
      "site",
      "webpage",
      "platform"
    ],

    security: [
      "security",
      "cybersecurity",
      "cyber",
      "protection",
      "information security"
    ],

    design: [
      "design",
      "graphics",
      "graphic",
      "branding",
      "creative"
    ]
  });


  /* ==========================================================================
     5. CATEGORY KEYWORDS
     ========================================================================== */

  const CATEGORY_TERMS = Object.freeze({

    company: [
      "company",
      "visual vertex",
      "about visual vertex",
      "who are you",
      "what does the company do"
    ],

    services: [
      "service",
      "services",
      "graphic design",
      "web development",
      "cybersecurity",
      "data analytics",
      "cloud",
      "consultation"
    ],

    vsas: [
      "vsas",
      "staff administration",
      "staff management",
      "dashboard",
      "system"
    ],

    attendance: [
      "attendance",
      "mark attendance",
      "clock in",
      "clock out",
      "present"
    ],

    internship: [
      "intern",
      "internship",
      "training",
      "programme",
      "students"
    ],

    departments: [
      "department",
      "departments",
      "team"
    ],

    notifications: [
      "notification",
      "notifications",
      "announcement",
      "announcements"
    ],

    reports: [
      "report",
      "reports",
      "generate report"
    ],

    policies: [
      "policy",
      "policies",
      "rules",
      "company rules"
    ],

    support: [
      "help",
      "support",
      "problem",
      "issue",
      "error",
      "not working"
    ]
  });


  /* ==========================================================================
     6. INTERNAL INDEX
     ========================================================================== */

  let KNOWLEDGE = [];

  let INDEX_READY = false;

  let INDEX_SIGNATURE = "";


  /* ==========================================================================
     7. TEXT NORMALIZATION
     ========================================================================== */

  function normalizeText(value) {

    if (
      value === null ||
      value === undefined
    ) {
      return "";
    }


    let text = String(value);


    if (typeof text.normalize === "function") {
      text = text.normalize("NFKC");
    }


    return text
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[-_/]+/g, " ")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }


  /* ==========================================================================
     8. TOKENIZATION
     ========================================================================== */

  function tokenize(value) {

    const normalized = normalizeText(value);


    if (!normalized) {
      return [];
    }


    return normalized
      .split(" ")
      .filter(function (token) {

        return (
          token.length > 1 &&
          !STOP_WORDS.has(token)
        );

      });
  }


  function tokenSet(value) {

    return new Set(
      tokenize(value)
    );
  }


  /* ==========================================================================
     9. BASIC WORD STEMMING
     ========================================================================== */

  function stemWord(word) {

    const value = String(word || "");


    if (value.length <= 4) {
      return value;
    }


    if (value.endsWith("ies")) {
      return value.slice(0, -3) + "y";
    }


    if (value.endsWith("ing")) {
      return value.slice(0, -3);
    }


    if (value.endsWith("ed")) {
      return value.slice(0, -2);
    }


    if (
      value.endsWith("es") &&
      value.length > 5
    ) {
      return value.slice(0, -2);
    }


    if (
      value.endsWith("s") &&
      !value.endsWith("ss") &&
      value.length > 4
    ) {
      return value.slice(0, -1);
    }


    return value;
  }


  /* ==========================================================================
     10. STEMMED TOKEN SET
     ========================================================================== */

  function stemmedTokenSet(value) {

    const result = new Set();


    tokenize(value).forEach(function (token) {

      result.add(
        stemWord(token)
      );

    });


    return result;
  }


  /* ==========================================================================
     11. TOKEN OVERLAP
     ========================================================================== */

  function tokenOverlap(
    queryTokens,
    documentTokens
  ) {

    if (
      !queryTokens.size ||
      !documentTokens.size
    ) {
      return 0;
    }


    let matches = 0;


    queryTokens.forEach(function (token) {

      if (documentTokens.has(token)) {
        matches += 1;
      }

    });


    return matches / queryTokens.size;
  }


  /* ==========================================================================
     12. STEMMED TOKEN OVERLAP
     ========================================================================== */

  function stemmedOverlap(
    queryTokens,
    documentTokens
  ) {

    if (
      !queryTokens.size ||
      !documentTokens.size
    ) {
      return 0;
    }


    let matches = 0;


    queryTokens.forEach(function (token) {

      const stem =
        stemWord(token);


      if (documentTokens.has(stem)) {
        matches += 1;
      }

    });


    return matches / queryTokens.size;
  }


  /* ==========================================================================
     13. PHRASE MATCH
     ========================================================================== */

  function containsPhrase(
    query,
    value
  ) {

    const normalizedQuery =
      normalizeText(query);


    const normalizedValue =
      normalizeText(value);


    if (
      !normalizedQuery ||
      !normalizedValue
    ) {
      return false;
    }


    return normalizedValue.includes(
      normalizedQuery
    );
  }


  /* ==========================================================================
     14. WORD-LEVEL PHRASE MATCH
     ========================================================================== */

  function countMatchingPhrases(
    queryTokens,
    value
  ) {

    const normalized =
      normalizeText(value);


    if (
      !normalized ||
      !queryTokens.length
    ) {
      return 0;
    }


    let matches = 0;


    for (
      let size = Math.min(4, queryTokens.length);
      size >= 2;
      size--
    ) {

      for (
        let i = 0;
        i <= queryTokens.length - size;
        i++
      ) {

        const phrase =
          queryTokens
            .slice(i, i + size)
            .join(" ");


        if (
          normalized.includes(phrase)
        ) {
          matches++;
        }

      }

    }


    return matches;
  }


  /* ==========================================================================
     15. FUZZY WORD MATCH
     ========================================================================== */

  function fuzzyWordMatch(
    queryWord,
    documentWord
  ) {

    const query =
      stemWord(
        normalizeText(queryWord)
      );


    const document =
      stemWord(
        normalizeText(documentWord)
      );


    if (
      !query ||
      !document
    ) {
      return false;
    }


    if (
      query === document
    ) {
      return true;
    }


    if (
      query.length >= 5 &&
      document.length >= 5
    ) {

      if (
        document.includes(query) ||
        query.includes(document)
      ) {
        return true;
      }

    }


    return false;
  }


  /* ==========================================================================
     16. FUZZY OVERLAP
     ========================================================================== */

  function fuzzyOverlap(
    queryTokens,
    documentTokens
  ) {

    if (
      !queryTokens.length ||
      !documentTokens.length
    ) {
      return 0;
    }


    let matches = 0;


    queryTokens.forEach(function (queryToken) {

      for (
        let i = 0;
        i < documentTokens.length;
        i++
      ) {

        if (
          fuzzyWordMatch(
            queryToken,
            documentTokens[i]
          )
        ) {

          matches++;
          break;

        }

      }

    });


    return matches / queryTokens.length;
  }


  /* ==========================================================================
     17. SYNONYM EXPANSION
     ========================================================================== */

  function expandTokens(tokens) {

    const expanded =
      new Set(tokens);


    tokens.forEach(function (token) {

      const stem =
        stemWord(token);


      Object.keys(SYNONYMS)
        .forEach(function (group) {

          const words =
            SYNONYMS[group];


          if (
            words.includes(token) ||
            words.includes(stem)
          ) {

            words.forEach(function (word) {

              expanded.add(
                normalizeText(word)
              );

            });

          }

        });

    });


    return expanded;
  }


  /* ==========================================================================
     18. CATEGORY DETECTION
     ========================================================================== */

  function detectCategories(query) {

    const normalized =
      normalizeText(query);


    if (!normalized) {
      return [];
    }


    const matches = [];


    Object.keys(CATEGORY_TERMS)
      .forEach(function (category) {

        const terms =
          CATEGORY_TERMS[category];


        let score = 0;


        terms.forEach(function (term) {

          const normalizedTerm =
            normalizeText(term);


          if (
            normalized.includes(
              normalizedTerm
            )
          ) {
            score++;
          }

        });


        if (score > 0) {

          matches.push({
            category,
            score
          });

        }

      });


    matches.sort(function (a, b) {

      return b.score - a.score;

    });


    return matches;
  }


  /* ==========================================================================
     19. KNOWLEDGE SOURCE DISCOVERY
     ========================================================================== */

  function collectKnowledgeSources() {

    const sources = [];


    /*
     * Preferred source:
     * knowledge-index.js
     */

    const index =
      window.VertexAIKnowledgeIndex;


    if (index) {

      const candidates = [];


      if (
        typeof index.getAll === "function"
      ) {
        candidates.push(
          index.getAll()
        );
      }


      if (
        typeof index.getKnowledge === "function"
      ) {
        candidates.push(
          index.getKnowledge()
        );
      }


      if (
        typeof index.getDocuments === "function"
      ) {
        candidates.push(
          index.getDocuments()
        );
      }


      if (
        Array.isArray(index.documents)
      ) {
        candidates.push(
          index.documents
        );
      }


      if (
        Array.isArray(index.knowledge)
      ) {
        candidates.push(
          index.knowledge
        );
      }


      candidates.forEach(function (candidate) {

        if (
          Array.isArray(candidate)
        ) {
          candidate.forEach(function (entry) {

            sources.push(entry);

          });
        }

      });

    }


    /*
     * Dedicated knowledge modules.
     */

    const globals = [
      "VertexAICompanyKnowledge",
      "VertexAIVSASKnowledge",
      "VertexAIInternshipKnowledge"
    ];


    globals.forEach(function (name) {

      const source =
        window[name];


      if (
        Array.isArray(source)
      ) {

        source.forEach(function (entry) {

          sources.push(entry);

        });

      }

    });


    return sources;

  }


  /* ==========================================================================
     20. NORMALIZE KNOWLEDGE DOCUMENT
     ========================================================================== */

  function normalizeDocument(
    document,
    index
  ) {

    if (
      !document ||
      typeof document !== "object"
    ) {
      return null;
    }


    const content =
      document.content ||
      document.answer ||
      document.description ||
      "";


    const keywords =
      Array.isArray(document.keywords)
        ? document.keywords
        : [];


    const questions =
      Array.isArray(document.questions)
        ? document.questions
        : Array.isArray(document.alternatives)
          ? document.alternatives
          : [];


    const title =
      document.title ||
      document.name ||
      document.id ||
      "Knowledge";


    const category =
      document.category ||
      "general";


    const priority =
      Number(document.priority);


    return {
      id:
        String(
          document.id ||
          "knowledge-" + index
        ),

      category:
        String(category),

      title:
        String(title),

      content:
        String(content),

      keywords:
        keywords.map(function (item) {
          return String(item);
        }),

      questions:
        questions.map(function (item) {
          return String(item);
        }),

      priority:
        Number.isFinite(priority)
          ? priority
          : 5
    };

  }


  /* ==========================================================================
     21. PREPARE SEARCH DOCUMENT
     ========================================================================== */

  function prepareDocument(
    document
  ) {

    const keywordText =
      document.keywords.join(" ");


    const questionText =
      document.questions.join(" ");


    const searchableText = [
      document.title,
      keywordText,
      questionText,
      document.content
    ].join(" ");


    return Object.freeze({

      ...document,

      normalizedTitle:
        normalizeText(document.title),

      normalizedKeywords:
        normalizeText(keywordText),

      normalizedQuestions:
        normalizeText(questionText),

      normalizedContent:
        normalizeText(document.content),

      normalizedSearchText:
        normalizeText(searchableText),

      titleTokens:
        tokenSet(document.title),

      keywordTokens:
        tokenSet(keywordText),

      questionTokens:
        tokenSet(questionText),

      contentTokens:
        tokenSet(document.content),

      searchTokens:
        tokenSet(searchableText),

      stemmedSearchTokens:
        stemmedTokenSet(searchableText)

    });

  }


  /* ==========================================================================
     22. BUILD INDEX
     ========================================================================== */

  function buildIndex() {

    const rawSources =
      collectKnowledgeSources();


    const seen =
      new Set();


    const documents = [];


    rawSources.forEach(function (
      raw,
      index
    ) {

      const normalized =
        normalizeDocument(
          raw,
          index
        );


      if (!normalized) {
        return;
      }


      if (
        !normalized.content &&
        !normalized.questions.length &&
        !normalized.keywords.length
      ) {
        return;
      }


      if (
        seen.has(normalized.id)
      ) {
        return;
      }


      seen.add(
        normalized.id
      );


      documents.push(
        prepareDocument(
          normalized
        )
      );

    });


    /*
     * Safety limit.
     */

    KNOWLEDGE =
      documents.slice(
        0,
        MAX_INDEX_DOCUMENTS
      );


    INDEX_READY = true;


    INDEX_SIGNATURE =
      KNOWLEDGE
        .map(function (item) {
          return item.id;
        })
        .join("|");


    return KNOWLEDGE.length;

  }


  /* ==========================================================================
     23. ENSURE INDEX
     ========================================================================== */

  function ensureIndex() {

    if (!INDEX_READY) {
      buildIndex();
    }


    /*
     * If the knowledge index appears after this
     * script was loaded, rebuild automatically.
     */

    const sources =
      collectKnowledgeSources();


    const signature =
      sources
        .map(function (item) {
          return item && item.id
            ? String(item.id)
            : "";
        })
        .filter(Boolean)
        .join("|");


    if (
      signature &&
      signature !== INDEX_SIGNATURE
    ) {

      buildIndex();

    }


    return KNOWLEDGE;

  }


  /* ==========================================================================
     24. QUERY PREPARATION
     ========================================================================== */

  function prepareQuery(
    query
  ) {

    let cleanQuery = "";


    if (
      window.VertexAISecurity &&
      typeof window.VertexAISecurity.validateQuestion === "function"
    ) {

      const validation =
        window.VertexAISecurity
          .validateQuestion(query);


      if (
        !validation ||
        !validation.valid
      ) {
        return null;
      }


      cleanQuery =
        validation.value;

    } else {

      cleanQuery =
        String(query || "")
          .trim()
          .slice(
            0,
            MAX_QUERY_LENGTH
          );

    }


    cleanQuery =
      normalizeText(
        cleanQuery
      );


    if (!cleanQuery) {
      return null;
    }


    const rawTokens =
      tokenize(cleanQuery);


    const expandedTokens =
      expandTokens(
        rawTokens
      );


    return {
      text: cleanQuery,

      tokens: rawTokens,

      expandedTokens:
        Array.from(
          expandedTokens
        ),

      tokenSet:
        new Set(rawTokens),

      expandedTokenSet:
        expandedTokens,

      stemmedTokenSet:
        stemmedTokenSet(
          cleanQuery
        ),

      categories:
        detectCategories(
          cleanQuery
        )
    };

  }


  /* ==========================================================================
     25. CATEGORY MATCH SCORE
     ========================================================================== */

  function categoryMatchScore(
    queryInfo,
    document
  ) {

    if (
      !queryInfo.categories.length ||
      !document.category
    ) {
      return 0;
    }


    const documentCategory =
      normalizeText(
        document.category
      );


    let score = 0;


    queryInfo.categories.forEach(function (
      match
    ) {

      if (
        normalizeText(
          match.category
        ) === documentCategory
      ) {

        score +=
          Math.min(
            match.score * 0.5,
            1
          );

      }

    });


    return Math.min(
      score,
      1
    );

  }


  /* ==========================================================================
     26. PRIORITY SCORE
     ========================================================================== */

  function priorityScore(
    priority
  ) {

    const value =
      Number(priority);


    if (
      !Number.isFinite(value)
    ) {
      return 0.5;
    }


    return Math.min(
      Math.max(
        value / 10,
        0
      ),
      1
    );

  }


  /* ==========================================================================
     27. DOCUMENT SCORING
     ========================================================================== */

  function scoreDocument(
    queryInfo,
    document
  ) {

    if (
      !queryInfo ||
      !document
    ) {
      return 0;
    }


    const queryTokens =
      queryInfo.tokens;


    const expandedTokens =
      queryInfo.expandedTokens;


    if (!queryTokens.length) {
      return 0;
    }


    /*
     * Exact question match.
     */

    let exactQuestion =
      0;


    for (
      let i = 0;
      i < document.questions.length;
      i++
    ) {

      if (
        containsPhrase(
          queryInfo.text,
          document.questions[i]
        ) ||
        containsPhrase(
          document.questions[i],
          queryInfo.text
        )
      ) {

        exactQuestion = 1;
        break;

      }

    }


    /*
     * Exact phrase match.
     */

    const exactPhrase =
      containsPhrase(
        queryInfo.text,
        document.normalizedTitle
      ) ||
      containsPhrase(
        queryInfo.text,
        document.normalizedKeywords
      ) ||
      containsPhrase(
        queryInfo.text,
        document.normalizedQuestions
      )
        ? 1
        : 0;


    /*
     * Normal token overlap.
     */

    const titleOverlap =
      tokenOverlap(
        queryInfo.tokenSet,
        document.titleTokens
      );


    const keywordOverlap =
      tokenOverlap(
        queryInfo.tokenSet,
        document.keywordTokens
      );


    const contentOverlap =
      tokenOverlap(
        queryInfo.tokenSet,
        document.contentTokens
      );


    /*
     * Expanded synonym overlap.
     */

    const expandedKeywordOverlap =
      tokenOverlap(
        new Set(expandedTokens),
        document.keywordTokens
      );


    /*
     * Stemmed match.
     */

    const stemmedOverlapScore =
      stemmedOverlap(
        queryInfo.tokenSet,
        document.stemmedSearchTokens
      );


    /*
     * Fuzzy match.
     */

    const fuzzyScore =
      fuzzyOverlap(
        queryTokens,
        Array.from(
          document.searchTokens
        )
      );


    /*
     * Phrase fragments.
     */

    const phraseMatches =
      countMatchingPhrases(
        queryTokens,
        document.normalizedSearchText
      );


    const phraseBoost =
      Math.min(
        phraseMatches * 0.035,
        0.12
      );


    /*
     * Category relevance.
     */

    const categoryScore =
      categoryMatchScore(
        queryInfo,
        document
      );


    /*
     * Priority.
     */

    const priority =
      priorityScore(
        document.priority
      );


    /*
     * Main score.
     */

    let score =
      exactQuestion *
        WEIGHTS.exactQuestion +

      exactPhrase *
        WEIGHTS.exactPhrase +

      titleOverlap *
        WEIGHTS.title +

      Math.max(
        keywordOverlap,
        expandedKeywordOverlap
      ) *
        WEIGHTS.keyword +

      contentOverlap *
        WEIGHTS.content +

      categoryScore *
        WEIGHTS.category +

      priority *
        WEIGHTS.priority +

      Math.max(
        stemmedOverlapScore,
        fuzzyScore
      ) *
        WEIGHTS.fuzzy;


    /*
     * Phrase boost.
     */

    score +=
      phraseBoost;


    /*
     * If several query terms appear in
     * the title, reward that strongly.
     */

    if (
      titleOverlap >= 0.75
    ) {

      score += 0.06;

    }


    /*
     * Strong keyword match.
     */

    if (
      keywordOverlap >= 0.70
    ) {

      score += 0.08;

    }


    /*
     * Keep score between 0 and 1.
     */

    return Math.min(
      Math.max(
        score,
        0
      ),
      1
    );

  }


  /* ==========================================================================
     28. CONFIDENCE
     ========================================================================== */

  function getConfidence(
    score
  ) {

    if (
      score >= 0.82
    ) {
      return "very-high";
    }


    if (
      score >= STRONG_MATCH_SCORE
    ) {
      return "high";
    }


    if (
      score >= 0.50
    ) {
      return "medium";
    }


    if (
      score >= MINIMUM_SCORE
    ) {
      return "low";
    }


    return "none";

  }


  /* ==========================================================================
     29. SEARCH
     ========================================================================== */

  function search(
    query,
    options
  ) {

    const opts =
      options &&
      typeof options === "object"
        ? options
        : {};


    const queryInfo =
      prepareQuery(
        query
      );


    if (!queryInfo) {
      return [];
    }


    const documents =
      ensureIndex();


    if (!documents.length) {
      return [];
    }


    const requestedCategory =
      typeof opts.category === "string"
        ? normalizeText(
            opts.category
          )
        : "";


    const maxResults =
      Number(opts.maxResults) > 0
        ? Math.min(
            Number(opts.maxResults),
            MAX_RESULTS
          )
        : MAX_RESULTS;


    const scored = [];


    documents.forEach(function (
      document
    ) {

      if (
        requestedCategory &&
        normalizeText(
          document.category
        ) !== requestedCategory
      ) {
        return;
      }


      const score =
        scoreDocument(
          queryInfo,
          document
        );


      if (
        score < MINIMUM_SCORE
      ) {
        return;
      }


      scored.push({

        id:
          document.id,

        category:
          document.category,

        title:
          document.title,

        content:
          document.content,

        keywords:
          document.keywords.slice(),

        questions:
          document.questions.slice(),

        priority:
          document.priority,

        score:
          Number(
            score.toFixed(4)
          ),

        confidence:
          getConfidence(
            score
          ),

        strongMatch:
          score >= STRONG_MATCH_SCORE

      });

    });


    /*
     * Highest score first.
     *
     * Priority acts as a secondary tie-breaker.
     */

    scored.sort(function (
      a,
      b
    ) {

      if (
        b.score !== a.score
      ) {
        return b.score - a.score;
      }


      return (
        b.priority -
        a.priority
      );

    });


    return scored.slice(
      0,
      maxResults
    );

  }


  /* ==========================================================================
     30. BEST MATCH
     ========================================================================== */

  function findBestMatch(
    query,
    options
  ) {

    const results =
      search(
        query,
        {
          ...(options || {}),
          maxResults: 1
        }
      );


    return results.length
      ? results[0]
      : null;

  }


  /* ==========================================================================
     31. RETRIEVE
     ========================================================================== */

  function retrieve(
    query,
    options
  ) {

    let cleanQuery =
      String(query || "")
        .trim()
        .slice(
          0,
          MAX_QUERY_LENGTH
        );


    if (
      window.VertexAISecurity &&
      typeof window.VertexAISecurity.sanitizeText === "function"
    ) {

      cleanQuery =
        window.VertexAISecurity
          .sanitizeText(
            cleanQuery,
            MAX_QUERY_LENGTH
          );

    }


    if (!cleanQuery) {
      return null;
    }


    /*
     * Cache lookup.
     */

    if (
      window.VertexAICache &&
      typeof window.VertexAICache.get === "function"
    ) {

      const cached =
        window.VertexAICache.get(
          cleanQuery
        );


      if (
        cached !== null &&
        cached !== undefined
      ) {

        return {

          source:
            "cache",

          cached:
            true,

          query:
            cleanQuery,

          answer:
            cached.answer ||
            null,

          result:
            cached.result ||
            null

        };

      }

    }


    /*
     * Knowledge search.
     */

    const result =
      findBestMatch(
        cleanQuery,
        options
      );


    if (!result) {

      return {

        source:
          "knowledge",

        cached:
          false,

        query:
          cleanQuery,

        answer:
          null,

        result:
          null,

        confidence:
          "none"

      };

    }


    const response = {

      source:
        "knowledge",

      cached:
        false,

      query:
        cleanQuery,

      answer:
        result.content,

      result:
        result,

      confidence:
        result.confidence

    };


    /*
     * Cache approved knowledge result.
     */

    if (
      window.VertexAICache &&
      typeof window.VertexAICache.set === "function"
    ) {

      window.VertexAICache.set(
        cleanQuery,
        {
          answer:
            response.answer,

          result:
            response.result,

          confidence:
            response.confidence
        }
      );

    }


    return response;

  }


  /* ==========================================================================
     32. MULTI-RESULT RETRIEVAL
     ========================================================================== */

  function retrieveContext(
    query,
    options
  ) {

    const results =
      search(
        query,
        {
          ...(options || {}),
          maxResults:
            options &&
            Number(options.maxResults) > 0
              ? options.maxResults
              : 3
        }
      );


    if (!results.length) {

      return {

        query:
          normalizeText(query),

        results:
          [],

        confidence:
          "none",

        hasMatch:
          false

      };

    }


    return {

      query:
        normalizeText(query),

      results:
        results,

      confidence:
        results[0].confidence,

      hasMatch:
        true

    };

  }


  /* ==========================================================================
     33. SUGGESTED CATEGORY
     ========================================================================== */

  function getSuggestedCategory(
    query
  ) {

    const categories =
      detectCategories(
        query
      );


    return categories.length
      ? categories[0].category
      : null;

  }


  /* ==========================================================================
     34. CATEGORIES
     ========================================================================== */

  function getCategories() {

    const categories =
      new Set();


    ensureIndex()
      .forEach(function (document) {

        if (
          document.category
        ) {

          categories.add(
            document.category
          );

        }

      });


    return Array.from(
      categories
    );

  }


  /* ==========================================================================
     35. KNOWLEDGE STATISTICS
     ========================================================================== */

  function getKnowledgeStats() {

    const documents =
      ensureIndex();


    return Object.freeze({

      documents:
        documents.length,

      categories:
        getCategories().length,

      categoriesList:
        Object.freeze(
          getCategories()
        ),

      indexed:
        INDEX_READY,

      maxDocuments:
        MAX_INDEX_DOCUMENTS

    });

  }


  /* ==========================================================================
     36. REBUILD INDEX
     ========================================================================== */

  function rebuildIndex() {

    INDEX_READY = false;

    INDEX_SIGNATURE = "";

    KNOWLEDGE = [];

    return buildIndex();

  }


  /* ==========================================================================
     37. PUBLIC API
     ========================================================================== */

  window.VertexAISearch =
    Object.freeze({

      search,

      findBestMatch,

      retrieve,

      retrieveContext,

      getSuggestedCategory,

      getCategories,

      getKnowledgeStats,

      rebuildIndex,

      normalizeText,

      tokenize,

      stemWord

    });


  /* ==========================================================================
     38. INITIALIZE
     ========================================================================== */

  buildIndex();


  /* ==========================================================================
     39. DEVELOPMENT LOGGING
     ========================================================================== */

  if (
    CONFIG.development &&
    CONFIG.development.consoleLogging === true
  ) {

    console.info(
      "[Vertex AI] Knowledge search engine ready.",
      getKnowledgeStats()
    );

  }

})();