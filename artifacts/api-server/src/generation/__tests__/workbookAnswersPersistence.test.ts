/**
 * Proves that workbook answers can be round-tripped through JSON serialization
 * (as stored in the answers_json DB column) and used to render Teacher Guide
 * sections without re-parsing the workbook HTML or making additional Claude calls.
 */
import { describe, it, expect } from "vitest";
import { parseWorkbookAnswers } from "../studentWorkbook.js";
import { renderThinkAboutTheStoryAnswers, renderAnswerKey } from "../teacherGuideRenderers.js";

const MINIMAL_ANSWERS_JSON = JSON.stringify({
  thinkAboutTheStory: {
    answers: [
      { question: "Who travels with Heidi?", answer: "Deta travels with Heidi.", page: 1 },
    ],
    inferentialPrompts: ["What might this suggest about Heidi?"],
    tieredDiscussion: {
      literal: ["Who are the main characters?"],
      inference: ["Why does Heidi remove her clothes?"],
      analysis: ["How does the setting reflect Heidi's mood?"],
      evaluation: ["Was Deta right to leave Heidi with Grandfather?"],
    },
    analyticalThinking: ["Consider how the mountain shapes Heidi's character."],
    personalConnection: ["Have you ever felt free outdoors?"],
  },
  readingBetweenTheLines: [
    { question: "Why might Heidi feel happy on the mountain?", answer: "Because she feels free.", page: 2 },
  ],
  digDeeper: [
    { question: "How does the mountain setting reveal Heidi's character?", answer: "It shows her love of nature.", page: 3 },
  ],
  multipleChoice: [
    { question: "Who takes Heidi up the mountain?", correctLetter: "B", rationale: "Deta is Heidi's aunt." },
  ],
  evidenceFromTheStory: [
    {
      question: "Find evidence that Heidi enjoys the mountain.",
      sampleAnswer: "Heidi runs freely after removing her extra clothes.",
      quote: "she ran up the steep path as quickly as she could",
      page: 4,
    },
  ],
  characterChart: [
    {
      characterName: "Heidi",
      description: "A young, curious girl who loves the outdoors.",
      whatThisShows: "Her adventurous spirit and adaptability.",
      quote: "she ran up the steep path",
      page: 1,
    },
  ],
  drawItDetails: ["Heidi running up the mountain path", "The fir trees", "Grandfather's hut in the background"],
});

describe("workbook answers persistence round-trip", () => {
  it("parses answers JSON into typed StudentWorkbookAnswers including focusQuestion", () => {
    const answers = parseWorkbookAnswers(MINIMAL_ANSWERS_JSON, "What will Heidi find at the top?");
    expect(answers.focusQuestion).toBe("What will Heidi find at the top?");
    expect(answers.thinkAboutTheStory.answers).toHaveLength(1);
    expect(answers.thinkAboutTheStory.answers[0].question).toBe("Who travels with Heidi?");
    expect(answers.answerKey.multipleChoice[0].correctLetter).toBe("B");
    expect(answers.answerKey.characterChart[0].characterName).toBe("Heidi");
    expect(answers.answerKey.drawItDetails).toHaveLength(3);
  });

  it("round-trips through JSON serialization preserving all fields", () => {
    const answers = parseWorkbookAnswers(MINIMAL_ANSWERS_JSON, "Will Heidi be happy?");
    const serialized = JSON.stringify(answers);
    const reparsed = JSON.parse(serialized) as typeof answers;
    expect(reparsed.focusQuestion).toBe("Will Heidi be happy?");
    expect(reparsed.thinkAboutTheStory.answers[0].question).toBe("Who travels with Heidi?");
    expect(reparsed.answerKey.readingBetweenTheLines[0].answer).toBe("Because she feels free.");
    expect(reparsed.answerKey.evidenceFromTheStory[0].quote).toBe(
      "she ran up the steep path as quickly as she could",
    );
  });

  it("renders think_about_the_story_answers HTML from persisted answers (no Claude call)", () => {
    const answers = parseWorkbookAnswers(MINIMAL_ANSWERS_JSON, "Focus question here.");
    const html = renderThinkAboutTheStoryAnswers(answers.thinkAboutTheStory);
    expect(typeof html).toBe("string");
    expect(html).toContain("Who travels with Heidi?");
    expect(html).toContain("Deta travels with Heidi.");
  });

  it("renders answer_key HTML from persisted answers (no Claude call)", () => {
    const answers = parseWorkbookAnswers(MINIMAL_ANSWERS_JSON, "Focus question here.");
    const html = renderAnswerKey(answers.answerKey);
    expect(typeof html).toBe("string");
    expect(html.length).toBeGreaterThan(0);
  });
});
