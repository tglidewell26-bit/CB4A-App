/**
 * Verifies that generateStudentWorkbook correctly captures the focusQuestion
 * from the get_ready_to_read LLM output and surfaces it in both
 * StudentWorkbookResult.focusQuestion and StudentWorkbookResult.answers.focusQuestion.
 *
 * The LLM is mocked so no real API calls are made. Mock responses are
 * ordered to match the exact sequence of anthropic.messages.create calls
 * that generateStudentWorkbook makes:
 *   1. Combined core questions (5 HTML sections + answers JSON)
 *   2. get_ready_to_read body HTML
 *   3. words_to_know body HTML
 *   4. creative_response body HTML (writing-prompt sentence)
 *   5. draw_it body HTML
 *   6. bonus_challenge body HTML
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../../ai/anthropic.js", () => ({
  anthropic: {
    messages: {
      create: vi.fn(),
    },
  },
  CLAUDE_MODEL: "claude-test",
}));

import { generateStudentWorkbook } from "../studentWorkbook.js";
import { anthropic } from "../../ai/anthropic.js";

// ---------------------------------------------------------------------------
// Mock response builders
// ---------------------------------------------------------------------------

function makeAnthropicResponse(text: string) {
  return { content: [{ type: "text", text }] };
}

/** Builds a valid combined core-questions response with 6 TATS, 3 RBTL, 3 DD, 3 MC, 3 ETS + answers JSON. */
const TATS_DELIM = "<!-- SECTION:think_about_the_story -->";
const RBTL_DELIM = "<!-- SECTION:reading_between_the_lines -->";
const DD_DELIM = "<!-- SECTION:dig_deeper -->";
const MC_DELIM = "<!-- SECTION:multiple_choice_questions -->";
const ETS_DELIM = "<!-- SECTION:evidence_from_the_story -->";
const ANSWERS_JSON_DELIM = "<!-- SECTION:answers_json -->";

const ANSWER_SPACE = '<div class="answer-space"></div>';

function makeQuestionItem(text: string, answerSpaces = 2): string {
  return `<li class="question-item"><div class="question">${text}</div>${Array(answerSpaces).fill(ANSWER_SPACE).join("")}</li>`;
}

