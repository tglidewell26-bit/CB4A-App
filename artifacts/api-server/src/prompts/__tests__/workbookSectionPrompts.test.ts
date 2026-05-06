import { describe, it, expect } from "vitest";

import {
  buildCoreQuestionsCombinedSystemPrompt,
  buildCoreQuestionsCombinedUserPrompt,
  parseCoreQuestionsResponse,
  CORE_QUESTION_EXAMPLES,
  GRADE_QUESTION_EXAMPLES,
  getGradeQuestionExamples,
  type CoreQuestionsPromptInputs,
} from "../workbookSectionPrompts.js";

const TATS_DELIM = "<!-- SECTION:think_about_the_story -->";
const RBTL_DELIM = "<!-- SECTION:reading_between_the_lines -->";
const DD_DELIM = "<!-- SECTION:dig_deeper -->";

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
  it("includes all three section delimiters", () => {
    const prompt = buildCoreQuestionsCombinedSystemPrompt(baseInputs);
    expect(prompt).toContain(TATS_DELIM);
    expect(prompt).toContain(RBTL_DELIM);
    expect(prompt).toContain(DD_DELIM);
  });

  it("includes the 'do not copy' instruction for example questions", () => {
    const prompt = buildCoreQuestionsCombinedSystemPrompt(baseInputs);
    expect(prompt).toContain("Do NOT copy them");
    expect(prompt).toContain("Do NOT adapt them");
  });

  it("embeds every example question for all three sections", () => {
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
  it("splits a well-formed response into three trimmed HTML blocks", () => {
    const raw = `${TATS_DELIM}\n<ol class="question-list"><li>TATS body</li></ol>\n${RBTL_DELIM}\n<ol class="question-list"><li>RBTL body</li></ol>\n${DD_DELIM}\n<ol class="question-list"><li>DD body</li></ol>\n`;
    const parsed = parseCoreQuestionsResponse(raw);
    expect(parsed.think_about_the_story).toBe(
      '<ol class="question-list"><li>TATS body</li></ol>',
    );
    expect(parsed.reading_between_the_lines).toBe(
      '<ol class="question-list"><li>RBTL body</li></ol>',
    );
    expect(parsed.dig_deeper).toBe(
      '<ol class="question-list"><li>DD body</li></ol>',
    );
  });

  it("throws when the think_about_the_story delimiter is missing", () => {
    const raw = `${RBTL_DELIM}\nrbtl\n${DD_DELIM}\ndd`;
    expect(() => parseCoreQuestionsResponse(raw)).toThrow(
      /think_about_the_story/,
    );
  });

  it("throws when the reading_between_the_lines delimiter is missing", () => {
    const raw = `${TATS_DELIM}\ntats\n${DD_DELIM}\ndd`;
    expect(() => parseCoreQuestionsResponse(raw)).toThrow(
      /reading_between_the_lines/,
    );
  });

  it("throws when the dig_deeper delimiter is missing", () => {
    const raw = `${TATS_DELIM}\ntats\n${RBTL_DELIM}\nrbtl`;
    expect(() => parseCoreQuestionsResponse(raw)).toThrow(/dig_deeper/);
  });

  it("throws when delimiters appear out of order (RBTL before TATS)", () => {
    const raw = `${RBTL_DELIM}\nrbtl\n${TATS_DELIM}\ntats\n${DD_DELIM}\ndd`;
    expect(() => parseCoreQuestionsResponse(raw)).toThrow(/out of order/);
  });

  it("throws when delimiters appear out of order (DD before RBTL)", () => {
    const raw = `${TATS_DELIM}\ntats\n${DD_DELIM}\ndd\n${RBTL_DELIM}\nrbtl`;
    expect(() => parseCoreQuestionsResponse(raw)).toThrow(/out of order/);
  });
});
