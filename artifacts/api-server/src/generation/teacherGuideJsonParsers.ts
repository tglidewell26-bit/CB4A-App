/**
 * Parsers that convert Claude's raw JSON response into typed data for each
 * Teacher Guide section. Every parser:
 *
 *   1. Strips markdown code fences if present.
 *   2. Calls JSON.parse and surfaces a clear error if it fails.
 *   3. Validates that required top-level fields are present and have the right
 *      shape (array vs object vs string).
 *   4. Returns a typed object.
 *
 * These replace the old HTML structural validators — if Claude returns
 * malformed data, generation fails loudly at the parse step instead of
 * producing broken HTML downstream.
 */

import type {
  AnswerKeyData,
  CharacterChartAnswer,
  CommonStudentQuestionsData,
  CreativeResponseErrorsData,
  DifferentiatedSupportsData,
  ErrorBody,
  EvidenceAnswer,
  ExitTicketData,
  GetReadyToReadData,
  GuidedReadingData,
  HomeschoolParentGuideData,
  MeasurableObjectivesData,
  MultipleChoiceAnswer,
  ParentGuideQA,
  QuestionAnswer,
  QuestionType,
  StandardsData,
  StandardsMappingData,
  SupportPhases,
  ThinkAboutTheStoryAnswersData,
  WordsToKnowMiniLessonData,
} from "./teacherGuideTypes.js";
import type { ParsedCoreQuestions } from "../prompts/workbookSectionPrompts.js";

const QUESTION_TYPES: ReadonlyArray<QuestionType> = [
  "comprehension",
  "inference",
  "analysis",
  "evaluation",
  "vocabulary and inference",
];

const MC_LETTERS = ["A", "B", "C", "D"] as const;

class TgParseError extends Error {
  constructor(sectionKey: string, detail: string) {
    super(`Teacher Guide JSON parse failed for "${sectionKey}": ${detail}`);
    this.name = "TgParseError";
  }
}

function stripFences(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
  }
  return trimmed;
}

function parseJson(sectionKey: string, raw: string): unknown {
  const cleaned = stripFences(raw);
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new TgParseError(
      sectionKey,
      `not valid JSON (${message}). First 200 chars: ${cleaned.slice(0, 200)}`,
    );
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(sectionKey: string, value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new TgParseError(sectionKey, `field "${field}" must be a non-empty string`);
  }
  return value.trim();
}

function asNumber(sectionKey: string, value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TgParseError(sectionKey, `field "${field}" must be a finite number`);
  }
  return value;
}

function asArray(sectionKey: string, value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new TgParseError(sectionKey, `field "${field}" must be an array`);
  }
  return value;
}

function asStringArray(sectionKey: string, value: unknown, field: string): string[] {
  return asArray(sectionKey, value, field).map((v, i) =>
    asString(sectionKey, v, `${field}[${i}]`),
  );
}

function asObject(sectionKey: string, value: unknown, field: string): Record<string, unknown> {
  if (!isPlainObject(value)) {
    throw new TgParseError(sectionKey, `field "${field}" must be an object`);
  }
  return value;
}

function asQuestionType(sectionKey: string, value: unknown, field: string): QuestionType {
  if (typeof value !== "string" || !QUESTION_TYPES.includes(value as QuestionType)) {
    throw new TgParseError(
      sectionKey,
      `field "${field}" must be one of: ${QUESTION_TYPES.join(", ")} (got "${String(value)}")`,
    );
  }
  return value as QuestionType;
}

function parseQuestionAnswer(sectionKey: string, raw: unknown, field: string): QuestionAnswer {
  const obj = asObject(sectionKey, raw, field);
  return {
    question: asString(sectionKey, obj.question, `${field}.question`),
    answer: asString(sectionKey, obj.answer, `${field}.answer`),
    page: asNumber(sectionKey, obj.page, `${field}.page`),
  };
}

function parseSupportPhases(sectionKey: string, raw: unknown, field: string): SupportPhases {
  const obj = asObject(sectionKey, raw, field);
  return {
    before: asStringArray(sectionKey, obj.before, `${field}.before`),
    during: asStringArray(sectionKey, obj.during, `${field}.during`),
    after: asStringArray(sectionKey, obj.after, `${field}.after`),
  };
}