const COMBINED_CORE_RESPONSE = `${TATS_DELIM}
<ol class="question-list">
${makeQuestionItem("Who takes Heidi up the mountain?")}
${makeQuestionItem("What does Heidi do with her extra clothes?")}
${makeQuestionItem("Where does Grandfather live?")}
${makeQuestionItem("What does Deta tell Peter about Grandfather?")}
${makeQuestionItem("When does Heidi first smile at Grandfather?")}
${makeQuestionItem("What animals does Peter tend?")}
</ol>
${RBTL_DELIM}
<ol class="question-list">
${makeQuestionItem("Why might Heidi feel nervous meeting Grandfather?")}
${makeQuestionItem("What clues show that Heidi is adventurous?")}
${makeQuestionItem("Why does Deta walk quickly up the path?")}
</ol>
${DD_DELIM}
<ol class="question-list">
${makeQuestionItem("How does the mountain symbolize Heidi's freedom?")}
${makeQuestionItem("Compare how Deta and the villagers view Grandfather.")}
${makeQuestionItem("What does this chapter suggest about adapting to change?")}
</ol>
${MC_DELIM}
<div class="mc-item"><div class="question">Who takes Heidi to Grandfather?</div><ul class="mc-options"><li>A. Grandfather</li><li>B. Deta</li><li>C. Peter</li><li>D. Grandmother</li></ul></div>
<div class="mc-item"><div class="question">What does Heidi remove on the way up?</div><ul class="mc-options"><li>A. Hat</li><li>B. Shoes</li><li>C. Coat</li><li>D. Dress</li></ul></div>
<div class="mc-item"><div class="question">Where does Grandfather live?</div><ul class="mc-options"><li>A. Village</li><li>B. Mountain</li><li>C. City</li><li>D. Farm</li></ul></div>
${ETS_DELIM}
<ol class="question-list">
${makeQuestionItem("Find evidence that Heidi enjoys the mountain.", 3)}
${makeQuestionItem("Find evidence of Deta's hurry.", 3)}
${makeQuestionItem("Find evidence that Grandfather is isolated.", 3)}
</ol>
${ANSWERS_JSON_DELIM}
${JSON.stringify({
  thinkAboutTheStory: {
    answers: [
      { question: "Who takes Heidi up the mountain?", answer: "Deta takes Heidi up the mountain.", page: 1 },
      { question: "What does Heidi do with her extra clothes?", answer: "She removes them.", page: 2 },
      { question: "Where does Grandfather live?", answer: "He lives on the mountain.", page: 3 },
      { question: "What does Deta tell Peter about Grandfather?", answer: "She says he is unsociable.", page: 4 },
      { question: "When does Heidi first smile at Grandfather?", answer: "When she sees the goats.", page: 5 },
      { question: "What animals does Peter tend?", answer: "He tends goats.", page: 6 },
    ],
    inferentialPrompts: ["Why might Heidi feel hopeful?", "What does this suggest about Heidi?"],
    tieredDiscussion: {
      literal: ["Who are the main characters?"],
      inference: ["Why might Deta be nervous?"],
      analysis: ["How does the setting reveal character?"],
      evaluation: ["Was Deta right to leave Heidi?"],
    },
    analyticalThinking: ["Consider how the mountain shapes Heidi.", "How does adapting show strength?"],
    personalConnection: ["Have you ever been in a new place?", "How did you feel?"],
  },
  readingBetweenTheLines: [
    { question: "Why might Heidi feel nervous meeting Grandfather?", answer: "Because he is feared.", page: 1 },
    { question: "What clues show that Heidi is adventurous?", answer: "She runs ahead freely.", page: 2 },
    { question: "Why does Deta walk quickly up the path?", answer: "She wants to leave soon.", page: 3 },
  ],
  digDeeper: [
    { question: "How does the mountain symbolize Heidi's freedom?", answer: "It represents escape.", page: 4 },
    { question: "Compare how Deta and the villagers view Grandfather.", answer: "Both fear him.", page: 5 },
    { question: "What does this chapter suggest about adapting to change?", answer: "Children adapt well.", page: 6 },
  ],
  multipleChoice: [
    { question: "Who takes Heidi to Grandfather?", correctLetter: "B", rationale: "Deta is Heidi's aunt." },
    { question: "What does Heidi remove on the way up?", correctLetter: "C", rationale: "She removes her coat." },
    { question: "Where does Grandfather live?", correctLetter: "B", rationale: "He lives on the mountain." },
  ],
  evidenceFromTheStory: [
    { question: "Find evidence that Heidi enjoys the mountain.", sampleAnswer: "She runs freely.", quote: "she ran up the path", page: 1 },
    { question: "Find evidence of Deta's hurry.", sampleAnswer: "She walks fast.", quote: "Deta hurried along", page: 2 },
    { question: "Find evidence that Grandfather is isolated.", sampleAnswer: "He lives alone.", quote: "the old man sat alone", page: 3 },
  ],
  characterChart: [
    { characterName: "Heidi", description: "A curious girl.", whatThisShows: "Her adventurous spirit.", quote: "she ran up the path", page: 1 },
  ],
  drawItDetails: ["mountain path", "Heidi running", "fir trees"],
})}`;

const FOCUS_QUESTION_TEXT = "What will Heidi discover when she meets Grandfather?";

const GET_READY_TO_READ_RESPONSE = `<div class="focus-question">
<p>${FOCUS_QUESTION_TEXT}</p>
</div>
<p>Think about a time when you visited somewhere completely new.</p>`;

const WORDS_TO_KNOW_RESPONSE = "WORDS_TO_KNOW_TABLE_PLACEHOLDER";

const CREATIVE_RESPONSE_RESPONSE =
  "<p>Imagine you are Heidi. Write a letter to your aunt Deta about meeting Grandfather. Include at least three details from the chapter.</p>";

const DRAW_IT_RESPONSE = "<p>Draw Heidi arriving at Grandfather's mountain hut.</p>";

const BONUS_CHALLENGE_RESPONSE = `<ol>
<li>Heidi and Deta begin climbing the steep mountain path.</li>
<li>Deta explains to Peter who Grandfather is.</li>
<li>Heidi removes her extra layers of clothing.</li>
<li>Peter and the goats join Heidi on the path.</li>
<li>Heidi runs ahead freely with the goats.</li>
<li>Heidi and Deta arrive at Grandfather's hut.</li>
<li>Grandfather looks at Heidi in silence for the first time.</li>
</ol>`;

// ---------------------------------------------------------------------------
// Meta fixture (no character database — avoids character_chart row issues)
// ---------------------------------------------------------------------------

