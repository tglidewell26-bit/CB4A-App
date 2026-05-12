/**
 * Typed data contracts for every Teacher Guide section.
 *
 * Architecture: Claude returns ONLY JSON matching one of these interfaces.
 * TypeScript renderers (teacherGuideRenderers.ts) convert the typed data into
 * the final HTML. This file is the single source of truth for Claude's role.
 *
 * Sections that do NOT call Claude:
 *   - lesson_overview  → constant string in renderer
 *   - materials_needed → built from chapter meta in renderer
 */

export interface MeasurableObjectivesData {
  objectives: Array<{
    /** SWBAT statement, e.g. "identify the main character's motivation" — without leading "Students will be able to". */
    text: string;
    /** Exact ELA standard code, e.g. "RL.4.1". */
    standardCode: string;
  }>;
}

export interface StandardsData {
  /** Standards Claude selected for this chapter. Description text comes from elaStandards.ts in code. */
  standards: Array<{
    code: string;
  }>;
}

export interface GetReadyToReadData {
  /** 4–5 implementation steps. */
  implementationSteps: string[];
  /** One-sentence pedagogical rationale shown as the connection tip callout. */
  connectionTip: string;
}

export interface WordsToKnowMiniLessonData {
  /** One vocabulary word from the chapter list, used as the worked example. */
  workedWord: string;
  /** Real quote from the chapter showing the word in context. */
  workedQuote: string;
  /** Page number for the quote. */
  workedPage: number;
  /** How a student would use surrounding text to figure out the meaning. */
  contextClueStrategy: string;
}

export type QuestionType =
  | "comprehension"
  | "inference"
  | "analysis"
  | "evaluation"
  | "vocabulary and inference";

export interface GuidedReadingData {
  sections: Array<{
    pageStart: number;
    pageEnd: number;
    /** Exact phrase from the chapter at the start of this segment. */
    openingPhrase: string;
    /** Exact phrase from the chapter at the end of this segment. */
    closingPhrase: string;
    questions: Array<{
      text: string;
      questionType: QuestionType;
    }>;
  }>;
  /** Read-aloud tip callout text. */
  readAloudTip: string;
}

export interface QuestionAnswer {
  /** The question as it appears in the workbook. */
  question: string;
  /** The teacher-facing answer, 1–2 sentences. */
  answer: string;
  /** Page number where the evidence is found. */
  page: number;
}

export interface ThinkAboutTheStoryAnswersData {
  /** Per-question answers (mirrors the workbook's Think About the Story questions). */
  answers: QuestionAnswer[];
  /** 2–3 deeper teacher prompts that push beyond literal recall. */
  inferentialPrompts: string[];
  /**
   * Tiered discussion prompts grouped by cognitive level. 2–3 prompts per tier.
   * Restored from the canonical InDesign reference.
   */
  tieredDiscussion: {
    literal: string[];
    inference: string[];
    analysis: string[];
    evaluation: string[];
  };
  /** Higher-order analytical thinking prompts. 2–3 items. */
  analyticalThinking: string[];
  /** Personal connection prompts that link the story to students' lives. 2–3 items. */
  personalConnection: string[];
}

export interface DifferentiatedSupportsData {
  strugglingReaders: SupportPhases;
  englishLanguageLearners: SupportPhases;
  advancedStudents: SupportPhases;
}

export interface SupportPhases {
  before: string[];
  during: string[];
  after: string[];
}

export interface CommonStudentQuestionsData {
  questions: Array<{
    /** Short student-voiced question. */
    studentQ: string;
    /** Teacher-facing answer, 1–3 sentences. */
    teacherA: string;
    /** Optional page citation. */
    page?: number;
  }>;
}

/** Headings are constants in the renderer; Claude only provides the body of each error. */
export interface CreativeResponseErrorsData {
  /** Main character's name, used to substitute into the "Retelling" heading. */
  characterName: string;
  errors: {
    /** "No Specific Details From The Chapter" body. */
    noSpecificDetails: ErrorBody;
    /** "Breaking Character" body. */
    breakingCharacter: ErrorBody;
    /** "Retelling The Whole Chapter Instead of Focusing on [character's name] Experience" body. */
    retelling: ErrorBody;
    /** "No Evidence From the Text" body. */
    noEvidence: ErrorBody;
    /** "Modern Language That Doesn't Fit The Story" body. */
    modernLanguage: ErrorBody;
  };
}

export interface ErrorBody {
  /** Short paragraph describing why this is a common pitfall. */
  paragraph: string;
  /** Concrete weak student response example. */
  weakExample: string;
  /** Concrete teacher coaching tip on how to fix it. */
  howToFix: string;
}