function parseErrorBody(sectionKey: string, raw: unknown, field: string): ErrorBody {
  const obj = asObject(sectionKey, raw, field);
  return {
    paragraph: asString(sectionKey, obj.paragraph, `${field}.paragraph`),
    weakExample: asString(sectionKey, obj.weakExample, `${field}.weakExample`),
    howToFix: asString(sectionKey, obj.howToFix, `${field}.howToFix`),
  };
}

// ---------------------------------------------------------------------------
// Section parsers
// ---------------------------------------------------------------------------

export function parseMeasurableObjectives(raw: string): MeasurableObjectivesData {
  const sectionKey = "measurable_objectives";
  const data = parseJson(sectionKey, raw);
  const root = asObject(sectionKey, data, "(root)");
  const objectives = asArray(sectionKey, root.objectives, "objectives").map((item, i) => {
    const obj = asObject(sectionKey, item, `objectives[${i}]`);
    return {
      text: asString(sectionKey, obj.text, `objectives[${i}].text`),
      standardCode: asString(sectionKey, obj.standardCode, `objectives[${i}].standardCode`),
    };
  });
  if (objectives.length < 5 || objectives.length > 6) {
    throw new TgParseError(sectionKey, `expected 5–6 objectives, got ${objectives.length}`);
  }
  return { objectives };
}

export function parseStandards(raw: string): StandardsData {
  const sectionKey = "standards";
  const data = parseJson(sectionKey, raw);
  const root = asObject(sectionKey, data, "(root)");
  const standards = asArray(sectionKey, root.standards, "standards").map((item, i) => {
    const obj = asObject(sectionKey, item, `standards[${i}]`);
    return {
      code: asString(sectionKey, obj.code, `standards[${i}].code`),
    };
  });
  return { standards };
}

export function parseGetReadyToRead(raw: string): GetReadyToReadData {
  const sectionKey = "get_ready_to_read";
  const data = parseJson(sectionKey, raw);
  const root = asObject(sectionKey, data, "(root)");
  return {
    implementationSteps: asStringArray(sectionKey, root.implementationSteps, "implementationSteps"),
    connectionTip: asString(sectionKey, root.connectionTip, "connectionTip"),
  };
}

export function parseWordsToKnowMiniLesson(raw: string): WordsToKnowMiniLessonData {
  const sectionKey = "words_to_know_mini_lesson";
  const data = parseJson(sectionKey, raw);
  const root = asObject(sectionKey, data, "(root)");
  return {
    workedWord: asString(sectionKey, root.workedWord, "workedWord"),
    workedQuote: asString(sectionKey, root.workedQuote, "workedQuote"),
    workedPage: asNumber(sectionKey, root.workedPage, "workedPage"),
    contextClueStrategy: asString(sectionKey, root.contextClueStrategy, "contextClueStrategy"),
  };
}

export function parseGuidedReading(raw: string): GuidedReadingData {
  const sectionKey = "guided_reading";
  const data = parseJson(sectionKey, raw);
  const root = asObject(sectionKey, data, "(root)");
  const sectionsRaw = asArray(sectionKey, root.sections, "sections");
  const sections = sectionsRaw.map((item, i) => {
    const obj = asObject(sectionKey, item, `sections[${i}]`);
    const questions = asArray(sectionKey, obj.questions, `sections[${i}].questions`).map(
      (q, j) => {
        const qObj = asObject(sectionKey, q, `sections[${i}].questions[${j}]`);
        return {
          text: asString(sectionKey, qObj.text, `sections[${i}].questions[${j}].text`),
          questionType: asQuestionType(
            sectionKey,
            qObj.questionType,
            `sections[${i}].questions[${j}].questionType`,
          ),
        };
      },
    );
    return {
      pageStart: asNumber(sectionKey, obj.pageStart, `sections[${i}].pageStart`),
      pageEnd: asNumber(sectionKey, obj.pageEnd, `sections[${i}].pageEnd`),
      openingPhrase: asString(sectionKey, obj.openingPhrase, `sections[${i}].openingPhrase`),
      closingPhrase: asString(sectionKey, obj.closingPhrase, `sections[${i}].closingPhrase`),
      questions,
    };
  });
  return {
    sections,
    readAloudTip: asString(sectionKey, root.readAloudTip, "readAloudTip"),
  };
}