const META = {
  bookTitle: "Heidi",
  author: "Johanna Spyri",
  chapterNum: 1,
  chapterTitle: "Up the Mountain",
  pages: "1–12",
  grade: 4,
  extractedText: "Heidi and Deta climbed the mountain. Peter tended his goats.",
};

const VOCABULARY = [
  { word: "steep", book_quote: "the steep path", page_number: 1 },
] as never[];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("generateStudentWorkbook — focusQuestion capture", () => {
  beforeEach(() => {
    const mockCreate = vi.mocked(anthropic.messages.create);
    mockCreate.mockReset();
    mockCreate
      .mockResolvedValueOnce(makeAnthropicResponse(COMBINED_CORE_RESPONSE) as never)
      .mockResolvedValueOnce(makeAnthropicResponse(GET_READY_TO_READ_RESPONSE) as never)
      .mockResolvedValueOnce(makeAnthropicResponse(WORDS_TO_KNOW_RESPONSE) as never)
      .mockResolvedValueOnce(makeAnthropicResponse(CREATIVE_RESPONSE_RESPONSE) as never)
      .mockResolvedValueOnce(makeAnthropicResponse(DRAW_IT_RESPONSE) as never)
      .mockResolvedValueOnce(makeAnthropicResponse(BONUS_CHALLENGE_RESPONSE) as never);
  });

  it("populates focusQuestion from the get_ready_to_read LLM output", async () => {
    const result = await generateStudentWorkbook(META, VOCABULARY);
    expect(result.focusQuestion).toBe(FOCUS_QUESTION_TEXT);
  });

  it("persists focusQuestion into answers.focusQuestion for durable round-trip", async () => {
    const result = await generateStudentWorkbook(META, VOCABULARY);
    expect(result.answers.focusQuestion).toBe(FOCUS_QUESTION_TEXT);
  });

  it("focusQuestion in result matches answers.focusQuestion exactly", async () => {
    const result = await generateStudentWorkbook(META, VOCABULARY);
    expect(result.focusQuestion).toBe(result.answers.focusQuestion);
  });

  it("returns a non-empty focusQuestion (not silently blank)", async () => {
    const result = await generateStudentWorkbook(META, VOCABULARY);
    expect(result.focusQuestion.length).toBeGreaterThan(0);
  });

  it("populates coreQuestions for all five sections", async () => {
    const result = await generateStudentWorkbook(META, VOCABULARY);
    expect(result.coreQuestions.think_about_the_story).toBeTruthy();
    expect(result.coreQuestions.reading_between_the_lines).toBeTruthy();
    expect(result.coreQuestions.dig_deeper).toBeTruthy();
    expect(result.coreQuestions.multiple_choice_questions).toBeTruthy();
    expect(result.coreQuestions.evidence_from_the_story).toBeTruthy();
  });

  it("TATS core question HTML contains the expected 6 questions", async () => {
    const { extractQuestionTexts } = await import("../teacherGuide.js");
    const result = await generateStudentWorkbook(META, VOCABULARY);
    const questions = extractQuestionTexts(result.coreQuestions.think_about_the_story);
    expect(questions).toHaveLength(6);
  });

  it("RBTL core question HTML contains the expected 3 questions", async () => {
    const { extractQuestionTexts } = await import("../teacherGuide.js");
    const result = await generateStudentWorkbook(META, VOCABULARY);
    const questions = extractQuestionTexts(result.coreQuestions.reading_between_the_lines);
    expect(questions).toHaveLength(3);
  });

  it("returns an empty focusQuestion when get_ready_to_read has no focus-question div", async () => {
    const mockCreate = vi.mocked(anthropic.messages.create);
    mockCreate.mockReset();
    mockCreate
      .mockResolvedValueOnce(makeAnthropicResponse(COMBINED_CORE_RESPONSE) as never)
      .mockResolvedValueOnce(makeAnthropicResponse("<p>No focus question div here.</p>") as never)
      .mockResolvedValueOnce(makeAnthropicResponse(WORDS_TO_KNOW_RESPONSE) as never)
      .mockResolvedValueOnce(makeAnthropicResponse(CREATIVE_RESPONSE_RESPONSE) as never)
      .mockResolvedValueOnce(makeAnthropicResponse(DRAW_IT_RESPONSE) as never)
      .mockResolvedValueOnce(makeAnthropicResponse(BONUS_CHALLENGE_RESPONSE) as never);
    const result = await generateStudentWorkbook(META, VOCABULARY);
    expect(result.focusQuestion).toBe("");
    expect(result.answers.focusQuestion).toBe("");
  });
});
