import { describe, it, expect } from "vitest";

import {
  buildCoreQuestionsCombinedSystemPrompt,
  buildCoreQuestionsCombinedUserPrompt,
  parseCoreQuestionsResponse,
  CORE_QUESTION_EXAMPLES,
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