export function parseThinkAboutTheStoryAnswers(raw: string): ThinkAboutTheStoryAnswersData {
  const sectionKey = "think_about_the_story_answers";
  const data = parseJson(sectionKey, raw);
  const root = asObject(sectionKey, data, "(root)");
  const answers = asArray(sectionKey, root.answers, "answers").map((item, i) =>
    parseQuestionAnswer(sectionKey, item, `answers[${i}]`),
  );
  const tiered = asObject(sectionKey, root.tieredDiscussion, "tieredDiscussion");
  return {
    answers,
    inferentialPrompts: asStringArray(sectionKey, root.inferentialPrompts, "inferentialPrompts"),
    tieredDiscussion: {
      literal: asStringArray(sectionKey, tiered.literal, "tieredDiscussion.literal"),
      inference: asStringArray(sectionKey, tiered.inference, "tieredDiscussion.inference"),
      analysis: asStringArray(sectionKey, tiered.analysis, "tieredDiscussion.analysis"),
      evaluation: asStringArray(sectionKey, tiered.evaluation, "tieredDiscussion.evaluation"),
    },
    analyticalThinking: asStringArray(sectionKey, root.analyticalThinking, "analyticalThinking"),
    personalConnection: asStringArray(sectionKey, root.personalConnection, "personalConnection"),
  };
}

export function parseDifferentiatedSupports(raw: string): DifferentiatedSupportsData {
  const sectionKey = "differentiated_supports";
  const data = parseJson(sectionKey, raw);
  const root = asObject(sectionKey, data, "(root)");
  return {
    strugglingReaders: parseSupportPhases(sectionKey, root.strugglingReaders, "strugglingReaders"),
    englishLanguageLearners: parseSupportPhases(
      sectionKey,
      root.englishLanguageLearners,
      "englishLanguageLearners",
    ),
    advancedStudents: parseSupportPhases(sectionKey, root.advancedStudents, "advancedStudents"),
  };
}

export function parseCommonStudentQuestions(raw: string): CommonStudentQuestionsData {
  const sectionKey = "common_student_questions";
  const data = parseJson(sectionKey, raw);
  const root = asObject(sectionKey, data, "(root)");
  const questions = asArray(sectionKey, root.questions, "questions").map((item, i) => {
    const obj = asObject(sectionKey, item, `questions[${i}]`);
    const out: { studentQ: string; teacherA: string; page?: number } = {
      studentQ: asString(sectionKey, obj.studentQ, `questions[${i}].studentQ`),
      teacherA: asString(sectionKey, obj.teacherA, `questions[${i}].teacherA`),
    };
    if (obj.page !== undefined && obj.page !== null) {
      out.page = asNumber(sectionKey, obj.page, `questions[${i}].page`);
    }
    return out;
  });
  if (questions.length < 5 || questions.length > 8) {
    throw new TgParseError(sectionKey, `expected 5–8 questions, got ${questions.length}`);
  }
  return { questions };
}

export function parseCreativeResponseErrors(raw: string): CreativeResponseErrorsData {
  const sectionKey = "creative_response_common_errors";
  const data = parseJson(sectionKey, raw);
  const root = asObject(sectionKey, data, "(root)");
  const errorsObj = asObject(sectionKey, root.errors, "errors");
  return {
    characterName: asString(sectionKey, root.characterName, "characterName"),
    errors: {
      noSpecificDetails: parseErrorBody(
        sectionKey,
        errorsObj.noSpecificDetails,
        "errors.noSpecificDetails",
      ),
      breakingCharacter: parseErrorBody(
        sectionKey,
        errorsObj.breakingCharacter,
        "errors.breakingCharacter",
      ),
      retelling: parseErrorBody(sectionKey, errorsObj.retelling, "errors.retelling"),
      noEvidence: parseErrorBody(sectionKey, errorsObj.noEvidence, "errors.noEvidence"),
      modernLanguage: parseErrorBody(sectionKey, errorsObj.modernLanguage, "errors.modernLanguage"),
    },
  };
}

