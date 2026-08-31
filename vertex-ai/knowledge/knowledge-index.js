/**
 * Vertex AI — Knowledge Index
 * ----------------------------------------------------------------------
 * Central registry for all approved Vertex AI knowledge sources.
 *
 * Responsibilities:
 * - Collect company knowledge
 * - Collect VSAS knowledge
 * - Collect internship knowledge
 * - Normalize the knowledge collections
 * - Provide a single read-only registry for the search engine
 *
 * This file does NOT:
 * - Call an AI API
 * - Search the database
 * - Query Supabase
 * - Handle authentication
 * - Handle voice
 * - Handle caching
 * - Render UI
 * ----------------------------------------------------------------------
 */

(function () {
  "use strict";

  const VERSION = "1.0.0";

  /*
   * ---------------------------------------------------------------
   * 1. SAFELY READ KNOWLEDGE SOURCES
   * ---------------------------------------------------------------
   *
   * The individual knowledge files expose their data through
   * window-based read-only registries.
   *
   * Missing modules are handled gracefully so the application
   * does not completely crash during development.
   */

  const companyKnowledge = Array.isArray(
    window.VertexAICompanyKnowledge
  )
    ? window.VertexAICompanyKnowledge
    : [];

  const vsasKnowledge = Array.isArray(
    window.VertexAIVSASKnowledge
  )
    ? window.VertexAIVSASKnowledge
    : [];

  const internshipKnowledge = Array.isArray(
    window.VertexAIInternshipKnowledge
  )
    ? window.VertexAIInternshipKnowledge
    : [];


  /*
   * ---------------------------------------------------------------
   * 2. SOURCE DEFINITIONS
   * ---------------------------------------------------------------
   */

  const sources = Object.freeze([
    Object.freeze({
      id: "company",
      name: "Visual Vertex Company Knowledge",
      category: "company",
      documents: companyKnowledge.length,
      available: companyKnowledge.length > 0
    }),

    Object.freeze({
      id: "vsas",
      name: "VSAS Knowledge",
      category: "vsas",
      documents: vsasKnowledge.length,
      available: vsasKnowledge.length > 0
    }),

    Object.freeze({
      id: "internship",
      name: "Internship Knowledge",
      category: "internship",
      documents: internshipKnowledge.length,
      available: internshipKnowledge.length > 0
    })
  ]);


  /*
   * ---------------------------------------------------------------
   * 3. BUILD UNIFIED KNOWLEDGE COLLECTION
   * ---------------------------------------------------------------
   *
   * Every document receives additional metadata identifying
   * where it came from.
   */

  function enrichDocument(document, source) {
    return Object.freeze({
      ...document,

      knowledgeSource: source.id,
      knowledgeSourceName: source.name,
      knowledgeVersion: VERSION
    });
  }


  const allDocuments = Object.freeze([
    ...companyKnowledge.map(function (document) {
      return enrichDocument(document, {
        id: "company",
        name: "Visual Vertex Company Knowledge"
      });
    }),

    ...vsasKnowledge.map(function (document) {
      return enrichDocument(document, {
        id: "vsas",
        name: "VSAS Knowledge"
      });
    }),

    ...internshipKnowledge.map(function (document) {
      return enrichDocument(document, {
        id: "internship",
        name: "Internship Knowledge"
      });
    })
  ]);


  /*
   * ---------------------------------------------------------------
   * 4. DOCUMENT LOOKUP MAP
   * ---------------------------------------------------------------
   *
   * This makes direct document retrieval extremely fast.
   *
   * Instead of searching through the entire array for a known ID,
   * future modules can perform:
   *
   * VertexAIKnowledgeIndex.getById("internship-duration")
   */

  const documentMap = new Map();

  allDocuments.forEach(function (document) {
    if (!document || !document.id) {
      return;
    }

    documentMap.set(document.id, document);
  });


  /*
   * ---------------------------------------------------------------
   * 5. CATEGORY INDEX
   * ---------------------------------------------------------------
   *
   * Groups documents by their main category.
   */

  const categoryMap = new Map();

  allDocuments.forEach(function (document) {
    const category =
      typeof document.category === "string"
        ? document.category.trim().toLowerCase()
        : "general";

    if (!categoryMap.has(category)) {
      categoryMap.set(category, []);
    }

    categoryMap.get(category).push(document);
  });


  /*
   * Freeze category arrays.
   */

  categoryMap.forEach(function (documents, category) {
    categoryMap.set(
      category,
      Object.freeze([...documents])
    );
  });


  /*
   * ---------------------------------------------------------------
   * 6. AVAILABLE CATEGORIES
   * ---------------------------------------------------------------
   */

  const categories = Object.freeze(
    Array.from(categoryMap.keys()).sort()
  );


  /*
   * ---------------------------------------------------------------
   * 7. PUBLIC API
   * ---------------------------------------------------------------
   */

  function getAll() {
    return allDocuments;
  }


  function getById(id) {
    if (typeof id !== "string") {
      return null;
    }

    return documentMap.get(id) || null;
  }


  function getByCategory(category) {
    if (typeof category !== "string") {
      return [];
    }

    const normalizedCategory =
      category.trim().toLowerCase();

    return categoryMap.get(normalizedCategory) || [];
  }


  function getBySource(sourceId) {
    if (typeof sourceId !== "string") {
      return [];
    }

    const normalizedSource =
      sourceId.trim().toLowerCase();

    return Object.freeze(
      allDocuments.filter(function (document) {
        return document.knowledgeSource === normalizedSource;
      })
    );
  }


  function hasDocument(id) {
    if (typeof id !== "string") {
      return false;
    }

    return documentMap.has(id);
  }


  function getCategories() {
    return categories;
  }


  function getSources() {
    return sources;
  }


  function getStats() {
    return Object.freeze({
      version: VERSION,

      totalDocuments: allDocuments.length,

      companyDocuments: companyKnowledge.length,

      vsasDocuments: vsasKnowledge.length,

      internshipDocuments: internshipKnowledge.length,

      categoryCount: categories.length,

      sourceCount: sources.length,

      availableSources: sources.filter(function (source) {
        return source.available;
      }).length
    });
  }


  /*
   * ---------------------------------------------------------------
   * 8. KNOWLEDGE HEALTH CHECK
   * ---------------------------------------------------------------
   */

  function getHealth() {
    const missingSources = sources
      .filter(function (source) {
        return !source.available;
      })
      .map(function (source) {
        return source.id;
      });

    return Object.freeze({
      healthy:
        allDocuments.length > 0 &&
        missingSources.length === 0,

      totalDocuments: allDocuments.length,

      missingSources: Object.freeze(
        [...missingSources]
      ),

      sourceCount: sources.length,

      loadedSourceCount: sources.filter(
        function (source) {
          return source.available;
        }
      ).length
    });
  }


  /*
   * ---------------------------------------------------------------
   * 9. SEARCH PREPARATION DATA
   * ---------------------------------------------------------------
   *
   * This does NOT perform searching.
   *
   * It simply creates a lightweight representation that the
   * future search engine can consume efficiently.
   */

  function buildSearchText(document) {
    const fields = [
      document.title,
      document.summary,
      document.shortAnswer,
      document.answer,

      ...(Array.isArray(document.keywords)
        ? document.keywords
        : []),

      ...(Array.isArray(document.synonyms)
        ? document.synonyms
        : []),

      ...(Array.isArray(document.phrases)
        ? document.phrases
        : []),

      ...(Array.isArray(document.questions)
        ? document.questions
        : []),

      ...(Array.isArray(document.alternativeQuestions)
        ? document.alternativeQuestions
        : []),

      ...(Array.isArray(document.tags)
        ? document.tags
        : [])
    ];

    return fields
      .filter(function (value) {
        return typeof value === "string";
      })
      .join(" ")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }


  const searchDocuments = Object.freeze(
    allDocuments.map(function (document) {
      return Object.freeze({
        id: document.id,

        category: document.category || "general",

        source:
          document.knowledgeSource || "unknown",

        title:
          document.title || "",

        searchText:
          buildSearchText(document),

        keywords: Object.freeze(
          Array.isArray(document.keywords)
            ? [...document.keywords]
            : []
        ),

        intents: Object.freeze(
          Array.isArray(document.intents)
            ? [...document.intents]
            : []
        ),

        priority:
          Number.isFinite(document.priority)
            ? document.priority
            : 0,

        retrievalWeight:
          Number.isFinite(document.retrievalWeight)
            ? document.retrievalWeight
            : 1
      });
    })
  );


  function getSearchDocuments() {
    return searchDocuments;
  }


  /*
   * ---------------------------------------------------------------
   * 10. CREATE PUBLIC INDEX
   * ---------------------------------------------------------------
   */

  const VertexAIKnowledgeIndex = Object.freeze({

    version: VERSION,

    getAll,

    getById,

    getByCategory,

    getBySource,

    hasDocument,

    getCategories,

    getSources,

    getStats,

    getHealth,

    getSearchDocuments
  });


  /*
   * ---------------------------------------------------------------
   * 11. EXPOSE INDEX
   * ---------------------------------------------------------------
   */

  window.VertexAIKnowledgeIndex = VertexAIKnowledgeIndex;


  /*
   * ---------------------------------------------------------------
   * 12. DEVELOPMENT LOG
   * ---------------------------------------------------------------
   */

  const stats = getStats();
  const health = getHealth();

  console.log(
    `[Vertex AI] Knowledge index loaded: ${stats.totalDocuments} documents.`
  );

  console.log(
    "[Vertex AI] Knowledge sources:",
    sources
  );

  console.log(
    "[Vertex AI] Knowledge health:",
    health
  );

})();