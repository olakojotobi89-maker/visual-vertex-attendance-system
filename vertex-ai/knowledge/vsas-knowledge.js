/**
 * VSAS Knowledge Base
 * ----------------------------------------------------------------------
 * Approved knowledge about the Visual Vertex Staff Attendance System
 * (VSAS) for the Vertex AI Assistant.
 *
 * Responsibilities:
 * - Store structured VSAS knowledge
 * - Provide approved answers about using the platform
 * - Include natural-language variations for future intelligent retrieval
 * - Provide metadata for intent matching and confidence scoring
 *
 * This file must NOT contain:
 * - UI logic
 * - DOM manipulation
 * - AI API calls
 * - API keys
 * - Supabase queries
 * - Authentication implementation
 * - RLS logic
 * - Voice implementation
 * - Cache implementation
 * - Search/scoring algorithms
 * ----------------------------------------------------------------------
 */

(function () {
  "use strict";

  const VSAS_KNOWLEDGE = [

    /**
     * ================================================================
     * VSAS OVERVIEW
     * ================================================================
     */
    {
      id: "vsas-overview",
      category: "vsas",
      subcategory: "overview",
      priority: 10,
      importance: "high",
      retrievalWeight: 10,

      title: "About VSAS",

      summary:
        "VSAS is the Visual Vertex Staff Attendance System used to support staff and intern activities, attendance, and other approved company operations.",

      keywords: [
        "vsas",
        "visual vertex staff attendance system",
        "attendance system",
        "staff system",
        "visual vertex system",
        "employee platform"
      ],

      synonyms: [
        "staff attendance platform",
        "attendance platform",
        "staff portal",
        "employee portal",
        "company platform",
        "work platform"
      ],

      phrases: [
        "what is vsas",
        "tell me about vsas",
        "what is this platform",
        "what is this system for",
        "how does this platform work",
        "why do we use vsas"
      ],

      intents: [
        "vsas_overview",
        "platform_identification",
        "platform_purpose"
      ],

      questions: [
        "What is VSAS?",
        "Tell me about VSAS.",
        "What is this platform?",
        "What is this system used for?",
        "Why do we use VSAS?"
      ],

      alternativeQuestions: [
        "What exactly is VSAS?",
        "What does VSAS mean?",
        "What is this website for?",
        "Why do I need to use this platform?",
        "What can I do on VSAS?",
        "Wetin be this VSAS?",
        "How does this system work?"
      ],

      entities: [
        "VSAS",
        "Visual Vertex Staff Attendance System",
        "Visual Vertex Technology Company"
      ],

      tags: [
        "vsas",
        "platform",
        "overview",
        "attendance",
        "staff",
        "intern"
      ],

      relatedTopics: [
        "vsas-how-to-use",
        "attendance-overview",
        "vsas-dashboard",
        "vsas-login-access"
      ],

      shortAnswer:
        "VSAS is the Visual Vertex Staff Attendance System used to support staff and intern attendance and approved company activities.",

      answer:
        "VSAS means Visual Vertex Staff Attendance System. It is an internal platform designed for Visual Vertex Technology Company staff and interns to access approved company-related features and manage activities such as attendance and other available staff functions.",

      followUpSuggestions: [
        "How do I use VSAS?",
        "How do I mark my attendance?",
        "Where can I see my attendance information?"
      ]
    },

    /**
     * ================================================================
     * USING VSAS
     * ================================================================
     */
    {
      id: "vsas-how-to-use",
      category: "vsas",
      subcategory: "getting-started",
      priority: 10,
      importance: "high",
      retrievalWeight: 10,

      title: "How to Use VSAS",

      summary:
        "VSAS provides access to approved staff and intern features through the platform interface.",

      keywords: [
        "how to use vsas",
        "use vsas",
        "using vsas",
        "navigate vsas",
        "vsas guide",
        "how does vsas work"
      ],

      synonyms: [
        "platform guide",
        "system guide",
        "how to navigate",
        "how to operate the system"
      ],

      phrases: [
        "how do i use this",
        "how does this work",
        "teach me how to use vsas",
        "show me how to use the platform"
      ],

      intents: [
        "vsas_usage",
        "platform_navigation",
        "getting_started"
      ],

      questions: [
        "How do I use VSAS?",
        "How does VSAS work?",
        "How do I navigate the platform?"
      ],

      alternativeQuestions: [
        "How do I use this system?",
        "How does this website work?",
        "Can you teach me how to use VSAS?",
        "I don't understand this platform.",
        "How do I get started?"
      ],

      entities: [
        "VSAS",
        "Visual Vertex Staff Attendance System"
      ],

      tags: [
        "vsas",
        "guide",
        "getting-started",
        "navigation"
      ],

      relatedTopics: [
        "vsas-dashboard",
        "attendance-overview",
        "vsas-login-access",
        "vsas-profile-settings"
      ],

      shortAnswer:
        "Use VSAS by accessing the available sections through the platform navigation and selecting the feature you need.",

      answer:
        "To use VSAS, sign in through your approved access method and navigate through the available sections of the platform. The exact features available to you may depend on your account role and the functions enabled by the VSAS administrator.",

      followUpSuggestions: [
        "How do I mark my attendance?",
        "What can I do from the dashboard?",
        "How do I access my profile or settings?"
      ]
    },

    /**
     * ================================================================
     * LOGIN AND ACCESS
     * ================================================================
     */
    {
      id: "vsas-login-access",
      category: "vsas",
      subcategory: "access",
      priority: 9,
      importance: "high",
      retrievalWeight: 9,

      title: "VSAS Login and Account Access",

      summary:
        "Authorized users access VSAS using their approved account and access credentials.",

      keywords: [
        "login",
        "sign in",
        "access",
        "account access",
        "cannot login",
        "can't login",
        "log into vsas"
      ],

      synonyms: [
        "signing in",
        "account entry",
        "platform access",
        "user access"
      ],

      phrases: [
        "i cannot login",
        "i can't access my account",
        "how do i sign in",
        "how do i access vsas"
      ],

      intents: [
        "login_help",
        "account_access",
        "access_problem"
      ],

      questions: [
        "How do I log into VSAS?",
        "How do I access my account?",
        "I cannot log in.",
        "I can't access VSAS."
      ],

      alternativeQuestions: [
        "Why can't I sign in?",
        "My account is not opening.",
        "I can't enter the platform.",
        "How do I get access?"
      ],

      tags: [
        "login",
        "access",
        "account",
        "support"
      ],

      relatedTopics: [
        "vsas-overview",
        "vsas-how-to-use",
        "vsas-support-troubleshooting"
      ],

      shortAnswer:
        "Use your approved VSAS account credentials to access the platform. If access fails, contact an authorized administrator.",

      answer:
        "To access VSAS, use the approved account or login method provided to you. If you cannot access your account or experience a login problem, avoid sharing your credentials with others and contact an authorized VSAS administrator for assistance.",

      followUpSuggestions: [
        "How do I use VSAS?",
        "I am having a problem with the platform.",
        "How do I mark attendance?"
      ]
    },

    /**
     * ================================================================
     * DASHBOARD
     * ================================================================
     */
    {
      id: "vsas-dashboard",
      category: "vsas",
      subcategory: "navigation",
      priority: 8,
      importance: "medium",
      retrievalWeight: 8,

      title: "VSAS Dashboard",

      summary:
        "The dashboard provides an overview and access point for available VSAS features.",

      keywords: [
        "dashboard",
        "home",
        "main page",
        "overview",
        "vsas home"
      ],

      synonyms: [
        "home screen",
        "main screen",
        "control panel"
      ],

      phrases: [
        "what is on the dashboard",
        "what can i do from the dashboard",
        "where is the main page"
      ],

      intents: [
        "dashboard_help",
        "navigation_help"
      ],

      questions: [
        "What is the dashboard?",
        "What can I do on the dashboard?",
        "Where do I start on VSAS?"
      ],

      alternativeQuestions: [
        "What does the main page do?",
        "Where can I find the main menu?",
        "What is the home section for?"
      ],

      tags: [
        "dashboard",
        "navigation",
        "home"
      ],

      relatedTopics: [
        "vsas-how-to-use",
        "attendance-overview",
        "notifications-overview"
      ],

      shortAnswer:
        "The VSAS dashboard is the main area for viewing available information and navigating to approved platform features.",

      answer:
        "The VSAS dashboard serves as a central starting point for navigating the platform. It may display relevant information and provide access to features available to your account and user role.",

      followUpSuggestions: [
        "How do I mark my attendance?",
        "How do notifications work?",
        "How do I use VSAS?"
      ]
    },

    /**
     * ================================================================
     * ATTENDANCE OVERVIEW
     * ================================================================
     */
    {
      id: "attendance-overview",
      category: "attendance",
      subcategory: "overview",
      priority: 10,
      importance: "high",
      retrievalWeight: 10,

      title: "Attendance in VSAS",

      summary:
        "VSAS supports approved staff and intern attendance management and attendance-related activities.",

      keywords: [
        "attendance",
        "present",
        "check in",
        "check-in",
        "staff attendance",
        "intern attendance"
      ],

      synonyms: [
        "presence",
        "checkin",
        "daily attendance",
        "attendance record"
      ],

      phrases: [
        "attendance on vsas",
        "how does attendance work",
        "where do i mark attendance"
      ],

      intents: [
        "attendance_overview",
        "attendance_help"
      ],

      questions: [
        "How does attendance work?",
        "What is the attendance feature?",
        "Where do I manage my attendance?"
      ],

      alternativeQuestions: [
        "How do you track attendance here?",
        "Where can I see attendance?",
        "How does the system record presence?"
      ],

      tags: [
        "attendance",
        "staff",
        "intern",
        "record"
      ],

      relatedTopics: [
        "mark-attendance",
        "attendance-history",
        "attendance-problems"
      ],

      shortAnswer:
        "VSAS provides attendance-related features for authorized staff and interns.",

      answer:
        "VSAS includes attendance functionality for approved users. Depending on the features enabled for your account, you may be able to mark attendance, view attendance information, or access other attendance-related records.",

      followUpSuggestions: [
        "How do I mark my attendance?",
        "Where can I see my attendance history?",
        "I have a problem with my attendance."
      ]
    },

    /**
     * ================================================================
     * MARK ATTENDANCE
     * ================================================================
     */
    {
      id: "mark-attendance",
      category: "attendance",
      subcategory: "submission",
      priority: 10,
      importance: "high",
      retrievalWeight: 10,

      title: "How to Mark Attendance",

      summary:
        "Users can use the attendance feature available in their authorized VSAS interface to submit attendance when permitted.",

      keywords: [
        "mark attendance",
        "submit attendance",
        "take attendance",
        "record attendance",
        "check in",
        "mark present"
      ],

      synonyms: [
        "register attendance",
        "submit presence",
        "check-in"
      ],

      phrases: [
        "how do i mark attendance",
        "how do i check in",
        "where do i mark myself present",
        "how do i submit today's attendance"
      ],

      intents: [
        "mark_attendance",
        "attendance_submission",
        "check_in"
      ],

      questions: [
        "How do I mark my attendance?",
        "How do I check in?",
        "How do I submit my attendance?"
      ],

      alternativeQuestions: [
        "Where do I mark myself present?",
        "How do I record today's attendance?",
        "How can I check in today?",
        "I want to mark attendance."
      ],

      tags: [
        "attendance",
        "check-in",
        "submit",
        "present"
      ],

      relatedTopics: [
        "attendance-overview",
        "attendance-history",
        "attendance-problems"
      ],

      shortAnswer:
        "Open the attendance feature available in your VSAS account and follow the approved attendance submission process.",

      answer:
        "To mark your attendance, open the attendance section available in your VSAS account and complete the attendance action provided by the platform. If the attendance option is unavailable or your submission does not appear to work, contact an authorized administrator for assistance.",

      followUpSuggestions: [
        "Where can I see my attendance history?",
        "My attendance is not showing.",
        "How do I use VSAS?"
      ]
    },

    /**
     * ================================================================
     * ATTENDANCE HISTORY
     * ================================================================
     */
    {
      id: "attendance-history",
      category: "attendance",
      subcategory: "records",
      priority: 9,
      importance: "high",
      retrievalWeight: 9,

      title: "Viewing Attendance Information",

      summary:
        "Users may access attendance records and information through the attendance features available to their account.",

      keywords: [
        "attendance history",
        "attendance record",
        "past attendance",
        "attendance information",
        "my attendance"
      ],

      synonyms: [
        "attendance report",
        "attendance log",
        "attendance records"
      ],

      phrases: [
        "where can i see my attendance",
        "show my attendance",
        "check my attendance history"
      ],

      intents: [
        "attendance_history",
        "attendance_records"
      ],

      questions: [
        "Where can I see my attendance?",
        "How do I check my attendance history?",
        "Can I view my attendance record?"
      ],

      alternativeQuestions: [
        "Where are my attendance records?",
        "How can I see previous attendance?",
        "Can I check my attendance information?"
      ],

      tags: [
        "attendance",
        "history",
        "records",
        "report"
      ],

      relatedTopics: [
        "attendance-overview",
        "mark-attendance",
        "attendance-problems"
      ],

      shortAnswer:
        "Check the attendance section available in your VSAS account to view attendance information and records.",

      answer:
        "To view your attendance information, open the attendance-related section available in VSAS and look for your records or history. The exact information visible may depend on your account permissions and the features enabled for your role.",

      followUpSuggestions: [
        "How do I mark my attendance?",
        "My attendance is missing.",
        "I have an attendance problem."
      ]
    },

    /**
     * ================================================================
     * ATTENDANCE PROBLEMS
     * ================================================================
     */
    {
      id: "attendance-problems",
      category: "attendance",
      subcategory: "troubleshooting",
      priority: 10,
      importance: "high",
      retrievalWeight: 10,

      title: "Attendance Problems",

      summary:
        "Users experiencing attendance errors should avoid repeated or improper submissions and report unresolved issues to an authorized administrator.",

      keywords: [
        "attendance problem",
        "attendance not working",
        "attendance missing",
        "cannot mark attendance",
        "attendance error"
      ],

      synonyms: [
        "attendance issue",
        "check-in problem",
        "submission problem"
      ],

      phrases: [
        "my attendance is not working",
        "i cannot mark attendance",
        "my attendance did not show",
        "there is a problem with my attendance"
      ],

      intents: [
        "attendance_problem",
        "attendance_error",
        "attendance_missing"
      ],

      questions: [
        "My attendance is not working.",
        "I cannot mark attendance.",
        "My attendance is missing.",
        "There is a problem with my attendance."
      ],

      alternativeQuestions: [
        "Why did my attendance not show?",
        "My check-in failed.",
        "I marked attendance but cannot see it.",
        "What should I do if attendance is not working?"
      ],

      tags: [
        "attendance",
        "problem",
        "error",
        "support",
        "troubleshooting"
      ],

      relatedTopics: [
        "mark-attendance",
        "attendance-history",
        "vsas-support-troubleshooting"
      ],

      shortAnswer:
        "If an attendance action fails or appears incorrect, avoid repeated submissions and contact an authorized administrator if the issue continues.",

      answer:
        "If you experience a problem while marking or viewing attendance, first check whether the platform has completed the action successfully. Avoid repeatedly submitting the same attendance action. If the issue remains unresolved, report the problem to an authorized VSAS administrator with the relevant details.",

      followUpSuggestions: [
        "How do I mark attendance?",
        "Where can I see my attendance history?",
        "I am having a VSAS problem."
      ]
    },

    /**
     * ================================================================
     * DEPARTMENTS
     * ================================================================
     */
    {
      id: "departments-overview",
      category: "organization",
      subcategory: "departments",
      priority: 7,
      importance: "medium",
      retrievalWeight: 7,

      title: "Departments",

      summary:
        "Department information helps organize users and approved activities within the Visual Vertex system.",

      keywords: [
        "department",
        "departments",
        "my department",
        "department information",
        "staff department"
      ],

      synonyms: [
        "unit",
        "team section",
        "organizational department"
      ],

      phrases: [
        "what department am i in",
        "where can i see my department",
        "department information"
      ],

      intents: [
        "department_help",
        "department_information"
      ],

      questions: [
        "What is my department?",
        "Where can I see department information?",
        "What are departments used for?"
      ],

      alternativeQuestions: [
        "Which department do I belong to?",
        "How do departments work?",
        "Where is the department section?"
      ],

      tags: [
        "department",
        "organization",
        "staff"
      ],

      relatedTopics: [
        "vsas-dashboard",
        "vsas-profile-settings",
        "vsas-support-troubleshooting"
      ],

      shortAnswer:
        "Departments help organize approved staff and company activities within VSAS.",

      answer:
        "The department features in VSAS help organize staff and related company activities. The department information available to you depends on your account and the functions enabled for your role.",

      followUpSuggestions: [
        "How do I use VSAS?",
        "How do I access my profile?",
        "I need help with the platform."
      ]
    },

    /**
     * ================================================================
     * NOTIFICATIONS
     * ================================================================
     */
    {
      id: "notifications-overview",
      category: "communication",
      subcategory: "notifications",
      priority: 7,
      importance: "medium",
      retrievalWeight: 7,

      title: "VSAS Notifications",

      summary:
        "Notifications provide users with relevant updates and information available through the VSAS platform.",

      keywords: [
        "notification",
        "notifications",
        "alert",
        "alerts",
        "message notification",
        "unread notification"
      ],

      synonyms: [
        "update",
        "system alert",
        "platform notification"
      ],

      phrases: [
        "where are my notifications",
        "i have a notification",
        "how do notifications work"
      ],

      intents: [
        "notifications_help",
        "notifications_overview"
      ],

      questions: [
        "How do notifications work?",
        "Where can I see my notifications?",
        "What are VSAS notifications?"
      ],

      alternativeQuestions: [
        "Where do I check alerts?",
        "How can I see new updates?",
        "Why do I have a notification?"
      ],

      tags: [
        "notifications",
        "alerts",
        "updates",
        "communication"
      ],

      relatedTopics: [
        "announcements-overview",
        "vsas-dashboard"
      ],

      shortAnswer:
        "Notifications provide relevant updates and information through the VSAS platform when available.",

      answer:
        "VSAS notifications are used to provide relevant platform or company-related updates to authorized users. You can check the notification features available in your VSAS interface to view information relevant to your account.",

      followUpSuggestions: [
        "Where can I see announcements?",
        "How do I use VSAS?"
      ]
    },

    /**
     * ================================================================
     * ANNOUNCEMENTS
     * ================================================================
     */
    {
      id: "announcements-overview",
      category: "communication",
      subcategory: "announcements",
      priority: 7,
      importance: "medium",
      retrievalWeight: 7,

      title: "VSAS Announcements",

      summary:
        "Announcements are used to communicate approved information and updates to relevant VSAS users.",

      keywords: [
        "announcement",
        "announcements",
        "company announcement",
        "updates",
        "notice"
      ],

      synonyms: [
        "official notice",
        "company update",
        "important information"
      ],

      phrases: [
        "where can i see announcements",
        "check company updates",
        "any new announcement"
      ],

      intents: [
        "announcements_help",
        "company_updates"
      ],

      questions: [
        "Where can I see announcements?",
        "How do I check company updates?",
        "What are announcements for?"
      ],

      alternativeQuestions: [
        "Where are the latest updates?",
        "How can I see company notices?",
        "Is there any announcement?"
      ],

      tags: [
        "announcement",
        "communication",
        "updates",
        "notice"
      ],

      relatedTopics: [
        "notifications-overview",
        "vsas-dashboard"
      ],

      shortAnswer:
        "Announcements provide approved company or platform updates to relevant VSAS users.",

      answer:
        "VSAS announcements are used to communicate approved information and updates to relevant users. Check the announcements or communication features available in your platform interface for current information.",

      followUpSuggestions: [
        "Where can I see my notifications?",
        "How do I use VSAS?"
      ]
    },

    /**
     * ================================================================
     * PROFILE AND SETTINGS
     * ================================================================
     */
    {
      id: "vsas-profile-settings",
      category: "vsas",
      subcategory: "account",
      priority: 7,
      importance: "medium",
      retrievalWeight: 7,

      title: "Profile and Settings",

      summary:
        "Profile and settings features allow users to view or manage approved account-related information where available.",

      keywords: [
        "profile",
        "settings",
        "account settings",
        "my account",
        "user profile"
      ],

      synonyms: [
        "account profile",
        "user settings",
        "account information"
      ],

      phrases: [
        "where is my profile",
        "how do i change settings",
        "account information"
      ],

      intents: [
        "profile_help",
        "settings_help",
        "account_management"
      ],

      questions: [
        "Where is my profile?",
        "How do I access settings?",
        "How do I manage my account?"
      ],

      alternativeQuestions: [
        "Where can I find my account information?",
        "How do I change my settings?",
        "How do I open my profile?"
      ],

      tags: [
        "profile",
        "settings",
        "account"
      ],

      relatedTopics: [
        "vsas-login-access",
        "vsas-dashboard",
        "vsas-support-troubleshooting"
      ],

      shortAnswer:
        "Use the profile or settings features available in your VSAS account to manage approved account information.",

      answer:
        "Profile and settings options allow you to access approved account-related information and preferences where those features are enabled. The options available may depend on your VSAS account and user role.",

      followUpSuggestions: [
        "How do I use VSAS?",
        "I cannot access my account."
      ]
    },

    /**
     * ================================================================
     * STAFF MANAGEMENT
     * ================================================================
     */
    {
      id: "staff-management-overview",
      category: "administration",
      subcategory: "staff-management",
      priority: 8,
      importance: "medium",
      retrievalWeight: 8,

      title: "Staff Management",

      summary:
        "Administrative staff-management functions help authorized users manage approved staff information within VSAS.",

      keywords: [
        "staff management",
        "manage staff",
        "staff",
        "employee management",
        "add staff",
        "remove staff"
      ],

      synonyms: [
        "employee administration",
        "staff administration",
        "user management"
      ],

      phrases: [
        "how do i manage staff",
        "where do admins manage staff",
        "can i add a staff member"
      ],

      intents: [
        "staff_management",
        "admin_help"
      ],

      questions: [
        "How does staff management work?",
        "Can I manage staff in VSAS?",
        "Where do administrators manage staff?"
      ],

      alternativeQuestions: [
        "How do I add a staff member?",
        "How do I manage employee information?",
        "Where is staff administration?"
      ],

      tags: [
        "staff",
        "management",
        "administration",
        "admin"
      ],

      relatedTopics: [
        "departments-overview",
        "vsas-profile-settings"
      ],

      shortAnswer:
        "Staff-management features are intended for authorized users who manage approved staff information within VSAS.",

      answer:
        "VSAS may provide staff-management functions for authorized administrators. Access to staff records and management actions depends on the permissions assigned to the user's account.",

      followUpSuggestions: [
        "How do departments work?",
        "I need help with VSAS."
      ]
    },

    /**
     * ================================================================
     * GENERAL TROUBLESHOOTING
     * ================================================================
     */
    {
      id: "vsas-support-troubleshooting",
      category: "support",
      subcategory: "troubleshooting",
      priority: 9,
      importance: "high",
      retrievalWeight: 9,

      title: "VSAS Support and Troubleshooting",

      summary:
        "Users experiencing platform problems should check the issue carefully and contact an authorized administrator when necessary.",

      keywords: [
        "problem",
        "error",
        "not working",
        "issue",
        "bug",
        "support",
        "help"
      ],

      synonyms: [
        "technical problem",
        "system issue",
        "platform error",
        "troubleshooting"
      ],

      phrases: [
        "vsas is not working",
        "i have a problem",
        "there is an error",
        "help me fix this"
      ],

      intents: [
        "technical_support",
        "troubleshooting",
        "platform_problem"
      ],

      questions: [
        "VSAS is not working.",
        "I have a problem with the platform.",
        "There is an error.",
        "How do I get help?"
      ],

      alternativeQuestions: [
        "Something is wrong with the system.",
        "The platform has a problem.",
        "Can someone help me?",
        "How do I report an issue?"
      ],

      tags: [
        "support",
        "problem",
        "error",
        "troubleshooting"
      ],

      relatedTopics: [
        "vsas-login-access",
        "attendance-problems",
        "vsas-how-to-use"
      ],

      shortAnswer:
        "If you experience a VSAS problem, check the action you were performing and contact an authorized administrator if the issue continues.",

      answer:
        "If you experience a problem while using VSAS, first check the section or action you were using and avoid repeatedly submitting the same request. If the problem continues, contact an authorized VSAS administrator and provide useful details about what happened.",

      followUpSuggestions: [
        "I have an attendance problem.",
        "I cannot access my account.",
        "How do I use VSAS?"
      ]
    }

  ];

  /**
   * Freeze nested knowledge data to reduce accidental modification
   * by other scripts.
   */
  function freezeKnowledgeEntry(entry) {
    const frozenEntry = {
      ...entry
    };

    [
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
    ].forEach(function (property) {
      if (Array.isArray(frozenEntry[property])) {
        frozenEntry[property] = Object.freeze([
          ...frozenEntry[property]
        ]);
      }
    });

    return Object.freeze(frozenEntry);
  }

  /**
   * Public VSAS knowledge API.
   */
  window.VertexAIVSASKnowledge = Object.freeze(
    VSAS_KNOWLEDGE.map(freezeKnowledgeEntry)
  );

})();