function assertLength(
  sectionKey: string,
  field: string,
  arr: ReadonlyArray<unknown>,
  min: number,
  max: number,
): void {
  if (arr.length < min || arr.length > max) {
    throw new TgParseError(
      sectionKey,
      `field "${field}" must have between ${min} and ${max} items (got ${arr.length})`,
    );
  }
}

function parseQAArray(
  sectionKey: string,
  raw: unknown,
  field: string,
  exactCount: number,
): ParentGuideQA[] {
  const arr = asArray(sectionKey, raw, field);
  if (arr.length !== exactCount) {
    throw new TgParseError(
      sectionKey,
      `field "${field}" must have exactly ${exactCount} items (got ${arr.length})`,
    );
  }
  return arr.map((item, i) => {
    const obj = asObject(sectionKey, item, `${field}[${i}]`);
    return {
      question: asString(sectionKey, obj.question, `${field}[${i}].question`),
      answer: asString(sectionKey, obj.answer, `${field}[${i}].answer`),
    };
  });
}

export function parseHomeschoolParentGuide(raw: string): HomeschoolParentGuideData {
  const sectionKey = "homeschool_parent_guide";
  const data = parseJson(sectionKey, raw);
  const root = asObject(sectionKey, data, "(root)");

  const snapshot = asObject(sectionKey, root.chapterSnapshot, "chapterSnapshot");
  const pacing = asObject(sectionKey, root.pacingTips, "pacingTips");
  const discussion = asObject(sectionKey, root.discussionQuestions, "discussionQuestions");
  const activity = asObject(sectionKey, root.simpleActivity, "simpleActivity");
  const notes = asObject(sectionKey, root.parentNotes, "parentNotes");
  const encouragement = asObject(sectionKey, root.encouragement, "encouragement");

  const day3Raw = pacing.day3;
  const day3 =
    day3Raw === undefined || day3Raw === null || (typeof day3Raw === "string" && !day3Raw.trim())
      ? undefined
      : asString(sectionKey, day3Raw, "pacingTips.day3");

  // pacing
  const pausePoints = asStringArray(sectionKey, pacing.pausePoints, "pacingTips.pausePoints");
  assertLength(sectionKey, "pacingTips.pausePoints", pausePoints, 2, 5);
  const stoppingPoints = asStringArray(
    sectionKey,
    pacing.stoppingPoints,
    "pacingTips.stoppingPoints",
  );
  assertLength(sectionKey, "pacingTips.stoppingPoints", stoppingPoints, 2, 4);

  // discussion
  const understanding = parseQAArray(
    sectionKey,
    discussion.understanding,
    "discussionQuestions.understanding",
    4,
  );
  const thinkingDeeper = parseQAArray(
    sectionKey,
    discussion.thinkingDeeper,
    "discussionQuestions.thinkingDeeper",
    3,
  );
  const personalConnections = asStringArray(
    sectionKey,
    discussion.personalConnections,
    "discussionQuestions.personalConnections",
  );
  if (personalConnections.length !== 3) {
    throw new TgParseError(
      sectionKey,
      `field "discussionQuestions.personalConnections" must have exactly 3 items (got ${personalConnections.length})`,
    );
  }

  // activity
  const whatYouNeed = asStringArray(
    sectionKey,
    activity.whatYouNeed,
    "simpleActivity.whatYouNeed",
  );
  assertLength(sectionKey, "simpleActivity.whatYouNeed", whatYouNeed, 2, 6);
  const whatToDo = asStringArray(sectionKey, activity.whatToDo, "simpleActivity.whatToDo");
  assertLength(sectionKey, "simpleActivity.whatToDo", whatToDo, 3, 8);
  const bonus = asObject(sectionKey, activity.bonusChallenge, "simpleActivity.bonusChallenge");
  const reflectionPromptsArr = asStringArray(
    sectionKey,
    bonus.reflectionPrompts,
    "simpleActivity.bonusChallenge.reflectionPrompts",
  );
  if (reflectionPromptsArr.length !== 2) {
    throw new TgParseError(
      sectionKey,
      `field "simpleActivity.bonusChallenge.reflectionPrompts" must have exactly 2 items (got ${reflectionPromptsArr.length})`,
    );
  }

  // parent notes
  let contentAwareness:
    | Array<{ title: string; paragraph: string }>
    | undefined;
  if (notes.contentAwareness !== undefined && notes.contentAwareness !== null) {
    const caArr = asArray(sectionKey, notes.contentAwareness, "parentNotes.contentAwareness");
    if (caArr.length > 0) {
      assertLength(sectionKey, "parentNotes.contentAwareness", caArr, 1, 3);
      contentAwareness = caArr.map((item, i) => {
        const obj = asObject(sectionKey, item, `parentNotes.contentAwareness[${i}]`);
        return {
          title: asString(sectionKey, obj.title, `parentNotes.contentAwareness[${i}].title`),
          paragraph: asString(
            sectionKey,
            obj.paragraph,
            `parentNotes.contentAwareness[${i}].paragraph`,
          ),
        };
      });
    }
    // empty array → omit
  }

  const vocabTipsArr = asArray(
    sectionKey,
    notes.vocabularyTips,
    "parentNotes.vocabularyTips",
  );
  if (vocabTipsArr.length !== 3) {
    throw new TgParseError(
      sectionKey,
      `field "parentNotes.vocabularyTips" must have exactly 3 items (got ${vocabTipsArr.length})`,
    );
  }
  const vocabularyTips = vocabTipsArr.map((item, i) => {
    const obj = asObject(sectionKey, item, `parentNotes.vocabularyTips[${i}]`);
    return {
      strategy: asString(sectionKey, obj.strategy, `parentNotes.vocabularyTips[${i}].strategy`),
      example: asString(sectionKey, obj.example, `parentNotes.vocabularyTips[${i}].example`),
    };
  });

  const wordsArr = asArray(sectionKey, notes.wordsToExplain, "parentNotes.wordsToExplain");
  assertLength(sectionKey, "parentNotes.wordsToExplain", wordsArr, 4, 6);
  const wordsToExplain = wordsArr.map((item, i) => {
    const obj = asObject(sectionKey, item, `parentNotes.wordsToExplain[${i}]`);
    return {
      word: asString(sectionKey, obj.word, `parentNotes.wordsToExplain[${i}].word`),
      definition: asString(
        sectionKey,
        obj.definition,
        `parentNotes.wordsToExplain[${i}].definition`,
      ),
    };
  });

  // encouragement
  const reminders = asStringArray(sectionKey, encouragement.reminders, "encouragement.reminders");
  assertLength(sectionKey, "encouragement.reminders", reminders, 5, 6);

  return {
    chapterSnapshot: {
      synopsis: asString(sectionKey, snapshot.synopsis, "chapterSnapshot.synopsis"),
      whyThisMatters: asString(
        sectionKey,
        snapshot.whyThisMatters,
        "chapterSnapshot.whyThisMatters",
      ),
    },
    pacingTips: {
      day1: asString(sectionKey, pacing.day1, "pacingTips.day1"),
      day2: asString(sectionKey, pacing.day2, "pacingTips.day2"),
      ...(day3 !== undefined ? { day3 } : {}),
      pausePoints,
      stoppingPoints,
    },
    discussionQuestions: { understanding, thinkingDeeper, personalConnections },
    simpleActivity: {
      name: asString(sectionKey, activity.name, "simpleActivity.name"),
      rationale: asString(sectionKey, activity.rationale, "simpleActivity.rationale"),
      whatYouNeed,
      whatToDo,
      bonusChallenge: {
        description: asString(
          sectionKey,
          bonus.description,
          "simpleActivity.bonusChallenge.description",
        ),
        reflectionPrompts: [reflectionPromptsArr[0], reflectionPromptsArr[1]],
      },
    },
    parentNotes: {
      ...(contentAwareness ? { contentAwareness } : {}),
      vocabularyTips,
      wordsToExplain,
    },
    encouragement: {
      opening: asString(sectionKey, encouragement.opening, "encouragement.opening"),
      reminders,
      closing: asString(sectionKey, encouragement.closing, "encouragement.closing"),
    },
  };
}

