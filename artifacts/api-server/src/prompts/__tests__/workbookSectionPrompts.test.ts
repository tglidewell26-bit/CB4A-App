import { describe, it, expect } from "vitest";

import {
  buildCoreQuestionsCombinedSystemPrompt,
  buildCoreQuestionsCombinedUserPrompt,
  parseCoreQuestionsResponse,
  CORE_QUESTION_EXAMPLES,
  GRADE_QUESTION_EXAMPLES,
  getGradeQuestionExamples,
  ANSWERS_JSON_DELIMITER,
  type CoreQuestionsPromptInputs,
} from "../workbookSectionPrompts.js";

const TATS_DELIM = "<!-- SECTION:think_about_the_story -->";
const RBTL_DELIM = "<!-- SECTION:reading_between_the_lines -->";
const DD_DELIM = "<!-- SECTION:dig_deeper -->";
const MC_DELIM = "<!-- SECTION:multiple_choice_questions -->";
const ETS_DELIM = "<!-- SECTION:evidence_from_the_story -->";
const ANSWERS_JSON_DELIM = ANSWERS_JSON_DELIMITER;

const MINIMAL_ANSWERS_JSON = JSON.stringify({
  thinkAboutTheStory: {
    answers: [],
    inferentialPrompts: [],
    tieredDiscussion: { literal: [], inference: [], analysis: [], evaluation: [] },
    analyticalThinking: [],
    personalConnection: [],
  },
  readingBetweenTheLines: [],
  digDeeper: [],
  multipleChoice: [],
  evidenceFromTheStory: [],
  characterChart: [],
  drawItDetails: [],
});

/** Builds a well-formed raw response string with all six delimiters. */
function makeRaw({
  tats = "tats-body",
  rbtl = "rbtl-body",
  dd = "dd-body",
  mc = "mc-body",
  ets = "ets-body",
  answers = MINIMAL_ANSWERS_JSON,
} = {}): string {
  return `${TATS_DELIM}\n${tats}\n${RBTL_DELIM}\n${rbtl}\n${DD_DELIM}\n${dd}\n${MC_DELIM}\n${mc}\n${ETS_DELIM}\n${ets}\n${ANSWERS_JSON_DELIM}\n${answers}`;
}

const baseInputs: CoreQuestionsPromptInputs = {
  bookTitle: "Test Book",
  author: "Test Author",
  chapterLabel: "Chapter 1",
  pages: "1-10",
  grade: 5,
  vocabulary: [
    { word: "ancient", book_quote: "the ancient wall", page_number: 1 } as never,
  ],
  chapterText: "Once upon a time, there was an ancient wall.",
};

describe("buildCoreQuestionsCombinedSystemPrompt", () => {
  it("includes all five HTML section delimiters and the answers_json delimiter", () => {
    const prompt = buildCoreQuestionsCombinedSystemPrompt(baseInputs);
    expect(prompt).toContain(TATS_DELIM);
    expect(prompt).toContain(RBTL_DELIM);
    expect(prompt).toContain(DD_DELIM);
    expect(prompt).toContain(MC_DELIM);
    expect(prompt).toContain(ETS_DELIM);
    expect(prompt).toContain(ANSWERS_JSON_DELIM);
  });

  it("includes the 'do not copy' instruction for example questions", () => {
    const prompt = buildCoreQuestionsCombinedSystemPrompt(baseInputs);
    expect(prompt).toContain("Do NOT copy them");
    expect(prompt).toContain("Do NOT adapt them");
  });

  it("embeds every example question for all three style-reference sections", () => {
    const prompt = buildCoreQuestionsCombinedSystemPrompt(baseInputs);
    for (const ex of CORE_QUESTION_EXAMPLES.think_about_the_story) {
      expect(prompt).toContain(ex);
    }
    for (const ex of CORE_QUESTION_EXAMPLES.reading_between_the_lines) {
      expect(prompt).toContain(ex);
    }
    for (const ex of CORE_QUESTION_EXAMPLES.dig_deeper) {
      expect(prompt).toContain(ex);
    }
  });

  it("embeds the wording-guide starter phrases for each section", () => {
    const prompt = buildCoreQuestionsCombinedSystemPrompt(baseInputs);
    for (const starter of CORE_QUESTION_EXAMPLES.wordingGuide.think_about_the_story) {
      expect(prompt).toContain(starter);
    }
    for (const starter of CORE_QUESTION_EXAMPLES.wordingGuide.reading_between_the_lines) {
      expect(prompt).toContain(starter);
    }
    for (const starter of CORE_QUESTION_EXAMPLES.wordingGuide.dig_deeper) {
      expect(prompt).toContain(starter);
    }
  });

  it("includes instructions for the Multiple Choice Questions section", () => {
    const prompt = buildCoreQuestionsCombinedSystemPrompt(baseInputs);
    expect(prompt).toContain("Multiple Choice Questions (APPLICATION) — exactly 3 questions");
    expect(prompt).toContain("mc-item");
  });

  it("includes instructions for the Evidence From the Story section", () => {
    const prompt = buildCoreQuestionsCombinedSystemPrompt(baseInputs);
    expect(prompt).toContain("Evidence From the Story (QUOTATION EVIDENCE) — exactly 3 questions");
  });

  it("includes answers JSON schema field names in the prompt", () => {
    const prompt = buildCoreQuestionsCombinedSystemPrompt(baseInputs);
    expect(prompt).toContain("thinkAboutTheStory");
    expect(prompt).toContain("correctLetter");
    expect(prompt).toContain("characterChart");
    expect(prompt).toContain("drawItDetails");
  });
});

