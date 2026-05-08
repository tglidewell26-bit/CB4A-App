/**
 * Unit tests verifying that questions and answers are populated correctly in
 * generated content.
 *
 * Covers:
 * - extractFocusQuestionText (studentWorkbook.ts) — parses get_ready_to_read HTML
 * - extractQuestionTexts (teacherGuide.ts) — extracts numbered question text
 *   from core question section HTML (ol > li > div.question)
 * - workbookContextForTeacherSection (teacherGuide.ts) — confirms that:
 *   - words_to_know_mini_lesson passes the wordsToKnow slice
 *   - think_about_the_story_answers returns a numbered TATS question list
 *   - answer_key returns numbered RBTL + Dig Deeper question lists
 */
import { describe, it, expect } from "vitest";
import { extractFocusQuestionText } from "../studentWorkbook.js";
import { extractQuestionTexts, workbookContextForTeacherSection } from "../teacherGuide.js";
import type { ParsedCoreQuestions } from "../../prompts/workbookSectionPrompts.js";

// ---------------------------------------------------------------------------
// Shared HTML fixtures
// ---------------------------------------------------------------------------

const FOCUS_QUESTION_HTML_NORMAL = `
<div class="get-ready">
  <div class="focus-question">
    <p>What challenges might Heidi face when she meets her grandfather?</p>
  </div>
  <div class="answer-space"></div>
</div>`.trim();

const FOCUS_QUESTION_HTML_WITH_INNER_TAGS = `
<div class="focus-question">
  <p><em>Why</em> does Heidi remove her <strong>extra clothes</strong> on the way up?</p>
</div>`.trim();

const FOCUS_QUESTION_HTML_MISSING_P = `
<div class="focus-question">
  What will Heidi discover at the top of the mountain?
</div>`.trim();

const FOCUS_QUESTION_HTML_NO_DIV = `
<div class="some-other-section">
  <p>This is not a focus question paragraph.</p>
</div>`.trim();

const TATS_HTML = `
<ol class="question-list">
  <li class="question-item">
    <div class="question">How old is Heidi at the start of the chapter?</div>
    <div class="answer-space"></div>
    <div class="answer-space"></div>
  </li>
  <li class="question-item">
    <div class="question">Who is taking Heidi up the mountain?</div>
    <div class="answer-space"></div>
    <div class="answer-space"></div>
  </li>
  <li class="question-item">
    <div class="question">What does Heidi remove while traveling up the mountain?</div>
    <div class="answer-space"></div>
    <div class="answer-space"></div>
  </li>
  <li class="question-item">
    <div class="question">What is Deta's job in the village?</div>
    <div class="answer-space"></div>
    <div class="answer-space"></div>
  </li>
  <li class="question-item">
    <div class="question">What does Heidi say when Deta asks if she is tired?</div>
    <div class="answer-space"></div>
    <div class="answer-space"></div>
  </li>
  <li class="question-item">
    <div class="question">Where does Deta plan to go after leaving Heidi with Grandfather?</div>
    <div class="answer-space"></div>
    <div class="answer-space"></div>
  </li>
</ol>`.trim();

const RBTL_HTML = `
<ol class="question-list">
  <li class="question-item">
    <div class="question">Why might Heidi feel nervous when she first sees Grandfather?</div>
    <div class="answer-space"></div>
    <div class="answer-space"></div>
  </li>
  <li class="question-item">
    <div class="question">What clues show that Heidi is excited rather than afraid of the mountain?</div>
    <div class="answer-space"></div>
    <div class="answer-space"></div>
  </li>
  <li class="question-item">
    <div class="question">Why does Deta's nervousness suggest she is unsure about her decision?</div>
    <div class="answer-space"></div>
    <div class="answer-space"></div>
  </li>
</ol>`.trim();

const DIG_DEEPER_HTML = `
<ol class="question-list">
  <li class="question-item">
    <div class="question">How does Heidi's journey up the mountain show a change in how she feels about her new life?</div>
    <div class="answer-space"></div>
    <div class="answer-space"></div>
  </li>
  <li class="question-item">
    <div class="question">Compare how Deta and the villagers describe Grandfather — what does this reveal about rumors?</div>
    <div class="answer-space"></div>
    <div class="answer-space"></div>
  </li>
  <li class="question-item">
    <div class="question">What does this chapter suggest about children's ability to adapt to difficult changes?</div>
    <div class="answer-space"></div>
    <div class="answer-space"></div>
  </li>
</ol>`.trim();