/**
 * Cross-checks the parsed Standards Mapping rows against the codes already
 * chosen by the chapter's Standards section. Claude is instructed to emit one
 * row per listed code in the same order, but it can drop, duplicate, reorder,
 * or invent codes. Any of those silently produce a mapping table that does not
 * match the Standards block above it. This validator surfaces the mismatch as
 * a loud parse-style error so generation fails immediately.
 */
export function validateStandardsMappingCodes(
  expectedCodes: ReadonlyArray<string>,
  data: StandardsMappingData,
): void {
  const sectionKey = "standards_mapping";
  const actual = data.rows.map((r) => r.code);
  if (actual.length !== expectedCodes.length) {
    throw new TgParseError(
      sectionKey,
      `expected ${expectedCodes.length} row(s) (one per chapter standard), got ${actual.length}. Expected codes: [${expectedCodes.join(", ")}]. Actual codes: [${actual.join(", ")}]`,
    );
  }
  for (let i = 0; i < expectedCodes.length; i += 1) {
    if (actual[i] !== expectedCodes[i]) {
      throw new TgParseError(
        sectionKey,
        `rows[${i}].code "${actual[i]}" does not match expected "${expectedCodes[i]}". Rows must appear in the same order as the chapter's Standards section. Expected: [${expectedCodes.join(", ")}]. Actual: [${actual.join(", ")}]`,
      );
    }
  }
}

