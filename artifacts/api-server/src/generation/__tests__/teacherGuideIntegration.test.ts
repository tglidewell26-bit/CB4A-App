/**
 * End-to-end integration test for generateTeacherGuide.
 *
 * Mocks the Anthropic client so we can drive the full pipeline through every
 * Claude-backed Teacher Guide section in order, then asserts that:
 *   - Both new sections (Homeschool Parent Guide + Standards Mapping) appear,
 *     in that order, after the rest of the guide.
 *   - The Standards Mapping table emits exactly the same codes, in the same
 *     order, as the Standards section above it (validateStandardsMappingCodes
 *     would otherwise have thrown during generation).
 *   - The Homeschool Parent Guide ends with the canonical bold/italic/uppercase
 *     "(INSERT NEXT CHAPTER TEASER)" placeholder.
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

import { generateTeacherGuide } from "../teacherGuide.js";
import { anthropic } from "../../ai/anthropic.js";
import type { ChapterMeta } from "../templateRenderers.js";
import type {
  StudentWorkbookResult,
  StudentWorkbookAnswers,
} from "../studentWorkbook.js";
import type { VocabularyWord } from "../../vocabulary/types.js";

function makeAnthropicResponse(text: string) {
  return { content: [{ type: "text", text }] };
}

// Standards used for this chapter, in the order Claude returns them. The
// standards_mapping section MUST emit the same codes in this same order.
const CHAPTER_STANDARDS_CODES = ["RL.4.1", "RL.4.3", "W.4.3"] as const;

const META: ChapterMeta = {
  bookTitle: "Heidi",
  author: "Johanna Spyri",
  chapterNum: 1,
  chapterTitle: "Up the Mountain",
  pages: "1–12",
  grade: 4,
  extractedText: "Heidi and Deta climbed the mountain. Peter tended his goats.",
};

const VOCABULARY: VocabularyWord[] = [
  {
    word: "alm",
    book_quote: "the alm rose above her",
    page_number: 1,
    grade_band: "4",
    score: 1,
    kid_friendly_definition: "a high mountain pasture",
    example_sentence: "The cows graze on the alm in summer.",
  } as VocabularyWord,
];

// ---------------------------------------------------------------------------
// Mocked Claude responses — ordered to match the LLM section order in
// TEACHER_GUIDE_SECTIONS (skipping non-LLM sections lesson_overview,
// materials_needed, think_about_the_story_answers, answer_key).
// ---------------------------------------------------------------------------

const MEASURABLE_OBJECTIVES_JSON = JSON.stringify({
  objectives: [
    { text: "cite text evidence about Heidi's journey", standardCode: "RL.4.1" },
    { text: "analyze how character actions reveal traits", standardCode: "RL.4.3" },
    { text: "infer character motivations from dialogue", standardCode: "RL.4.3" },
    { text: "write a narrative letter from Heidi's perspective", standardCode: "W.4.3" },
    { text: "discuss evidence-based interpretations with peers", standardCode: "RL.4.1" },
  ],
});

const STANDARDS_JSON = JSON.stringify({
  standards: CHAPTER_STANDARDS_CODES.map((code) => ({ code })),
});

const GET_READY_TO_READ_JSON = JSON.stringify({
  implementationSteps: [
    "Display the prompt on the board.",
    "Give students 3 minutes to write quietly.",
    "Pair-share for 2 minutes.",
    "Whole-class share-out.",
  ],
  connectionTip: "Builds schema for the chapter's mountain setting.",
});

const WORDS_TO_KNOW_MINI_LESSON_JSON = JSON.stringify({
  workedWord: "alm",
  workedQuote: "the alm rose above her",
  workedPage: 1,
  contextClueStrategy: "Look at the surrounding mountain imagery.",
});

const GUIDED_READING_JSON = JSON.stringify({
  sections: [
    {
      pageStart: 1,
      pageEnd: 4,
      openingPhrase: "Heidi and Deta",
      closingPhrase: "the path grew steep",
      questions: [
        { text: "Who is travelling up the mountain?", questionType: "comprehension" },
        { text: "What does Heidi's behavior suggest?", questionType: "inference" },
      ],
    },
    {
      pageStart: 5,
      pageEnd: 8,
      openingPhrase: "Grandfather watched",
      closingPhrase: "the door swung shut",
      questions: [
        { text: "Why is Grandfather silent?", questionType: "analysis" },
        { text: "Was Deta right to leave Heidi?", questionType: "evaluation" },
      ],
    },
    {
      pageStart: 9,
      pageEnd: 12,
      openingPhrase: "At the table",
      closingPhrase: "Heidi slept soundly",
      questions: [
        { text: "How does Heidi adjust to the cabin?", questionType: "inference" },
        { text: "What does her sleep place reveal?", questionType: "analysis" },
      ],
    },
  ],
  readAloudTip: "Pause after each segment to check comprehension.",
});

const DIFFERENTIATED_SUPPORTS_JSON = JSON.stringify({
  strugglingReaders: { before: ["Pre-teach key words"], during: ["Chunk the text"], after: ["Re-read aloud"] },
  englishLanguageLearners: { before: ["Picture walk"], during: ["Cognate spotting"], after: ["Sentence frames"] },
  advancedStudents: { before: ["Open question prompt"], during: ["Annotate themes"], after: ["Compare to other texts"] },
});

const COMMON_STUDENT_QUESTIONS_JSON = JSON.stringify({
  questions: [
    { studentQ: "Why is Grandfather feared?", teacherA: "Villagers gossip about him.", page: 6 },
    { studentQ: "Where do Heidi's parents live?", teacherA: "They have died." },
    { studentQ: "What is an alm?", teacherA: "A high mountain pasture.", page: 1 },
    { studentQ: "Who is Peter?", teacherA: "The local goatherd boy." },
    { studentQ: "Why does Heidi shed her clothes?", teacherA: "She is hot from climbing." },
  ],
});

const CREATIVE_RESPONSE_ERRORS_JSON = JSON.stringify({
  characterName: "Heidi",
  errors: {
    noSpecificDetails: { paragraph: "p", weakExample: "w", howToFix: "h" },
    breakingCharacter: { paragraph: "p", weakExample: "w", howToFix: "h" },
    retelling: { paragraph: "p", weakExample: "w", howToFix: "h" },
    noEvidence: { paragraph: "p", weakExample: "w", howToFix: "h" },
    modernLanguage: { paragraph: "p", weakExample: "w", howToFix: "h" },
  },
});

const EXIT_TICKET_JSON = JSON.stringify({
  prompt: "Predict what will happen in the next chapter, with text evidence.",
  successCriteria: ["names a prediction", "uses 'because'", "cites a chapter detail"],
  strongExample: "I predict Heidi will explore the alm because she ran ahead with the goats.",
  developingExample: "Maybe Heidi will play.",
});

const HOMESCHOOL_PARENT_GUIDE_JSON = JSON.stringify({
  chapterSnapshot: {
    synopsis: "Heidi climbs the mountain with Deta to live with Grandfather.",
    whyThisMatters: "It teaches resilience and adapting to a new home.",
  },
  pacingTips: {
    day1: "Read pages 1–6 together.",
    day2: "Read pages 7–12 together.",
    pausePoints: ["After page 4, ask about Heidi's clothes.", "After page 9, talk about Grandfather's silence."],
    stoppingPoints: ["End of page 7", "End of page 11"],
  },
  discussionQuestions: {
    understanding: [
      { question: "Who is Heidi?", answer: "A young orphan girl." },
      { question: "Where is she going?", answer: "Up to her grandfather's hut." },
      { question: "Who takes her there?", answer: "Her aunt Deta." },
      { question: "What season is it?", answer: "Summer." },
    ],
    thinkingDeeper: [
      { question: "Why might Deta leave Heidi?", answer: "She wants a job in Frankfurt." },
      { question: "How might Heidi feel?", answer: "Nervous but curious." },
      { question: "Why is Grandfather alone?", answer: "He keeps to himself." },
    ],
    personalConnections: [
      "Have you ever moved somewhere new?",
      "Tell about meeting someone for the first time.",
      "What helps you feel brave?",
    ],
  },
  simpleActivity: {
    name: "Pack Heidi's Suitcase",
    rationale: "Helps your child think about what mattered to Heidi.",
    whatYouNeed: ["Paper", "Crayons"],
    whatToDo: ["Draw a suitcase.", "List 5 items.", "Talk about why."],
    bonusChallenge: {
      description: "Write a short note to Heidi.",
      reflectionPrompts: ["What made you pick those things?", "How is it like your room?"],
    },
  },
  parentNotes: {
    contentAwareness: [
      {
        title: "A child sent to live with a stranger",
        paragraph: "Heidi is left with a grandfather she doesn't know. Some kids may find this scary.",
      },
    ],
    vocabularyTips: [
      { strategy: "Sound it out", example: "Try the word 'alm' slowly: a-l-m." },
      { strategy: "Use the picture", example: "Look at the mountain to imagine the alm." },
      { strategy: "Substitute a known word", example: "Try 'meadow' for 'alm'." },
    ],
    wordsToExplain: [
      { word: "alm", definition: "a high mountain meadow" },
      { word: "gruff", definition: "rough or unfriendly sounding" },
      { word: "frock", definition: "a girl's dress" },
      { word: "valley", definition: "the low land between two hills" },
    ],
  },
  encouragement: {
    opening: "You're doing something wonderful by reading aloud.",
    reminders: [
      "Slow down when you can.",
      "Let questions sit.",
      "Use silly voices.",
      "Skip what's too long.",
      "Reread favorite parts.",
    ],
    closing: "Enjoy the quiet wins.",
  },
});

// Standards Mapping must echo the same codes, in the same order, as the
// Standards section above. validateStandardsMappingCodes will throw if not.
const STANDARDS_MAPPING_JSON = JSON.stringify({
  rows: CHAPTER_STANDARDS_CODES.map((code) => ({
    code,
    howAddressed: `Chapter 1 addresses ${code} via close reading and discussion.`,
    assessmentEvidence: `Workbook responses provide evidence for ${code}.`,
  })),
});

const ORDERED_LLM_RESPONSES = [
  MEASURABLE_OBJECTIVES_JSON,
  STANDARDS_JSON,
  GET_READY_TO_READ_JSON,
  WORDS_TO_KNOW_MINI_LESSON_JSON,
  GUIDED_READING_JSON,
  DIFFERENTIATED_SUPPORTS_JSON,
  COMMON_STUDENT_QUESTIONS_JSON,
  CREATIVE_RESPONSE_ERRORS_JSON,
  EXIT_TICKET_JSON,
  HOMESCHOOL_PARENT_GUIDE_JSON,
  STANDARDS_MAPPING_JSON,
];

// ---------------------------------------------------------------------------
// StudentWorkbookResult fixture — provides the workbook HTML slices and the
// pre-generated answers needed by the non-LLM teacher-guide sections.
// ---------------------------------------------------------------------------

const ANSWERS: StudentWorkbookAnswers = {
  focusQuestion: "What will Heidi discover when she meets Grandfather?",
  thinkAboutTheStory: {
    answers: [
      { question: "Who takes Heidi up the mountain?", answer: "Deta does.", page: 1 },
    ],
    inferentialPrompts: ["Why might Heidi feel hopeful?"],
    tieredDiscussion: {
      literal: ["Who are the main characters?"],
      inference: ["Why might Deta be nervous?"],
      analysis: ["How does the setting reveal character?"],
      evaluation: ["Was Deta right to leave Heidi?"],
    },
    analyticalThinking: ["How does the mountain shape Heidi?"],
    personalConnection: ["Have you ever been somewhere new?"],
  },
  answerKey: {
    readingBetweenTheLines: [{ question: "Q?", answer: "A.", page: 1 }],
    digDeeper: [{ question: "Q?", answer: "A.", page: 2 }],
    multipleChoice: [{ question: "Q?", correctLetter: "B", rationale: "R." }],
    evidenceFromTheStory: [{ question: "Q?", sampleAnswer: "S.", quote: "Q.", page: 3 }],
    characterChart: [
      { characterName: "Heidi", description: "Curious", whatThisShows: "Adapts", quote: "Q.", page: 1 },
    ],
    drawItDetails: ["mountain", "goats", "hut"],
  },
};

const WORKBOOK_RESULT: StudentWorkbookResult = {
  html: '<div class="wb-section" data-section-key="words_to_know"><table></table></div>',
  coreQuestions: {
    think_about_the_story: '<div class="question">Who takes Heidi up the mountain?</div>',
    reading_between_the_lines: '<div class="question">Q?</div>',
    dig_deeper: '<div class="question">Q?</div>',
    multiple_choice_questions: '<div class="question">Q?</div>',
    evidence_from_the_story: '<div class="question">Q?</div>',
  },
  focusQuestion: ANSWERS.focusQuestion,
  answers: ANSWERS,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("generateTeacherGuide — end-to-end with new Homeschool + Standards Mapping sections", () => {
  beforeEach(() => {
    const mockCreate = vi.mocked(anthropic.messages.create);
    mockCreate.mockReset();
    let chain = mockCreate as unknown as { mockResolvedValueOnce: (v: unknown) => typeof chain };
    for (const body of ORDERED_LLM_RESPONSES) {
      chain = chain.mockResolvedValueOnce(makeAnthropicResponse(body));
    }
  });

  it("produces a guide that ends with Homeschool Parent Guide followed by Standards Mapping", async () => {
    const html = await generateTeacherGuide(META, WORKBOOK_RESULT, VOCABULARY);

    const homeschoolIdx = html.indexOf('data-section-key="homeschool_parent_guide"');
    const mappingIdx = html.indexOf('data-section-key="standards_mapping"');

    expect(homeschoolIdx).toBeGreaterThan(-1);
    expect(mappingIdx).toBeGreaterThan(homeschoolIdx);

    // Standards Mapping is the last section in the guide.
    expect(
      html.indexOf('data-section-key="', mappingIdx + 1),
    ).toBe(-1);
  });

  it("Standards Mapping table contains exactly the same codes, in order, as the Standards section above it", async () => {
    const html = await generateTeacherGuide(META, WORKBOOK_RESULT, VOCABULARY);

    const standardsBlock = sliceSection(html, "standards");
    const mappingBlock = sliceSection(html, "standards_mapping");

    const standardsCodes = extractCodes(standardsBlock);
    const mappingCodes = extractCodes(mappingBlock);

    expect(standardsCodes).toEqual([...CHAPTER_STANDARDS_CODES]);
    expect(mappingCodes).toEqual(standardsCodes);
  });

  it("Homeschool Parent Guide ends with the bold/italic/uppercase next-chapter teaser placeholder", async () => {
    const html = await generateTeacherGuide(META, WORKBOOK_RESULT, VOCABULARY);
    const homeschoolBlock = sliceSection(html, "homeschool_parent_guide");

    expect(homeschoolBlock).toContain(
      "(<strong><em>INSERT NEXT CHAPTER TEASER</em></strong>)",
    );

    // The placeholder should be the last meaningful piece of the homeschool
    // section — i.e. nothing else follows it inside the section block.
    const placeholderIdx = homeschoolBlock.indexOf("INSERT NEXT CHAPTER TEASER");
    const tailAfterPlaceholder = homeschoolBlock.slice(placeholderIdx).replace(/\s|<[^>]+>/g, "");
    expect(tailAfterPlaceholder).toBe("INSERTNEXTCHAPTERTEASER)");
  });
});

/**
 * Returns the HTML inside the `<div class="tg-section" data-section-key="$key">`
 * wrapper for the given section, so we can assert against just that part.
 * Uses depth-aware matching to find the closing `</div>` of the wrapper.
 */
function sliceSection(html: string, key: string): string {
  const opener = `<div class="tg-section" data-section-key="${key}">`;
  const start = html.indexOf(opener);
  if (start === -1) throw new Error(`section ${key} not found in guide HTML`);
  let depth = 1;
  let i = start + opener.length;
  while (i < html.length && depth > 0) {
    const nextOpen = html.indexOf("<div", i);
    const nextClose = html.indexOf("</div>", i);
    if (nextClose === -1) throw new Error(`unterminated section ${key}`);
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      i = nextOpen + 4;
    } else {
      depth -= 1;
      i = nextClose + 6;
    }
  }
  return html.slice(start, i);
}

function extractCodes(block: string): string[] {
  // Match codes wrapped in <strong>...</strong> (used by both the Standards
  // list items and the Standards Mapping table's first column).
  const codes: string[] = [];
  const rx = /<strong>([A-Z]{1,3}\.\d+\.\d+[a-z]?)<\/strong>/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(block)) !== null) {
    codes.push(m[1]);
  }
  return codes;
}