describe("getGradeQuestionExamples", () => {
  it.each([3, 4, 5, 6, 7, 8] as const)("returns the exact-grade examples for grade %i", (grade) => {
    for (const sectionKey of [
      "think_about_the_story",
      "reading_between_the_lines",
      "dig_deeper",
    ] as const) {
      expect(getGradeQuestionExamples(grade, sectionKey)).toBe(
        GRADE_QUESTION_EXAMPLES[grade][sectionKey],
      );
    }
  });

  it("clamps below-range grades up to grade 3", () => {
    expect(getGradeQuestionExamples(1, "think_about_the_story")).toBe(
      GRADE_QUESTION_EXAMPLES[3].think_about_the_story,
    );
  });

  it("clamps above-range grades down to grade 8", () => {
    expect(getGradeQuestionExamples(12, "dig_deeper")).toBe(
      GRADE_QUESTION_EXAMPLES[8].dig_deeper,
    );
  });
});

describe("buildCoreQuestionsCombinedSystemPrompt — grade-specific examples", () => {
  it.each([3, 5, 8] as const)("embeds Grade %i examples for all three core sections", (grade) => {
    const prompt = buildCoreQuestionsCombinedSystemPrompt({ ...baseInputs, grade });
    for (const sectionKey of [
      "think_about_the_story",
      "reading_between_the_lines",
      "dig_deeper",
    ] as const) {
      for (const example of GRADE_QUESTION_EXAMPLES[grade][sectionKey]) {
        expect(prompt).toContain(example);
      }
    }
    expect(prompt).toContain(`Grade ${grade} examples — Think About the Story`);
    expect(prompt).toContain(`Grade ${grade} examples — Reading Between the Lines`);
    expect(prompt).toContain(`Grade ${grade} examples — Dig Deeper`);
  });

  it("does not leak other grades' examples into the prompt for grade 5", () => {
    const prompt = buildCoreQuestionsCombinedSystemPrompt({ ...baseInputs, grade: 5 });
    expect(prompt).toContain(GRADE_QUESTION_EXAMPLES[5].think_about_the_story[0]);
    // A grade-3-only example phrasing should NOT appear in the grade-5 prompt
    expect(prompt).not.toContain("What does Heidi take off while climbing?");
    // A grade-8-only example phrasing should NOT appear in the grade-5 prompt
    expect(prompt).not.toContain("What details describe Alm-Uncle's hut and its surroundings?");
  });

  it("includes the grade-level modeling instruction", () => {
    const prompt = buildCoreQuestionsCombinedSystemPrompt(baseInputs);
    expect(prompt).toContain(
      "Use these examples as grade-level and section-style models. Match their clarity, difficulty, sentence length, and question style. Write fresh questions using only the provided chapter.",
    );
  });

  it("still includes the existing per-section format/length rules", () => {
    const prompt = buildCoreQuestionsCombinedSystemPrompt(baseInputs);
    expect(prompt).toContain("Think About the Story (LITERAL recall) — exactly 6 questions");
    expect(prompt).toContain("Reading Between the Lines (INFERENCE) — exactly 3 questions");
    expect(prompt).toContain("Dig Deeper (ANALYSIS) — exactly 3 questions");
    expect(prompt).toContain("ONE sentence under 22 words");
  });
});