export function parseStandardsMapping(raw: string): StandardsMappingData {
  const sectionKey = "standards_mapping";
  const data = parseJson(sectionKey, raw);
  const root = asObject(sectionKey, data, "(root)");
  const rows = asArray(sectionKey, root.rows, "rows").map((item, i) => {
    const obj = asObject(sectionKey, item, `rows[${i}]`);
    return {
      code: asString(sectionKey, obj.code, `rows[${i}].code`),
      howAddressed: asString(sectionKey, obj.howAddressed, `rows[${i}].howAddressed`),
      assessmentEvidence: asString(
        sectionKey,
        obj.assessmentEvidence,
        `rows[${i}].assessmentEvidence`,
      ),
    };
  });
  return { rows };
}

export function parseExitTicket(raw: string): ExitTicketData {
  const sectionKey = "exit_ticket";
  const data = parseJson(sectionKey, raw);
  const root = asObject(sectionKey, data, "(root)");
  const successCriteria = asStringArray(sectionKey, root.successCriteria, "successCriteria");
  if (successCriteria.length < 3) {
    throw new TgParseError(sectionKey, `expected at least 3 successCriteria, got ${successCriteria.length}`);
  }
  return {
    prompt: asString(sectionKey, root.prompt, "prompt"),
    successCriteria,
    strongExample: asString(sectionKey, root.strongExample, "strongExample"),
    developingExample: asString(sectionKey, root.developingExample, "developingExample"),
  };
}

/**
 * Cross-checks the parsed multiple-choice answer key against the workbook MC
 * HTML so a teacher never sees an answer letter (e.g. "A") that does not refer
 * to a real option in the corresponding question.
 *
 * Claude is instructed to copy the chosen letter from the MC HTML into the
 * answers JSON, but it can mis-label the letter (write "A" while the option it
 * meant is shown as "B"), drop or duplicate options, or output a different
 * count of MC items in the HTML vs the JSON. Any of those silently produce a
 * wrong answer key. This validator surfaces them as a loud parse-style error.
 *
 * Matching is by index — the prompt requires exactly 3 MC items in both the
 * HTML block and the answers JSON, in the same order.
 */
