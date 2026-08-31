/**
 * Visual Vertex Technology Company Knowledge Base
 * ----------------------------------------------------------------------
 * This file contains approved knowledge about Visual Vertex Technology
 * Company for the Vertex AI Assistant.
 *
 * Responsibilities:
 * - Store structured company knowledge as data only
 * - Attach rich retrieval metadata (intents, synonyms, phrases,
 *   related topics, etc.) so a future search/retrieval engine can
 *   understand different ways users may ask the same question
 * - Provide approved answers (short and detailed) for knowledge
 *   retrieval
 * - Provide follow-up suggestions to help a future chat experience
 *   feel more conversational
 *
 * This file must NOT contain:
 * - UI logic
 * - DOM manipulation
 * - Search / ranking / confidence-scoring logic
 * - AI API calls
 * - API keys
 * - Supabase queries
 * - Authentication logic
 * - Voice functionality
 * - Caching implementation
 *
 * A separate file (e.g. knowledge-index.js / vertex-ai-search.js) is
 * responsible for consuming this data and actually performing
 * matching, scoring, and retrieval. This file only supplies clean,
 * well-structured data for that system to use.
 * ----------------------------------------------------------------------
 *
 * ENTRY SHAPE
 * ----------------------------------------------------------------------
 * Every entry in COMPANY_KNOWLEDGE follows the same shape so a future
 * search engine can rely on consistent fields across the whole base:
 *
 *   id                 unique string identifier for the entry
 *   category            top-level grouping ("company" | "services" | "support")
 *   subcategory         finer grouping within the category
 *   priority             1-10 baseline importance/confidence weight,
 *                        for a future engine to use as a scoring input
 *   tags                short labels for filtering/grouping entries
 *   title                human-readable title of the entry
 *   summary              one-line description of what the entry covers
 *   shortAnswer          concise answer, for quick-response scenarios
 *   answer                fuller, more detailed answer
 *   intents               list of user intents this entry can satisfy
 *   entities               key nouns/concepts this entry is "about"
 *   keywords               core terms/phrases that should match this entry
 *   synonyms               alternate terms/phrasings related to the topic
 *   phrases                short, informal/conversational utterances
 *                          (including a few natural Nigerian English
 *                          expressions, since many VSAS users write
 *                          informally) that should route to this entry
 *   questions               canonical, formally-phrased FAQ questions
 *   alternativeQuestions    additional paraphrased/full-sentence
 *                          question variations, less formal than
 *                          `questions`
 *   relatedTopics           ids of other entries a search engine can
 *                          use to explore connected knowledge
 *   followUpSuggestions     example follow-up questions the assistant
 *                          may suggest after answering
 *
 * Only fields that genuinely help future retrieval are included. No
 * field is duplicated in purpose with another field on the same entry.
 * ----------------------------------------------------------------------
 */