describe("buildCoreQuestionsCombinedUserPrompt", () => {
  it("includes the book metadata and chapter text", () => {
    const prompt = buildCoreQuestionsCombinedUserPrompt(baseInputs);
    expect(prompt).toContain("Test Book");
    expect(prompt).toContain("Test Author");
    expect(prompt).toContain("Chapter 1");
    expect(prompt).toContain("ancient wall");
  });
});

describe("parseCoreQuestionsResponse", () => {
  it("splits a well-formed response into five HTML blocks plus raw answers JSON", () => {
    const raw = makeRaw();
    const parsed = parseCoreQuestionsResponse(raw);
    expect(parsed.questions.think_about_the_story).toBe("tats-body");
    expect(parsed.questions.reading_between_the_lines).toBe("rbtl-body");
    expect(parsed.questions.dig_deeper).toBe("dd-body");
    expect(parsed.questions.multiple_choice_questions).toBe("mc-body");
    expect(parsed.questions.evidence_from_the_story).toBe("ets-body");
    expect(parsed.answersJsonRaw).toBe(MINIMAL_ANSWERS_JSON);
  });

  it("throws when the think_about_the_story delimiter is missing", () => {
    const raw = `${RBTL_DELIM}\nrbtl\n${DD_DELIM}\ndd\n${MC_DELIM}\nmc\n${ETS_DELIM}\nets\n${ANSWERS_JSON_DELIM}\n{}`;
    expect(() => parseCoreQuestionsResponse(raw)).toThrow(/think_about_the_story/);
  });

  it("throws when the reading_between_the_lines delimiter is missing", () => {
    const raw = `${TATS_DELIM}\ntats\n${DD_DELIM}\ndd\n${MC_DELIM}\nmc\n${ETS_DELIM}\nets\n${ANSWERS_JSON_DELIM}\n{}`;
    expect(() => parseCoreQuestionsResponse(raw)).toThrow(/reading_between_the_lines/);
  });

  it("throws when the dig_deeper delimiter is missing", () => {
    const raw = `${TATS_DELIM}\ntats\n${RBTL_DELIM}\nrbtl\n${MC_DELIM}\nmc\n${ETS_DELIM}\nets\n${ANSWERS_JSON_DELIM}\n{}`;
    expect(() => parseCoreQuestionsResponse(raw)).toThrow(/dig_deeper/);
  });

  it("throws when the multiple_choice_questions delimiter is missing", () => {
    const raw = `${TATS_DELIM}\ntats\n${RBTL_DELIM}\nrbtl\n${DD_DELIM}\ndd\n${ETS_DELIM}\nets\n${ANSWERS_JSON_DELIM}\n{}`;
    expect(() => parseCoreQuestionsResponse(raw)).toThrow(/multiple_choice_questions/);
  });

  it("throws when the evidence_from_the_story delimiter is missing", () => {
    const raw = `${TATS_DELIM}\ntats\n${RBTL_DELIM}\nrbtl\n${DD_DELIM}\ndd\n${MC_DELIM}\nmc\n${ANSWERS_JSON_DELIM}\n{}`;
    expect(() => parseCoreQuestionsResponse(raw)).toThrow(/evidence_from_the_story/);
  });

  it("throws when the answers_json delimiter is missing", () => {
    const raw = `${TATS_DELIM}\ntats\n${RBTL_DELIM}\nrbtl\n${DD_DELIM}\ndd\n${MC_DELIM}\nmc\n${ETS_DELIM}\nets`;
    expect(() => parseCoreQuestionsResponse(raw)).toThrow(/answers_json/);
  });

  it("throws when delimiters appear out of order (RBTL before TATS)", () => {
    const raw = `${RBTL_DELIM}\nrbtl\n${TATS_DELIM}\ntats\n${DD_DELIM}\ndd\n${MC_DELIM}\nmc\n${ETS_DELIM}\nets\n${ANSWERS_JSON_DELIM}\n{}`;
    expect(() => parseCoreQuestionsResponse(raw)).toThrow(/out of order/);
  });

  it("throws when delimiters appear out of order (DD before RBTL)", () => {
    const raw = `${TATS_DELIM}\ntats\n${DD_DELIM}\ndd\n${RBTL_DELIM}\nrbtl\n${MC_DELIM}\nmc\n${ETS_DELIM}\nets\n${ANSWERS_JSON_DELIM}\n{}`;
    expect(() => parseCoreQuestionsResponse(raw)).toThrow(/out of order/);
  });
});