export function validateMultipleChoiceAnswerLetters(
  mcHtml: string,
  answers: ReadonlyArray<Pick<MultipleChoiceAnswer, "correctLetter">>,
): void {
  const sectionKey = "answer_key";
  const ulRegex = /<ul\b[^>]*\bclass="[^"]*\bmc-options\b[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi;

  const itemOptions: string[][] = [];
  let ulMatch: RegExpExecArray | null;
  while ((ulMatch = ulRegex.exec(mcHtml)) !== null) {
    const inner = ulMatch[1];
    const optionLetterRegex = /<li\b[^>]*>\s*([A-Za-z])\s*[.):\-]/g;
    const letters: string[] = [];
    let optMatch: RegExpExecArray | null;
    while ((optMatch = optionLetterRegex.exec(inner)) !== null) {
      letters.push(optMatch[1].toUpperCase());
    }
    itemOptions.push(letters);
  }

  if (itemOptions.length !== answers.length) {
    throw new TgParseError(
      sectionKey,
      `multipleChoice has ${answers.length} answer(s) but the workbook HTML has ${itemOptions.length} multiple choice item(s)`,
    );
  }

  answers.forEach((answer, i) => {
    const letters = itemOptions[i];
    if (!letters.includes(answer.correctLetter)) {
      throw new TgParseError(
        sectionKey,
        `multipleChoice[${i}].correctLetter "${answer.correctLetter}" is not one of the options in the workbook HTML for this question (found: ${letters.join(", ") || "none"})`,
      );
    }
  });
}

/**
 * Cross-checks the question text in the parsed answers JSON against the
 * question text actually rendered in the workbook HTML for all five core
 * sections (think_about_the_story, reading_between_the_lines, dig_deeper,
 * multiple_choice_questions, evidence_from_the_story).
 *
 * Claude is told to copy each question verbatim from the HTML into the answers
 * JSON, but it can paraphrase, reorder, or drop items. Because the answer key
 * (and the MC letter validator) pair questions and answers by index, any
 * mismatch silently lines up the wrong question with the wrong answer. This
 * validator catches that immediately and fails generation loudly with the
 * offending section, index, and a snippet of both texts.
 *
 * Matching is by index after normalizing whitespace (trim + collapse runs of
 * whitespace) and stripping any inner HTML tags from the workbook side.
 */
export function validateAnswerKeyQuestionsMatchHtml(
  coreQuestions: ParsedCoreQuestions,
  answers: {
    thinkAboutTheStory: Pick<ThinkAboutTheStoryAnswersData, "answers">;
    answerKey: Pick<
      AnswerKeyData,
      "readingBetweenTheLines" | "digDeeper" | "multipleChoice" | "evidenceFromTheStory"
    >;
  },
): void {
  const sectionKey = "answer_key";
  const checks: ReadonlyArray<{
    label: string;
    htmlField: keyof ParsedCoreQuestions;
    jsonQuestions: string[];
  }> = [
    {
      label: "thinkAboutTheStory",
      htmlField: "think_about_the_story",
      jsonQuestions: answers.thinkAboutTheStory.answers.map((a) => a.question),
    },
    {
      label: "readingBetweenTheLines",
      htmlField: "reading_between_the_lines",
      jsonQuestions: answers.answerKey.readingBetweenTheLines.map((a) => a.question),
    },
    {
      label: "digDeeper",
      htmlField: "dig_deeper",
      jsonQuestions: answers.answerKey.digDeeper.map((a) => a.question),
    },
    {
      label: "multipleChoice",
      htmlField: "multiple_choice_questions",
      jsonQuestions: answers.answerKey.multipleChoice.map((a) => a.question),
    },
    {
      label: "evidenceFromTheStory",
      htmlField: "evidence_from_the_story",
      jsonQuestions: answers.answerKey.evidenceFromTheStory.map((a) => a.question),
    },
  ];

  for (const { label, htmlField, jsonQuestions } of checks) {
    const htmlQuestions = extractQuestionTextsFromHtml(coreQuestions[htmlField]);
    if (htmlQuestions.length !== jsonQuestions.length) {
      throw new TgParseError(
        sectionKey,
        `${label} has ${jsonQuestions.length} answer(s) but the workbook HTML has ${htmlQuestions.length} question(s). Counts must match so answers and questions pair by index.`,
      );
    }
    for (let i = 0; i < htmlQuestions.length; i += 1) {
      const htmlNorm = normalizeQuestionText(htmlQuestions[i]);
      const jsonNorm = normalizeQuestionText(jsonQuestions[i]);
      if (htmlNorm !== jsonNorm) {
        throw new TgParseError(
          sectionKey,
          `${label}[${i}] question text does not match the workbook HTML. ` +
            `Workbook: "${truncateForError(htmlQuestions[i])}". ` +
            `Answers JSON: "${truncateForError(jsonQuestions[i])}". ` +
            `Claude must copy each question verbatim from the HTML into the answers JSON.`,
        );
      }
    }
  }
}