(function () {
  "use strict";

  const COMPANY_KNOWLEDGE = [

    /**
     * --------------------------------------------------------------
     * COMPANY OVERVIEW
     * --------------------------------------------------------------
     */
    {
      id: "company-overview",
      category: "company",
      subcategory: "overview",
      priority: 10,
      tags: ["identity", "overview", "about-us", "core"],

      title: "About Visual Vertex Technology Company",
      summary:
        "Introduces Visual Vertex Technology Company and its general " +
        "focus areas.",

      shortAnswer:
        "Visual Vertex Technology Company is a technology company that " +
        "provides digital, creative, and technology solutions.",

      answer:
        "Visual Vertex Technology Company is a technology-focused company " +
        "that provides digital, creative, and technology solutions. The " +
        "company focuses on helping individuals, businesses, and " +
        "organizations through practical technology services, digital " +
        "solutions, and professional innovation.",

      intents: [
        "ask_company_identity",
        "ask_who_they_are",
        "ask_what_company_does",
        "ask_about_organization",
        "ask_who_is_behind_vsas"
      ],

      entities: ["Visual Vertex Technology Company", "VSAS"],

      keywords: [
        "visual vertex",
        "visual vertex technology company",
        "vertex",
        "company",
        "technology company",
        "about the company",
        "about visual vertex",
        "organization",
        "platform owner"
      ],

      synonyms: [
        "tech company",
        "technology firm",
        "tech outfit",
        "tech organisation",
        "digital company"
      ],

      phrases: [
        "who are you guys",
        "who built vsas",
        "who owns this platform",
        "what exactly does this company do",
        "tell me about yourselves",
        "wetin una dey do"
      ],

      questions: [
        "What is Visual Vertex Technology Company?",
        "Tell me about Visual Vertex.",
        "What does Visual Vertex do?",
        "Who is Visual Vertex Technology Company?",
        "What kind of company is Visual Vertex?",
        "What is your company about?",
        "Who are you?",
        "Tell me about your company.",
        "Who owns this platform?",
        "Who built VSAS?"
      ],

      alternativeQuestions: [
        "Who runs VSAS?",
        "What organization is behind VSAS?",
        "Is Visual Vertex a real company?",
        "What kind of business is this?"
      ],

      relatedTopics: [
        "company-services",
        "company-approach",
        "company-contact-support"
      ],

      followUpSuggestions: [
        "What services does Visual Vertex provide?",
        "What is Visual Vertex's approach to technology?",
        "How can I contact Visual Vertex?"
      ]
    },

    /**
     * --------------------------------------------------------------
     * COMPANY SERVICES
     * --------------------------------------------------------------
     */
    {
      id: "company-services",
      category: "services",
      subcategory: "overview",
      priority: 10,
      tags: ["services", "capabilities", "offerings", "core"],

      title: "Visual Vertex Technology Company Services",
      summary:
        "Lists the company's core service areas at a high level.",

      shortAnswer:
        "Visual Vertex offers graphic design, web development, " +
        "cybersecurity, data analytics, cloud solutions, software development, tactical millitry hardware and IT " +
        "consultation.",

      answer:
        "Visual Vertex Technology Company provides services and solutions " +
        "across technology and digital fields. These include graphic and " +
        "creative design, web development and digital solutions, " +
        "cybersecurity services,software development, tactical millitry hardware, data analytics, cloud-related solutions, " +
        "and IT consultation.",

      intents: [
        "ask_services_offered",
        "ask_company_capabilities",
        "ask_areas_of_expertise",
        "ask_what_can_you_help_with"
      ],

      entities: [
        "graphic design",
        "web development",
        "cybersecurity",
        "data analytics",
        "cloud solutions",
        "IT consultation"
      ],

      keywords: [
        "services",
        "what do you do",
        "what services",
        "company services",
        "technology services",
        "visual vertex services",
        "what can visual vertex do",
        "capabilities",
        "offerings"
      ],

      synonyms: [
        "offerings",
        "capabilities",
        "solutions provided",
        "what you guys do"
      ],

      phrases: [
        "what can you guys help with",
        "what kind of services do you guys offer",
        "what do you people do exactly"
      ],

      questions: [
        "What services does Visual Vertex provide?",
        "What does the company do?",
        "What can Visual Vertex help with?",
        "What services do you offer?",
        "What are your areas of expertise?"
      ],

      alternativeQuestions: [
        "What are you able to help me with?",
        "What kind of projects can Visual Vertex take on?"
      ],

      relatedTopics: [
        "company-overview",
        "graphic-design-services",
        "web-development-services",
        "cybersecurity-services",
        "data-analytics-services",
        "cloud-solutions",
        "software development", 
        "tactical military hardware",
        "it-consultation"
      ],

      followUpSuggestions: [
        "Do you offer graphic design?",
        "Can you build websites?",
        "Do you offer cybersecurity services?"
      ]
    },

    /**
     * --------------------------------------------------------------
     * GRAPHIC DESIGN
     * --------------------------------------------------------------
     */
    {
      id: "graphic-design-services",
      category: "services",
      subcategory: "design",
      priority: 7,
      tags: ["design", "creative", "branding"],

      title: "Graphic and Creative Design",
      summary:
        "Covers branding, flyers, posters, and social media creative " +
        "work.",

      shortAnswer:
        "Yes, Visual Vertex offers graphic and creative design, " +
        "including branding, flyers, posters, and social media " +
        "creatives.",

      answer:
        "Yes. Visual Vertex Technology Company provides graphic and " +
        "creative design services. This includes professional graphics, " +
        "brand identity work, flyers, posters, and social media creatives, " +
        "depending on project requirements.",

      intents: [
        "ask_if_design_offered",
        "ask_branding_help",
        "ask_creative_services"
      ],

      entities: [
        "branding",
        "flyer design",
        "poster design",
        "social media design"
      ],

      keywords: [
        "graphic design",
        "graphics",
        "creative design",
        "branding",
        "brand identity",
        "flyer design",
        "poster design",
        "social media design"
      ],

      synonyms: [
        "graphics design",
        "visual design",
        "creative services",
        "brand design",
        "logo design"
      ],

      phrases: [
        "can una design flyer for me",
        "do you guys do branding",
        "who handles the graphics"
      ],

      questions: [
        "Do you offer graphic design?",
        "Can Visual Vertex design flyers?",
        "Do you provide branding services?",
        "Do you create social media designs?",
        "What creative services do you provide?"
      ],

      alternativeQuestions: [
        "Can you design a logo?",
        "Do you help with brand identity?",
        "Can you make social media graphics?"
      ],

      relatedTopics: ["company-services", "web-development-services"],

      followUpSuggestions: [
        "Do you also offer web development?",
        "What is your approach to design projects?"
      ]
    },

    /**
     * --------------------------------------------------------------
     * WEB DEVELOPMENT
     * --------------------------------------------------------------
     */
    {
      id: "web-development-services",
      category: "services",
      subcategory: "development",
      priority: 8,
      tags: ["web", "development", "digital-solutions"],

      title: "Web Development and Digital Solutions",
      summary:
        "Covers websites, web interfaces, and other digital platforms.",

      shortAnswer:
        "Yes, Visual Vertex provides web development and digital " +
        "solution services, including websites and web applications.",

      answer:
        "Visual Vertex Technology Company provides web development and " +
        "digital solution services. Projects may include websites, web " +
        "interfaces, and other digital platforms based on approved project " +
        "requirements.",

      intents: [
        "ask_if_web_dev_offered",
        "ask_website_building",
        "ask_web_app_development"
      ],

      entities: [
        "website",
        "web application",
        "web interface",
        "digital platform"
      ],

      keywords: [
        "web development",
        "website",
        "web design",
        "web application",
        "frontend",
        "full stack",
        "digital solutions"
      ],

      synonyms: [
        "website development",
        "web design",
        "website creation",
        "web application development",
        "frontend development",
        "full-stack development"
      ],

      phrases: [
        "can una build website for me",
        "do you guys code websites",
        "who does the coding"
      ],

      questions: [
        "Do you build websites?",
        "Can Visual Vertex develop a website?",
        "Do you provide web development?",
        "Can you build web applications?",
        "Do you offer web design?"
      ],

      alternativeQuestions: [
        "Can you build a web app for my business?",
        "Do you handle both frontend and backend?"
      ],

      relatedTopics: [
        "company-services",
        "graphic-design-services",
        "cybersecurity-services"
      ],

      followUpSuggestions: [
        "Do you offer cybersecurity services too?",
        "Can you also design the graphics for my website?"
      ]
    },

    /**
     * --------------------------------------------------------------
     * CYBERSECURITY
     * --------------------------------------------------------------
     */
    {
      id: "cybersecurity-services",
      category: "services",
      subcategory: "security",
      priority: 8,
      tags: ["security", "cybersecurity", "protection"],

      title: "Cybersecurity Services",
      summary:
        "Covers cybersecurity-related services and technology support.",

      shortAnswer:
        "Yes, Visual Vertex provides cybersecurity-related services and " +
        "technology support.",

      answer:
        "Visual Vertex Technology Company provides cybersecurity-related " +
        "services and technology support. The exact scope of a service " +
        "depends on the approved requirements and needs of the client or " +
        "organization.",

      intents: [
        "ask_if_security_offered",
        "ask_data_protection_help",
        "ask_it_security_support"
      ],

      entities: ["cybersecurity", "information security", "digital security"],

      keywords: [
        "cybersecurity",
        "cyber security",
        "security",
        "digital security",
        "information security",
        "security services"
      ],

      synonyms: [
        "cyber security",
        "digital security",
        "information security",
        "IT security",
        "data protection",
        "network security"
      ],

      phrases: [
        "can una secure my system",
        "do you guys handle hacking issues",
        "who protects our data"
      ],

      questions: [
        "Do you offer cybersecurity services?",
        "Does Visual Vertex provide security services?",
        "Can you help with cybersecurity?",
        "What cybersecurity services do you provide?"
      ],

      alternativeQuestions: [
        "Can you help protect our company data?",
        "Do you handle IT security audits?"
      ],

      relatedTopics: [
        "company-services",
        "web-development-services",
        "cloud-solutions"
      ],

      followUpSuggestions: [
        "Do you also provide cloud solutions?",
        "Can you help with IT consultation?"
      ]
    },

    /**
     * --------------------------------------------------------------
     * DATA ANALYTICS
     * --------------------------------------------------------------
     */
    {
      id: "data-analytics-services",
      category: "services",
      subcategory: "analytics",
      priority: 7,
      tags: ["data", "analytics", "insights"],

      title: "Data Analytics",
      summary:
        "Covers helping clients and organizations work with data and " +
        "insights.",

      shortAnswer:
        "Yes, Visual Vertex provides data analytics and related " +
        "technology solutions to help clients work with data and " +
        "insights.",

      answer:
        "Visual Vertex Technology Company provides data analytics and " +
        "related technology solutions. These services focus on helping " +
        "clients and organizations work with information, data, and useful " +
        "insights based on their approved requirements.",

      intents: [
        "ask_if_data_analytics_offered",
        "ask_data_insights_help",
        "ask_business_data_support"
      ],

      entities: ["data analytics", "data insights", "business data"],

      keywords: [
        "data analytics",
        "data analysis",
        "analytics",
        "data",
        "business data",
        "data insights"
      ],

      synonyms: [
        "data analysis",
        "business analytics",
        "data insights",
        "reporting",
        "data visualization"
      ],

      phrases: [
        "can una help us understand our data",
        "do you guys do data analysis"
      ],

      questions: [
        "Do you provide data analytics?",
        "Can Visual Vertex analyze data?",
        "What data services do you offer?",
        "Do you work with data analysis?"
      ],

      alternativeQuestions: [
        "Can you help us make sense of our business data?",
        "Do you build dashboards or reports?"
      ],

      relatedTopics: [
        "company-services",
        "cloud-solutions",
        "it-consultation"
      ],

      followUpSuggestions: [
        "Do you also offer cloud solutions?",
        "Can you provide IT consultation for our data strategy?"
      ]
    },

    /**
     * --------------------------------------------------------------
     * CLOUD SOLUTIONS
     * --------------------------------------------------------------
     */
    {
      id: "cloud-solutions",
      category: "services",
      subcategory: "cloud",
      priority: 7,
      tags: ["cloud", "infrastructure"],

      title: "Cloud Solutions",
      summary:
        "Covers cloud-related solutions and technology support.",

      shortAnswer:
        "Yes, Visual Vertex provides cloud-related solutions and " +
        "technology support based on project needs.",

      answer:
        "Visual Vertex Technology Company provides cloud-related solutions " +
        "and technology support based on project and organizational " +
        "requirements.",

      intents: [
        "ask_if_cloud_offered",
        "ask_cloud_migration_help",
        "ask_infrastructure_support"
      ],

      entities: ["cloud solutions", "cloud technology", "online infrastructure"],

      keywords: [
        "cloud",
        "cloud solutions",
        "cloud services",
        "cloud technology",
        "online infrastructure"
      ],

      synonyms: [
        "cloud computing",
        "cloud infrastructure",
        "cloud migration",
        "cloud hosting"
      ],

      phrases: [
        "can una help us move to cloud",
        "do you guys handle cloud stuff"
      ],

      questions: [
        "Do you provide cloud solutions?",
        "Can Visual Vertex help with cloud technology?",
        "What cloud services do you offer?"
      ],

      alternativeQuestions: [
        "Can you help migrate our systems to the cloud?",
        "Do you manage cloud infrastructure?"
      ],

      relatedTopics: [
        "company-services",
        "cybersecurity-services",
        "data-analytics-services",
        "it-consultation"
      ],

      followUpSuggestions: [
        "Do you also offer cybersecurity services?",
        "Can you provide IT consultation for our cloud setup?"
      ]
    },

    /**
     * --------------------------------------------------------------
     * IT CONSULTATION
     * --------------------------------------------------------------
     */
    {
      id: "it-consultation",
      category: "services",
      subcategory: "consulting",
      priority: 8,
      tags: ["consulting", "advisory", "it-support"],

      title: "IT Consultation",
      summary:
        "Covers technology guidance for projects, businesses, and " +
        "organizations.",

      shortAnswer:
        "Yes, Visual Vertex provides IT consultation and technology " +
        "guidance for projects, businesses, and organizations.",

      answer:
        "Visual Vertex Technology Company provides IT consultation and " +
        "technology guidance for projects, businesses, and organizations. " +
        "The level and scope of consultation depend on the specific project " +
        "or technology requirements.",

      intents: [
        "ask_if_consulting_offered",
        "ask_technology_advice",
        "ask_project_guidance"
      ],

      entities: ["IT consultation", "technology guidance"],

      keywords: [
        "it consultation",
        "consultation",
        "technology consultation",
        "it support",
        "technology advice",
        "consultant"
      ],

      synonyms: [
        "technology consulting",
        "IT advisory",
        "tech advice",
        "project consultation"
      ],

      phrases: [
        "can una advise us on tech",
        "do you guys give consultation",
        "who do we talk to about our tech project"
      ],

      questions: [
        "Do you offer IT consultation?",
        "Can Visual Vertex provide technology advice?",
        "Do you provide IT support?",
        "Can I consult Visual Vertex about a technology project?"
      ],

      alternativeQuestions: [
        "Can you advise us before we start a tech project?",
        "Do you offer strategic technology guidance?"
      ],

      relatedTopics: [
        "company-services",
        "data-analytics-services",
        "cloud-solutions"
      ],

      followUpSuggestions: [
        "How can I contact Visual Vertex to discuss a project?",
        "What other services does Visual Vertex offer?"
      ]
    },

    /**
     * --------------------------------------------------------------
     * COMPANY APPROACH
     * --------------------------------------------------------------
     */
    {
      id: "company-approach",
      category: "company",
      subcategory: "approach",
      priority: 6,
      tags: ["approach", "values", "methodology"],

      title: "Visual Vertex Technology Approach",
      summary:
        "Describes how Visual Vertex approaches technology work.",

      shortAnswer:
        "Visual Vertex focuses on practical, professional, and " +
        "technology-driven solutions that combine creativity and " +
        "innovation.",

      answer:
        "Visual Vertex Technology Company focuses on practical, " +
        "professional, and technology-driven solutions. The company aims " +
        "to combine creativity, technical skills, and innovation to address " +
        "real project and organizational needs.",

      intents: [
        "ask_company_approach",
        "ask_differentiator",
        "ask_methodology",
        "ask_company_focus"
      ],

      entities: ["innovation", "practical solutions"],

      keywords: [
        "approach",
        "innovation",
        "technology solutions",
        "professional",
        "practical solutions",
        "how do you work"
      ],

      synonyms: [
        "methodology",
        "working style",
        "company philosophy",
        "way of working"
      ],

      phrases: [
        "how una dey work",
        "what makes una different",
        "wetin be una style"
      ],

      questions: [
        "How does Visual Vertex work?",
        "What is your approach to technology?",
        "What makes Visual Vertex different?",
        "What is the company's focus?"
      ],

      alternativeQuestions: [
        "What makes Visual Vertex different from other tech companies?",
        "What is the company's philosophy?"
      ],

      relatedTopics: ["company-overview", "company-services"],

      followUpSuggestions: [
        "What services does Visual Vertex provide?",
        "Tell me more about the company."
      ]
    },

    /**
     * --------------------------------------------------------------
     * CONTACT / GENERAL SUPPORT
     * --------------------------------------------------------------
     */
    {
      id: "company-contact-support",
      category: "support",
      subcategory: "contact",
      priority: 5,
      tags: ["contact", "support", "help"],

      title: "Contact and Support",
      summary:
        "Explains how to reach Visual Vertex for enquiries or support.",

      shortAnswer:
        "Please use the official Visual Vertex Technology Company " +
        "communication channel or your authorized VSAS administrator for " +
        "support.",

      answer:
        "For company enquiries, support, or project-related discussions, " +
        "please use the official Visual Vertex Technology Company " +
        "communication channel provided by the company or your authorized " +
        "VSAS administrator.",

      intents: [
        "ask_contact_info",
        "ask_for_help",
        "ask_support_channel",
        "ask_how_to_reach_company"
      ],

      entities: ["VSAS administrator", "communication channel"],

      keywords: [
        "contact",
        "support",
        "help",
        "reach visual vertex",
        "talk to visual vertex",
        "company contact"
      ],

      synonyms: [
        "get in touch",
        "reach out",
        "customer support",
        "help desk"
      ],

      phrases: [
        "how do i reach una",
        "who do i talk to for help",
        "na who go help me"
      ],

      questions: [
        "How can I contact Visual Vertex?",
        "How do I get support?",
        "How can I reach the company?",
        "I need help from Visual Vertex."
      ],

      alternativeQuestions: [
        "Who do I contact if I have an issue?",
        "Where can I get support for VSAS?"
      ],

      relatedTopics: ["company-overview"],

      followUpSuggestions: [
        "Tell me about Visual Vertex.",
        "What services does Visual Vertex provide?"
      ]
    }

  ];

  /**
   * Deep-freezes a single knowledge entry.
   *
   * Freezes every array field on the entry (keywords, synonyms,
   * phrases, questions, alternativeQuestions, intents, entities, tags,
   * relatedTopics, followUpSuggestions) as well as the entry object
   * itself, so nothing in the knowledge base can be mutated at
   * runtime by other modules.
   *
   * @param {Object} entry - A raw knowledge entry.
   * @returns {Object} A frozen copy of the entry.
   */
  function freezeEntry(entry) {
    const frozenEntry = Object.assign({}, entry);

    Object.keys(frozenEntry).forEach(function (key) {
      if (Array.isArray(frozenEntry[key])) {
        frozenEntry[key] = Object.freeze(frozenEntry[key].slice());
      }
    });

    return Object.freeze(frozenEntry);
  }

  /**
   * Public knowledge API.
   *
   * The full knowledge base is frozen (entries and their array fields)
   * to protect against accidental modification by other JavaScript
   * modules. This is the single global exposed by this file.
   */
  window.VertexAICompanyKnowledge = Object.freeze(
    COMPANY_KNOWLEDGE.map(freezeEntry)
  );

})();