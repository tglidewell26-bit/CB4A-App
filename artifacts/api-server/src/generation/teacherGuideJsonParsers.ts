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
  MeasurableObjectivesData,
  MultipleChoiceAnswer,
  QuestionAnswer,
  QuestionType,
  StandardsData,
  SupportPhases,
  ThinkAboutTheStoryAnswersData,
  WordsToKnowMiniLessonData,
} from "./teacherGuideTypes.js";

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

  return {
    readingBetweenTheLines,
    digDeeper,
    multipleChoice,
    evidenceFromTheStory,
    characterChart,
    drawItDetails,
  };
}