export interface ExitTicketData {
  /**
   * Prompt for an exit ticket asking students to PREDICT what will happen in
   * the next chapter, justified with "because" + text evidence. The renderer
   * does not enforce the wording, but the prompt should follow this pattern.
   */
  prompt: string;
  /** 3 concrete observable success criteria. */
  successCriteria: string[];
  /** A strong example student response, 2–3 sentences. */
  strongExample: string;
  /** A developing example student response, 2–3 sentences. */
  developingExample: string;
}

export interface MultipleChoiceAnswer {
  question: string;
  /** Letter A/B/C/D — the correct option from the workbook. */
  correctLetter: "A" | "B" | "C" | "D";
  /** One-line rationale citing the text. */
  rationale: string;
}

export interface EvidenceAnswer {
  question: string;
  /** Sample student answer in 1–2 sentences. */
  sampleAnswer: string;
  /** Direct quote from the chapter that supports the answer. */
  quote: string;
  page: number;
}

export interface CharacterChartAnswer {
  characterName: string;
  description: string;
  whatThisShows: string;
  /** Supporting quote from the chapter. */
  quote: string;
  page: number;
}

/**
 * Homeschool Parent Guide — appended after the standard Teacher Guide content.
 * Modeled on the FINAL gold-standard reference (Heidi Grade 3, Lesson 1).
 */
export interface HomeschoolParentGuideData {
  chapterSnapshot: {
    /** 2–4 sentence plain-language synopsis of what happens in the chapter. */
    synopsis: string;
    /** Why this chapter matters — themes, lessons, why it's worth reading aloud. */
    whyThisMatters: string;
  };
  pacingTips: {
    /** Suggested split if the chapter is read across multiple days. */
    day1: string;
    day2: string;
    day3?: string;
    /** Concrete places to pause and check in. */
    pausePoints: string[];
    /** Natural stopping points if a session needs to be cut short. */
    stoppingPoints: string[];
  };
  discussionQuestions: {
    /** Literal/comprehension questions parents can ask. 3–4 items. */
    understanding: string[];
    /** Inference and analysis questions. 3–4 items. */
    thinkingDeeper: string[];
    /** Personal connection questions linking the story to the child's life. 3–4 items. */
    personalConnections: string[];
  };
  simpleActivity: {
    /** Short activity name, e.g. "Pack Heidi's Suitcase". */
    name: string;
    /** Materials a parent would need at home. */
    materials: string[];
    /** Step-by-step instructions. */
    steps: string[];
    /** Optional extension for kids who want more. */
    bonusChallenge: string;
  };
  parentNotes: {
    /** Things parents should be aware of (e.g. emotional content, themes). 1–3 items. */
    contentAwareness: string[];
    /** Tips for handling vocabulary as a parent (not a teacher). */
    vocabTips: string[];
    /** Specific words from this chapter parents may want to explain. */
    wordsToExplain: string[];
  };
  encouragement: {
    /** A short, warm paragraph of encouragement for the parent. */
    paragraph: string;
    /** 2–4 short reminders ("you're doing great" style). */
    reminders: string[];
  };
}

/**
 * Standards Mapping — 4-column table appended after the Homeschool Parent
 * Guide. The Description column is filled from the standards lookup table
 * (elaStandards.ts); Claude only provides howAddressed and assessmentEvidence
 * for each code that appears in the chapter's parsed Standards section.
 */
export interface StandardsMappingData {
  rows: Array<{
    /** Exact ELA standard code, e.g. "RL.3.1". Must match a code from the chapter's Standards section. */
    code: string;
    /** Concrete sentence describing how this chapter addresses the standard. */
    howAddressed: string;
    /** Concrete sentence describing how a teacher can see evidence the standard is met. */
    assessmentEvidence: string;
  }>;
}

export interface AnswerKeyData {
  readingBetweenTheLines: QuestionAnswer[];
  digDeeper: QuestionAnswer[];
  multipleChoice: MultipleChoiceAnswer[];
  evidenceFromTheStory: EvidenceAnswer[];
  characterChart: CharacterChartAnswer[];
  /** 3–5 visual elements students should consider including in their drawing. */
  drawItDetails: string[];
  /**
   * The 5–7 Bonus Challenge events in CHRONOLOGICAL order (1 = earliest).
   * The student workbook displays these same events shuffled; the teacher guide
   * uses this list to show the correct ordering. Optional for backward
   * compatibility with chapters generated before this field existed.
   */
  bonusChallenge?: string[];
}
