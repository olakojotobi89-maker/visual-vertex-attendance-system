/**
 * Vertex AI — Internship Knowledge Base
 * ----------------------------------------------------------------------
 * Approved knowledge about the Visual Vertex Technology Company
 * Internship Programme.
 *
 * This module contains knowledge only.
 *
 * DO NOT add:
 * - AI/API calls
 * - Supabase queries
 * - Authentication
 * - UI/DOM logic
 * - Voice implementation
 * - Cache logic
 * - Search/scoring logic
 * ----------------------------------------------------------------------
 */

(function () {
  "use strict";

  const INTERNSHIP_KNOWLEDGE = [

    {
      id: "internship-overview",
      category: "internship",
      subcategory: "overview",
      priority: 10,
      importance: "high",
      retrievalWeight: 10,

      title: "Visual Vertex Internship Programme",

      summary:
        "The Visual Vertex Technology Company Internship Programme is a structured learning and practical-development programme designed to help participants develop useful technology, creative, business, and professional skills.",

      keywords: [
        "internship",
        "internship programme",
        "visual vertex internship",
        "intern programme",
        "training programme",
        "intern training"
      ],

      synonyms: [
        "intern programme",
        "intern training",
        "student programme",
        "technology internship",
        "company training"
      ],

      phrases: [
        "what is the internship programme",
        "tell me about the internship",
        "what is visual vertex internship",
        "how does the internship work"
      ],

      intents: [
        "internship_overview",
        "internship_information",
        "programme_information"
      ],

      questions: [
        "What is the Visual Vertex internship programme?",
        "Tell me about the internship.",
        "What is the internship programme about?",
        "How does the internship work?"
      ],

      alternativeQuestions: [
        "What are we doing during this internship?",
        "What is this training programme?",
        "Can you explain the internship?",
        "What will I learn during the internship?"
      ],

      entities: [
        "Visual Vertex Technology Company",
        "Internship Programme"
      ],

      tags: [
        "internship",
        "training",
        "visual-vertex",
        "learning"
      ],

      relatedTopics: [
        "internship-duration",
        "internship-curriculum",
        "internship-expectations",
        "internship-certificate"
      ],

      shortAnswer:
        "The Visual Vertex internship is a structured programme focused on practical learning, skill development, and participation in technology and business-related activities.",

      answer:
        "The Visual Vertex Technology Company Internship Programme is designed to give interns practical learning opportunities while developing useful technical, creative, business, and professional skills. Interns are expected to learn, practise, participate in assigned activities, and progressively improve throughout the programme.",

      followUpSuggestions: [
        "How long is the internship?",
        "What will interns learn?",
        "What are the expectations for interns?"
      ]
    },


    {
      id: "internship-duration",
      category: "internship",
      subcategory: "programme-structure",
      priority: 10,
      importance: "high",
      retrievalWeight: 10,

      title: "Internship Duration",

      summary:
        "The Visual Vertex internship programme runs for three months.",

      keywords: [
        "three months",
        "3 months",
        "internship duration",
        "programme duration",
        "how long",
        "internship length"
      ],

      synonyms: [
        "programme length",
        "training period",
        "internship period"
      ],

      phrases: [
        "how long is the internship",
        "how many months is the internship",
        "when does the internship end"
      ],

      intents: [
        "internship_duration",
        "programme_duration"
      ],

      questions: [
        "How long is the internship?",
        "How many months is the programme?",
        "What is the duration of the internship?"
      ],

      alternativeQuestions: [
        "How long will I be an intern?",
        "How many months are we training?",
        "When does the internship programme finish?"
      ],

      tags: [
        "internship",
        "duration",
        "three-months"
      ],

      relatedTopics: [
        "internship-overview",
        "internship-curriculum"
      ],

      shortAnswer:
        "The Visual Vertex internship programme lasts three months.",

      answer:
        "The Visual Vertex Technology Company Internship Programme is structured as a three-month programme. During this period, interns are expected to participate in the training, practical activities, assignments, and other approved programme activities.",

      followUpSuggestions: [
        "What will I learn during the internship?",
        "What are the internship expectations?",
        "Will interns work on projects?"
      ]
    },


    {
      id: "internship-curriculum",
      category: "internship",
      subcategory: "curriculum",
      priority: 10,
      importance: "high",
      retrievalWeight: 10,

      title: "Internship Learning Areas",

      summary:
        "The internship programme covers Graphics Design, Web Design, Cybersecurity, Business Associate activities, and Project Management.",

      keywords: [
        "graphics design",
        "web design",
        "cybersecurity",
        "business associate",
        "project management",
        "internship courses",
        "training topics",
        "what will i learn"
      ],

      synonyms: [
        "learning areas",
        "training areas",
        "programme subjects",
        "internship subjects",
        "skills training"
      ],

      phrases: [
        "what will interns learn",
        "what courses are in the internship",
        "what skills will i learn",
        "what are the internship topics"
      ],

      intents: [
        "internship_curriculum",
        "internship_learning",
        "training_topics"
      ],

      questions: [
        "What will I learn during the internship?",
        "What subjects are covered?",
        "What skills will interns learn?",
        "What are the internship training areas?"
      ],

      alternativeQuestions: [
        "What courses are we learning?",
        "What technologies will we learn?",
        "What does the internship cover?",
        "What are the different training areas?"
      ],

      tags: [
        "internship",
        "curriculum",
        "graphics",
        "web",
        "cybersecurity",
        "business",
        "project-management"
      ],

      relatedTopics: [
        "graphics-design-training",
        "web-design-training",
        "cybersecurity-training",
        "business-associate-training",
        "project-management-training"
      ],

      shortAnswer:
        "The internship covers Graphics Design, Web Design, Cybersecurity, Business Associate activities, and Project Management.",

      answer:
        "The Visual Vertex internship programme covers several learning areas: Graphics Design, Web Design, Cybersecurity, Business Associate activities, and Project Management. The purpose is to expose interns to different practical areas while helping them develop useful skills and professional experience.",

      followUpSuggestions: [
        "Tell me about the Web Design training.",
        "Tell me about the Graphics Design training.",
        "What will I learn about Cybersecurity?"
      ]
    },


    {
      id: "graphics-design-training",
      category: "internship",
      subcategory: "graphics-design",
      priority: 8,
      importance: "medium",
      retrievalWeight: 8,

      title: "Graphics Design Training",

      summary:
        "Graphics Design is one of the learning areas included in the Visual Vertex internship programme.",

      keywords: [
        "graphics",
        "graphic design",
        "graphics design",
        "design training",
        "flyer design",
        "branding",
        "visual design"
      ],

      synonyms: [
        "graphic designing",
        "creative design",
        "visual communication"
      ],

      phrases: [
        "what will i learn in graphics design",
        "tell me about graphics design",
        "is graphics design part of the internship"
      ],

      intents: [
        "graphics_design_training"
      ],

      questions: [
        "Is Graphics Design part of the internship?",
        "What will I learn in Graphics Design?",
        "Tell me about the Graphics Design training."
      ],

      alternativeQuestions: [
        "Are we learning graphic design?",
        "What does the graphics class cover?",
        "Why are we learning graphics design?"
      ],

      tags: [
        "internship",
        "graphics",
        "design",
        "creative"
      ],

      relatedTopics: [
        "internship-curriculum",
        "internship-projects"
      ],

      shortAnswer:
        "Graphics Design is one of the core learning areas in the internship programme.",

      answer:
        "Graphics Design is included in the Visual Vertex internship programme as one of the practical learning areas. Interns can use the training to develop creative and visual communication skills and apply those skills to practical assignments where applicable.",

      followUpSuggestions: [
        "What other areas are included?",
        "Will interns work on practical projects?",
        "Tell me about Web Design."
      ]
    },


    {
      id: "web-design-training",
      category: "internship",
      subcategory: "web-design",
      priority: 9,
      importance: "high",
      retrievalWeight: 9,

      title: "Web Design Training",

      summary:
        "Web Design is one of the core learning areas in the Visual Vertex internship programme.",

      keywords: [
        "web design",
        "website",
        "web development",
        "html",
        "css",
        "javascript",
        "frontend"
      ],

      synonyms: [
        "website design",
        "web development training",
        "frontend training"
      ],

      phrases: [
        "what will i learn in web design",
        "tell me about web design",
        "is web design part of the internship"
      ],

      intents: [
        "web_design_training"
      ],

      questions: [
        "Is Web Design part of the internship?",
        "What will I learn in Web Design?",
        "Tell me about the Web Design training."
      ],

      alternativeQuestions: [
        "Are we learning how to build websites?",
        "What technologies are used for Web Design?",
        "Will interns learn HTML and CSS?"
      ],

      tags: [
        "internship",
        "web",
        "website",
        "html",
        "css",
        "javascript"
      ],

      relatedTopics: [
        "internship-curriculum",
        "internship-projects"
      ],

      shortAnswer:
        "Web Design is one of the internship learning areas and focuses on developing practical website-building skills.",

      answer:
        "Web Design is one of the learning areas included in the internship programme. The training is intended to help interns understand how websites are designed and developed and to give them opportunities to practise their skills through practical work.",

      followUpSuggestions: [
        "What other areas are included?",
        "Will we work on real projects?",
        "Tell me about Cybersecurity."
      ]
    },


    {
      id: "cybersecurity-training",
      category: "internship",
      subcategory: "cybersecurity",
      priority: 9,
      importance: "high",
      retrievalWeight: 9,

      title: "Cybersecurity Training",

      summary:
        "Cybersecurity is one of the learning areas included in the Visual Vertex internship programme.",

      keywords: [
        "cybersecurity",
        "cyber security",
        "security",
        "information security",
        "ethical hacking",
        "security training"
      ],

      synonyms: [
        "cyber security training",
        "digital security",
        "information security training"
      ],

      phrases: [
        "what will i learn in cybersecurity",
        "tell me about cybersecurity",
        "is cybersecurity part of the internship"
      ],

      intents: [
        "cybersecurity_training"
      ],

      questions: [
        "Is Cybersecurity part of the internship?",
        "What will I learn in Cybersecurity?",
        "Tell me about the Cybersecurity training."
      ],

      alternativeQuestions: [
        "Are we learning cybersecurity?",
        "Why are we studying cybersecurity?",
        "What is the security training about?"
      ],

      tags: [
        "internship",
        "cybersecurity",
        "security",
        "technology"
      ],

      relatedTopics: [
        "internship-curriculum",
        "internship-expectations"
      ],

      shortAnswer:
        "Cybersecurity is one of the learning areas included in the internship programme.",

      answer:
        "Cybersecurity is included in the Visual Vertex internship programme as a technology learning area. The training is intended to help interns develop an understanding of cybersecurity concepts and responsible security practices.",

      followUpSuggestions: [
        "What other subjects are included?",
        "What are the internship expectations?",
        "Tell me about Project Management."
      ]
    },


    {
      id: "business-associate-training",
      category: "internship",
      subcategory: "business",
      priority: 8,
      importance: "medium",
      retrievalWeight: 8,

      title: "Business Associate Training",

      summary:
        "Business Associate activities are included in the internship programme to expose interns to business and organizational responsibilities.",

      keywords: [
        "business associate",
        "business",
        "business training",
        "company operations",
        "business development"
      ],

      synonyms: [
        "business operations",
        "business support",
        "business learning"
      ],

      phrases: [
        "what is business associate",
        "what will i learn as a business associate",
        "is business associate part of the internship"
      ],

      intents: [
        "business_associate_training"
      ],

      questions: [
        "What is the Business Associate role?",
        "Is Business Associate part of the internship?",
        "What will I learn about business?"
      ],

      alternativeQuestions: [
        "What does a business associate do?",
        "Why are we learning business?",
        "What is the business side of the internship?"
      ],

      tags: [
        "internship",
        "business",
        "associate",
        "operations"
      ],

      relatedTopics: [
        "internship-curriculum",
        "project-management-training"
      ],

      shortAnswer:
        "Business Associate activities expose interns to practical business and organizational responsibilities.",

      answer:
        "Business Associate activities form part of the internship programme. They are intended to help interns understand business-related responsibilities, organizational activities, communication, and other practical aspects of working within a company.",

      followUpSuggestions: [
        "What other areas are included?",
        "Tell me about Project Management.",
        "What are the expectations for interns?"
      ]
    },


    {
      id: "project-management-training",
      category: "internship",
      subcategory: "project-management",
      priority: 8,
      importance: "medium",
      retrievalWeight: 8,

      title: "Project Management Training",

      summary:
        "Project Management is included in the internship programme to help interns understand how projects are planned, organized, and executed.",

      keywords: [
        "project management",
        "projects",
        "project planning",
        "project organization",
        "project execution"
      ],

      synonyms: [
        "project coordination",
        "project planning",
        "project administration"
      ],

      phrases: [
        "what will i learn about project management",
        "is project management part of the internship",
        "tell me about project management"
      ],

      intents: [
        "project_management_training"
      ],

      questions: [
        "Is Project Management part of the internship?",
        "What will I learn about Project Management?",
        "Why are we learning Project Management?"
      ],

      alternativeQuestions: [
        "What is project management?",
        "How does project planning work?",
        "Will interns work on projects?"
      ],

      tags: [
        "internship",
        "project-management",
        "projects",
        "planning"
      ],

      relatedTopics: [
        "internship-projects",
        "internship-curriculum",
        "internship-expectations"
      ],

      shortAnswer:
        "Project Management is included to help interns understand project planning, organization, and execution.",

      answer:
        "Project Management is one of the internship learning areas. It is intended to help interns understand how projects can be planned, organized, coordinated, and executed effectively.",

      followUpSuggestions: [
        "Will interns work on practical projects?",
        "What other areas are included?",
        "What are the internship expectations?"
      ]
    },


    {
      id: "internship-projects",
      category: "internship",
      subcategory: "practical-learning",
      priority: 9,
      importance: "high",
      retrievalWeight: 9,

      title: "Internship Projects and Practical Work",

      summary:
        "The internship programme emphasizes practical learning and may provide opportunities for interns to participate in company-related projects and assignments.",

      keywords: [
        "projects",
        "practical",
        "practical work",
        "assignments",
        "real projects",
        "intern projects"
      ],

      synonyms: [
        "hands-on learning",
        "practical experience",
        "project work",
        "hands-on projects"
      ],

      phrases: [
        "will interns work on projects",
        "do interns get projects",
        "will we do practical work",
        "are there assignments"
      ],

      intents: [
        "internship_projects",
        "practical_learning",
        "internship_assignments"
      ],

      questions: [
        "Will interns work on projects?",
        "Will there be practical work?",
        "Do interns receive assignments?"
      ],

      alternativeQuestions: [
        "Are we going to build projects?",
        "Will I get practical experience?",
        "Do we work on real company projects?"
      ],

      tags: [
        "internship",
        "projects",
        "practical",
        "assignments"
      ],

      relatedTopics: [
        "internship-curriculum",
        "internship-expectations",
        "internship-certificate"
      ],

      shortAnswer:
        "The internship emphasizes practical learning and may include assignments and project-based activities.",

      answer:
        "The Visual Vertex internship is designed around practical learning as well as instruction. Interns may participate in assignments, exercises, and approved projects that help them apply what they learn. Specific project assignments may vary depending on the programme stage and responsibilities given to the intern.",

      followUpSuggestions: [
        "What are the expectations for interns?",
        "What will I learn?",
        "How do I complete my assignments?"
      ]
    },


    {
      id: "internship-expectations",
      category: "internship",
      subcategory: "conduct",
      priority: 10,
      importance: "high",
      retrievalWeight: 10,

      title: "Intern Expectations",

      summary:
        "Interns are expected to participate actively, learn consistently, complete assigned work, communicate professionally, and respect company rules.",

      keywords: [
        "intern expectations",
        "expectations",
        "intern duties",
        "responsibilities",
        "conduct",
        "professionalism",
        "discipline"
      ],

      synonyms: [
        "intern responsibilities",
        "programme expectations",
        "professional conduct",
        "intern duties"
      ],

      phrases: [
        "what is expected of interns",
        "what should interns do",
        "what are my responsibilities",
        "how should interns behave"
      ],

      intents: [
        "internship_expectations",
        "intern_responsibilities",
        "professional_conduct"
      ],

      questions: [
        "What are the expectations for interns?",
        "What should interns do?",
        "What are my responsibilities as an intern?"
      ],

      alternativeQuestions: [
        "How should an intern behave?",
        "What does the company expect from interns?",
        "What responsibilities do interns have?"
      ],

      tags: [
        "internship",
        "expectations",
        "responsibility",
        "professionalism",
        "conduct"
      ],

      relatedTopics: [
        "internship-attendance",
        "internship-projects",
        "internship-support"
      ],

      shortAnswer:
        "Interns should participate actively, complete assigned work, communicate professionally, maintain attendance, and respect programme and company rules.",

      answer:
        "Interns are expected to take the programme seriously by participating in training activities, learning consistently, completing assigned tasks, maintaining appropriate attendance, communicating respectfully, working professionally with others, and following approved company and programme rules.",

      followUpSuggestions: [
        "How important is attendance?",
        "What happens if I need help?",
        "Will interns receive projects?"
      ]
    },


    {
      id: "internship-attendance",
      category: "internship",
      subcategory: "attendance",
      priority: 10,
      importance: "high",
      retrievalWeight: 10,

      title: "Intern Attendance",

      summary:
        "Intern attendance is an important part of participating responsibly in the internship programme.",

      keywords: [
        "intern attendance",
        "attendance",
        "intern present",
        "absence",
        "late",
        "attendance requirement"
      ],

      synonyms: [
        "programme attendance",
        "training attendance",
        "daily attendance"
      ],

      phrases: [
        "is attendance important",
        "do interns need to mark attendance",
        "what if i miss training",
        "what if i am absent"
      ],

      intents: [
        "internship_attendance",
        "attendance_expectation",
        "intern_absence"
      ],

      questions: [
        "Is attendance important for interns?",
        "Do interns need to mark attendance?",
        "What should I do if I am absent?"
      ],

      alternativeQuestions: [
        "What happens if I miss a training session?",
        "Why is attendance important?",
        "How do interns record attendance?"
      ],

      tags: [
        "internship",
        "attendance",
        "discipline",
        "participation"
      ],

      relatedTopics: [
        "mark-attendance",
        "internship-expectations",
        "internship-overview"
      ],

      shortAnswer:
        "Attendance is an important part of responsible participation in the internship programme.",

      answer:
        "Interns are expected to participate consistently in the programme and maintain appropriate attendance. When attendance is recorded through VSAS, interns should use the approved attendance process. If an intern cannot attend, they should follow the appropriate communication process provided by the programme or company.",

      followUpSuggestions: [
        "How do I mark my attendance?",
        "What are the internship expectations?",
        "I have an attendance problem."
      ]
    },


    {
      id: "internship-certificate",
      category: "internship",
      subcategory: "completion",
      priority: 9,
      importance: "high",
      retrievalWeight: 9,

      title: "Internship Certificate",

      summary:
        "A certificate is associated with completion of the internship programme, subject to the programme's applicable completion requirements.",

      keywords: [
        "certificate",
        "internship certificate",
        "completion certificate",
        "certificate after internship",
        "certificate requirements"
      ],

      synonyms: [
        "training certificate",
        "programme certificate",
        "completion award"
      ],

      phrases: [
        "will i get a certificate",
        "do interns get certificates",
        "how do i get my certificate",
        "is there a certificate"
      ],

      intents: [
        "internship_certificate",
        "programme_completion"
      ],

      questions: [
        "Will I receive a certificate?",
        "Do interns get certificates?",
        "Is there a certificate after the internship?"
      ],

      alternativeQuestions: [
        "How do I get my internship certificate?",
        "What happens after completing the programme?",
        "Do I receive a certificate when I finish?"
      ],

      tags: [
        "internship",
        "certificate",
        "completion"
      ],

      relatedTopics: [
        "internship-overview",
        "internship-expectations"
      ],

      shortAnswer:
        "A certificate is associated with completion of the internship programme, subject to the applicable programme requirements.",

      answer:
        "The internship programme provides for a certificate upon completion, subject to the applicable programme requirements. Interns should participate properly in the programme and complete the required activities before expecting completion documentation.",

      followUpSuggestions: [
        "What are the internship requirements?",
        "How long is the internship?",
        "What will interns learn?"
      ]
    },


    {
      id: "internship-learning-path",
      category: "internship",
      subcategory: "progression",
      priority: 8,
      importance: "medium",
      retrievalWeight: 8,

      title: "Internship Learning Progression",

      summary:
        "The internship is intended to move interns from foundational learning toward deeper practical application.",

      keywords: [
        "learning progression",
        "beginner",
        "advanced",
        "basics",
        "master class",
        "deep learning",
        "skill progression"
      ],

      synonyms: [
        "learning path",
        "training progression",
        "skill development path"
      ],

      phrases: [
        "how does the training progress",
        "what happens after the basics",
        "what is the master class",
        "how do i advance"
      ],

      intents: [
        "internship_progression",
        "learning_path",
        "master_class"
      ],

      questions: [
        "How does the internship training progress?",
        "What happens after the basics?",
        "What is the Master Class?"
      ],

      alternativeQuestions: [
        "How do I move to advanced learning?",
        "What is the difference between basic and advanced training?",
        "What happens after I learn the basics?"
      ],

      tags: [
        "internship",
        "learning",
        "progression",
        "master-class"
      ],

      relatedTopics: [
        "internship-curriculum",
        "internship-projects"
      ],

      shortAnswer:
        "The programme is designed to progress from foundational learning toward deeper and more practical learning.",

      answer:
        "The Visual Vertex training structure is designed to help learners build a foundation before moving toward deeper practical learning. The basic programme introduces core concepts, while the Master Class provides a deeper learning experience for participants who continue into that level.",

      followUpSuggestions: [
        "What does the basic programme cover?",
        "What is the Master Class?",
        "Will we work on projects?"
      ]
    },


    {
      id: "internship-support",
      category: "internship",
      subcategory: "help",
      priority: 8,
      importance: "medium",
      retrievalWeight: 8,

      title: "Getting Help During the Internship",

      summary:
        "Interns should ask questions and use the approved communication channels when they need clarification or assistance.",

      keywords: [
        "help",
        "support",
        "intern help",
        "ask questions",
        "training support",
        "mentor"
      ],

      synonyms: [
        "assistance",
        "guidance",
        "learning support"
      ],

      phrases: [
        "who can help me",
        "where do i ask questions",
        "i don't understand the lesson",
        "what should i do if i need help"
      ],

      intents: [
        "internship_support",
        "learning_support",
        "intern_help"
      ],

      questions: [
        "What should I do if I need help?",
        "Who can I ask questions?",
        "What if I don't understand a lesson?"
      ],

      alternativeQuestions: [
        "Where can interns get help?",
        "Who do I contact when I have a problem?",
        "I don't understand something. What should I do?"
      ],

      tags: [
        "internship",
        "support",
        "help",
        "learning"
      ],

      relatedTopics: [
        "internship-expectations",
        "internship-overview",
        "vsas-support-troubleshooting"
      ],

      shortAnswer:
        "Ask questions through the approved programme communication channels whenever you need clarification or assistance.",

      answer:
        "Interns are encouraged to ask questions when they do not understand a lesson, assignment, or programme activity. Use the approved communication channels or speak with the appropriate instructor, coordinator, or authorized company representative for assistance.",

      followUpSuggestions: [
        "What are the internship expectations?",
        "How do I use VSAS?",
        "I have a problem with my attendance."
      ]
    }

  ];


  /**
   * Freeze the knowledge entries so other modules cannot
   * accidentally modify the knowledge base at runtime.
   */
  function freezeKnowledgeEntry(entry) {
    const frozenEntry = {
      ...entry
    };

    const arrayProperties = [
      "keywords",
      "synonyms",
      "phrases",
      "intents",
      "questions",
      "alternativeQuestions",
      "entities",
      "tags",
      "relatedTopics",
      "followUpSuggestions"
    ];

    arrayProperties.forEach(function (property) {
      if (Array.isArray(frozenEntry[property])) {
        frozenEntry[property] = Object.freeze([
          ...frozenEntry[property]
        ]);
      }
    });

    return Object.freeze(frozenEntry);
  }


  /**
   * Public knowledge API.
   *
   * The search engine will consume this later.
   */
  window.VertexAIInternshipKnowledge = Object.freeze(
    INTERNSHIP_KNOWLEDGE.map(freezeKnowledgeEntry)
  );


  /**
   * Small metadata object for future knowledge indexing.
   */
  window.VertexAIInternshipKnowledgeMeta = Object.freeze({
    name: "Visual Vertex Internship Knowledge",
    version: "1.0.0",
    category: "internship",
    documentCount: INTERNSHIP_KNOWLEDGE.length,
    source: "Visual Vertex Technology Company",
    approvedForVertexAI: true
  });


  console.log(
    `[Vertex AI] Internship knowledge loaded: ${INTERNSHIP_KNOWLEDGE.length} documents.`
  );

})();