function extractQuestionTextsFromHtml(coreQuestionHtml: string): string[] {
  const questions: string[] = [];
  const pattern = /<div class="question">([\s\S]*?)<\/div>/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(coreQuestionHtml)) !== null) {
    const text = match[1].replace(/<[^>]+>/g, "").trim();
    if (text) questions.push(text);
  }
  return questions;
}

function normalizeQuestionText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncateForError(value: string): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  return collapsed.length > 120 ? `${collapsed.slice(0, 117)}...` : collapsed;
}

export function parseAnswerKey(raw: string): AnswerKeyData {
  const sectionKey = "answer_key";
  const data = parseJson(sectionKey, raw);
  const root = asObject(sectionKey, data, "(root)");

  const readingBetweenTheLines = asArray(
    sectionKey,
    root.readingBetweenTheLines,
    "readingBetweenTheLines",
  ).map((item, i) => parseQuestionAnswer(sectionKey, item, `readingBetweenTheLines[${i}]`));

  const digDeeper = asArray(sectionKey, root.digDeeper, "digDeeper").map((item, i) =>
    parseQuestionAnswer(sectionKey, item, `digDeeper[${i}]`),
  );

  const multipleChoice = asArray(sectionKey, root.multipleChoice, "multipleChoice").map(
    (item, i): MultipleChoiceAnswer => {
      const obj = asObject(sectionKey, item, `multipleChoice[${i}]`);
      const letter = asString(sectionKey, obj.correctLetter, `multipleChoice[${i}].correctLetter`);
      if (!MC_LETTERS.includes(letter as (typeof MC_LETTERS)[number])) {
        throw new TgParseError(
          sectionKey,
          `multipleChoice[${i}].correctLetter must be A/B/C/D (got "${letter}")`,
        );
      }
      return {
        question: asString(sectionKey, obj.question, `multipleChoice[${i}].question`),
        correctLetter: letter as MultipleChoiceAnswer["correctLetter"],
        rationale: asString(sectionKey, obj.rationale, `multipleChoice[${i}].rationale`),
      };
    },
  );

  const evidenceFromTheStory = asArray(
    sectionKey,
    root.evidenceFromTheStory,
    "evidenceFromTheStory",
  ).map((item, i): EvidenceAnswer => {
    const obj = asObject(sectionKey, item, `evidenceFromTheStory[${i}]`);
    return {
      question: asString(sectionKey, obj.question, `evidenceFromTheStory[${i}].question`),
      sampleAnswer: asString(sectionKey, obj.sampleAnswer, `evidenceFromTheStory[${i}].sampleAnswer`),
      quote: asString(sectionKey, obj.quote, `evidenceFromTheStory[${i}].quote`),
      page: asNumber(sectionKey, obj.page, `evidenceFromTheStory[${i}].page`),
    };
  });

  const characterChart = asArray(sectionKey, root.characterChart, "characterChart").map(
    (item, i): CharacterChartAnswer => {
      const obj = asObject(sectionKey, item, `characterChart[${i}]`);
      return {
        characterName: asString(sectionKey, obj.characterName, `characterChart[${i}].characterName`),
        description: asString(sectionKey, obj.description, `characterChart[${i}].description`),
        whatThisShows: asString(sectionKey, obj.whatThisShows, `characterChart[${i}].whatThisShows`),
        quote: asString(sectionKey, obj.quote, `characterChart[${i}].quote`),
        page: asNumber(sectionKey, obj.page, `characterChart[${i}].page`),
      };
    },
  );

  const drawItDetails = asStringArray(sectionKey, root.drawItDetails, "drawItDetails");

  const bonusChallenge =
    root.bonusChallenge === undefined || root.bonusChallenge === null
      ? undefined
      : asStringArray(sectionKey, root.bonusChallenge, "bonusChallenge");

  return {
    readingBetweenTheLines,
    digDeeper,
    multipleChoice,
    evidenceFromTheStory,
    characterChart,
    drawItDetails,
    bonusChallenge,
  };
}