const QUESTION_HTML_WITH_INNER_TAGS = `
<ol class="question-list">
  <li class="question-item">
    <div class="question">Why does <em>Heidi</em> remove her <strong>coat</strong>?</div>
    <div class="answer-space"></div>
  </li>
</ol>`.trim();

/** Minimal ParsedCoreQuestions used in workbookContextForTeacherSection tests. */
const MOCK_CORE_QUESTIONS: ParsedCoreQuestions = {
  think_about_the_story: TATS_HTML,
  reading_between_the_lines: RBTL_HTML,
  dig_deeper: DIG_DEEPER_HTML,
  multiple_choice_questions: `<div class="mc-item"><div class="question">Who takes Heidi up the mountain?</div><ul class="mc-options"><li>A. Grandfather</li><li>B. Deta</li></ul></div>`,
  evidence_from_the_story: `<ol class="question-list"><li class="question-item"><div class="question">Find evidence that Heidi enjoys nature.</div></li></ol>`,
};

const MOCK_SLICES = {
  wordsToKnow: "<ul><li>scrambled — She scrambled up the path.</li></ul>",
  coreQuestions: MOCK_CORE_QUESTIONS,
};

// ---------------------------------------------------------------------------
// extractFocusQuestionText
// ---------------------------------------------------------------------------

describe("extractFocusQuestionText", () => {
  it("extracts plain-text question from a well-formed focus-question div", () => {
    const result = extractFocusQuestionText(FOCUS_QUESTION_HTML_NORMAL);
    expect(result).toBe("What challenges might Heidi face when she meets her grandfather?");
  });

  it("strips inner HTML tags from the <p> content", () => {
    const result = extractFocusQuestionText(FOCUS_QUESTION_HTML_WITH_INNER_TAGS);
    expect(result).toBe("Why does Heidi remove her extra clothes on the way up?");
    expect(result).not.toContain("<em>");
    expect(result).not.toContain("<strong>");
  });

  it("returns empty string when the focus-question div lacks a <p> tag", () => {
    const result = extractFocusQuestionText(FOCUS_QUESTION_HTML_MISSING_P);
    expect(result).toBe("");
  });

  it("returns empty string when there is no focus-question div at all", () => {
    const result = extractFocusQuestionText(FOCUS_QUESTION_HTML_NO_DIV);
    expect(result).toBe("");
  });

  it("returns empty string for an empty input string", () => {
    const result = extractFocusQuestionText("");
    expect(result).toBe("");
  });

  it("returns empty string for completely malformed HTML", () => {
    const result = extractFocusQuestionText("<<<not html at all>>>");
    expect(result).toBe("");
  });

  it("handles whitespace around the <p> content correctly (trims result)", () => {
    const html = `<div class="focus-question"><p>  What is Heidi's dream?  </p></div>`;
    const result = extractFocusQuestionText(html);
    expect(result).toBe("What is Heidi's dream?");
  });
});

// ---------------------------------------------------------------------------
// extractQuestionTexts
// ---------------------------------------------------------------------------

describe("extractQuestionTexts", () => {
  it("extracts all 6 think_about_the_story question strings in order", () => {
    const result = extractQuestionTexts(TATS_HTML);
    expect(result).toHaveLength(6);
    expect(result[0]).toBe("How old is Heidi at the start of the chapter?");
    expect(result[1]).toBe("Who is taking Heidi up the mountain?");
    expect(result[2]).toBe("What does Heidi remove while traveling up the mountain?");
    expect(result[3]).toBe("What is Deta's job in the village?");
    expect(result[4]).toBe("What does Heidi say when Deta asks if she is tired?");
    expect(result[5]).toBe("Where does Deta plan to go after leaving Heidi with Grandfather?");
  });

  it("extracts all 3 reading_between_the_lines question strings in order", () => {
    const result = extractQuestionTexts(RBTL_HTML);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe("Why might Heidi feel nervous when she first sees Grandfather?");
    expect(result[1]).toBe("What clues show that Heidi is excited rather than afraid of the mountain?");
    expect(result[2]).toBe("Why does Deta's nervousness suggest she is unsure about her decision?");
  });

  it("extracts all 3 dig_deeper question strings in order", () => {
    const result = extractQuestionTexts(DIG_DEEPER_HTML);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe(
      "How does Heidi's journey up the mountain show a change in how she feels about her new life?",
    );
    expect(result[1]).toBe(
      "Compare how Deta and the villagers describe Grandfather — what does this reveal about rumors?",
    );
    expect(result[2]).toBe(
      "What does this chapter suggest about children's ability to adapt to difficult changes?",
    );
  });

  it("strips inner HTML tags from question text", () => {
    const result = extractQuestionTexts(QUESTION_HTML_WITH_INNER_TAGS);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("Why does Heidi remove her coat?");
    expect(result[0]).not.toContain("<em>");
    expect(result[0]).not.toContain("<strong>");
  });

  it("returns an empty array for an empty HTML string", () => {
    const result = extractQuestionTexts("");
    expect(result).toEqual([]);
  });

  it("returns an empty array when the HTML contains no question divs", () => {
    const html = `<ol class="question-list"><li class="question-item"><div class="answer-space"></div></li></ol>`;
    const result = extractQuestionTexts(html);
    expect(result).toEqual([]);
  });

  it("returns an empty array for malformed / non-HTML input", () => {
    const result = extractQuestionTexts("just some plain text with no tags");
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// workbookContextForTeacherSection
// ---------------------------------------------------------------------------

describe("workbookContextForTeacherSection", () => {
  it("returns wordsToKnow slice for words_to_know_mini_lesson", () => {
    const ctx = workbookContextForTeacherSection("words_to_know_mini_lesson", MOCK_SLICES);
    expect(ctx).toHaveProperty("wordsToKnow");
    expect(ctx.wordsToKnow).toContain("scrambled");
  });

  describe("think_about_the_story_answers — returns numbered TATS question list", () => {
    it("returns a thinkAboutTheStoryQuestions key", () => {
      const ctx = workbookContextForTeacherSection("think_about_the_story_answers", MOCK_SLICES);
      expect(ctx).toHaveProperty("thinkAboutTheStoryQuestions");
    });

    it("contains all 6 TATS questions in numbered format", () => {
      const ctx = workbookContextForTeacherSection("think_about_the_story_answers", MOCK_SLICES);
      const q = ctx.thinkAboutTheStoryQuestions;
      expect(q).toContain("1. How old is Heidi at the start of the chapter?");
      expect(q).toContain("2. Who is taking Heidi up the mountain?");
      expect(q).toContain("6. Where does Deta plan to go after leaving Heidi with Grandfather?");
    });

    it("formats questions as a newline-separated numbered list", () => {
      const ctx = workbookContextForTeacherSection("think_about_the_story_answers", MOCK_SLICES);
      const lines = ctx.thinkAboutTheStoryQuestions.split("\n");
      expect(lines).toHaveLength(6);
      expect(lines[0]).toMatch(/^1\. /);
      expect(lines[5]).toMatch(/^6\. /);
    });

    it("does not contain RBTL or Dig Deeper questions", () => {
      const ctx = workbookContextForTeacherSection("think_about_the_story_answers", MOCK_SLICES);
      const q = ctx.thinkAboutTheStoryQuestions;
      expect(q).not.toContain("Why might Heidi feel nervous");
      expect(q).not.toContain("Compare how Deta");
    });
  });

  describe("answer_key — returns numbered RBTL and Dig Deeper question lists", () => {
    it("returns readingBetweenTheLinesQuestions and digDeeperQuestions keys", () => {
      const ctx = workbookContextForTeacherSection("answer_key", MOCK_SLICES);
      expect(ctx).toHaveProperty("readingBetweenTheLinesQuestions");
      expect(ctx).toHaveProperty("digDeeperQuestions");
    });

    it("readingBetweenTheLinesQuestions contains all 3 RBTL questions numbered", () => {
      const ctx = workbookContextForTeacherSection("answer_key", MOCK_SLICES);
      const q = ctx.readingBetweenTheLinesQuestions;
      expect(q).toContain("1. Why might Heidi feel nervous when she first sees Grandfather?");
      expect(q).toContain("2. What clues show that Heidi is excited rather than afraid of the mountain?");
      expect(q).toContain("3. Why does Deta's nervousness suggest she is unsure about her decision?");
    });

    it("digDeeperQuestions contains all 3 Dig Deeper questions numbered", () => {
      const ctx = workbookContextForTeacherSection("answer_key", MOCK_SLICES);
      const q = ctx.digDeeperQuestions;
      expect(q).toContain("1. How does Heidi's journey up the mountain show a change in how she feels about her new life?");
      expect(q).toContain("2. Compare how Deta and the villagers describe Grandfather — what does this reveal about rumors?");
      expect(q).toContain("3. What does this chapter suggest about children's ability to adapt to difficult changes?");
    });

    it("formats RBTL questions as a 3-line numbered list", () => {
      const ctx = workbookContextForTeacherSection("answer_key", MOCK_SLICES);
      const lines = ctx.readingBetweenTheLinesQuestions.split("\n");
      expect(lines).toHaveLength(3);
      expect(lines[0]).toMatch(/^1\. /);
      expect(lines[2]).toMatch(/^3\. /);
    });

    it("formats Dig Deeper questions as a 3-line numbered list", () => {
      const ctx = workbookContextForTeacherSection("answer_key", MOCK_SLICES);
      const lines = ctx.digDeeperQuestions.split("\n");
      expect(lines).toHaveLength(3);
      expect(lines[0]).toMatch(/^1\. /);
      expect(lines[2]).toMatch(/^3\. /);
    });

    it("does not mix TATS questions into the answer_key context", () => {
      const ctx = workbookContextForTeacherSection("answer_key", MOCK_SLICES);
      expect(ctx).not.toHaveProperty("thinkAboutTheStoryQuestions");
      const combined = Object.values(ctx).join(" ");
      expect(combined).not.toContain("How old is Heidi at the start of the chapter?");
    });
  });

  it("returns empty context for guided_reading (calls Claude directly, no question context)", () => {
    const ctx = workbookContextForTeacherSection("guided_reading", MOCK_SLICES);
    expect(ctx).toEqual({});
  });

  it("returns empty context for measurable_objectives", () => {
    const ctx = workbookContextForTeacherSection("measurable_objectives", MOCK_SLICES);
    expect(ctx).toEqual({});
  });

  it("returns empty context for unknown section keys", () => {
    const ctx = workbookContextForTeacherSection("nonexistent_section", MOCK_SLICES);
    expect(ctx).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Integration: extractQuestionTexts count alignment with expected answers
// ---------------------------------------------------------------------------

describe("question count alignment between HTML and answers", () => {
  it("TATS HTML produces 6 questions matching the required answers count", () => {
    const questions = extractQuestionTexts(TATS_HTML);
    expect(questions).toHaveLength(6);
  });

  it("RBTL HTML produces 3 questions matching the required answers count", () => {
    const questions = extractQuestionTexts(RBTL_HTML);
    expect(questions).toHaveLength(3);
  });

  it("Dig Deeper HTML produces 3 questions matching the required answers count", () => {
    const questions = extractQuestionTexts(DIG_DEEPER_HTML);
    expect(questions).toHaveLength(3);
  });

  it("question texts from TATS HTML are non-empty strings", () => {
    const questions = extractQuestionTexts(TATS_HTML);
    for (const q of questions) {
      expect(typeof q).toBe("string");
      expect(q.length).toBeGreaterThan(0);
    }
  });

  it("question texts from RBTL HTML are non-empty strings", () => {
    const questions = extractQuestionTexts(RBTL_HTML);
    for (const q of questions) {
      expect(typeof q).toBe("string");
      expect(q.length).toBeGreaterThan(0);
    }
  });

  it("numbered context from think_about_the_story_answers covers all TATS question texts", () => {
    const ctx = workbookContextForTeacherSection("think_about_the_story_answers", MOCK_SLICES);
    const rawQuestions = extractQuestionTexts(TATS_HTML);
    for (const q of rawQuestions) {
      expect(ctx.thinkAboutTheStoryQuestions).toContain(q);
    }
  });

  it("numbered context from answer_key covers all RBTL and DD question texts", () => {
    const ctx = workbookContextForTeacherSection("answer_key", MOCK_SLICES);
    for (const q of extractQuestionTexts(RBTL_HTML)) {
      expect(ctx.readingBetweenTheLinesQuestions).toContain(q);
    }
    for (const q of extractQuestionTexts(DIG_DEEPER_HTML)) {
      expect(ctx.digDeeperQuestions).toContain(q);
    }
  });
});
