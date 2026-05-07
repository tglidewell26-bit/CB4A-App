import { describe, expect, it } from "vitest";
import {
  renderAnswerKey,
  renderCommonStudentQuestions,
  renderCreativeResponseErrors,
  renderDifferentiatedSupports,
  renderExitTicket,
  renderGetReadyToRead,
  renderGuidedReading,
  renderLessonOverview,
  renderMaterialsNeeded,
  renderMeasurableObjectives,
  renderStandards,
  renderThinkAboutTheStoryAnswers,
  renderWordsToKnowMiniLesson,
} from "../teacherGuideRenderers.js";
import type { ChapterMeta } from "../templateRenderers.js";

const meta: ChapterMeta = {
  bookTitle: "Heidi",
  author: "Johanna Spyri",
  chapterNum: 1,
  chapterTitle: "Up the Mountain",
  pages: "1–12",
  grade: 4,
  extractedText: "(unused in renderer tests)",
};

describe("teacherGuideRenderers", () => {
  describe("renderLessonOverview", () => {
    it("returns the canonical 60-minute tip", () => {
      const html = renderLessonOverview();
      expect(html).toContain("60-minute instructional period");
      expect(html).toContain("two 30-minute sessions");
    });
  });

  describe("renderMaterialsNeeded", () => {
    it("includes book title, author, and chapter ref", () => {
      const html = renderMaterialsNeeded(meta);
      expect(html).toContain("Heidi");
      expect(html).toContain("Johanna Spyri");
      expect(html).toContain("Chapter 1");
      expect(html).toContain("Student Workbook");
    });

    it("escapes HTML entities in book title", () => {
      const html = renderMaterialsNeeded({ ...meta, bookTitle: "A&B <Test>" });
      expect(html).toContain("A&amp;B &lt;Test&gt;");
    });
  });

  describe("renderMeasurableObjectives", () => {
    it("renders one shared SWBAT line and objective-only bullets with codes", () => {
      const html = renderMeasurableObjectives({
        objectives: [
          { text: "analyze how the protagonist’s actions reveal character traits", standardCode: "RL.4.3" },
          { text: "cite textual evidence to describe the mountain setting", standardCode: "RL.4.1" },
        ],
      });
      expect(html).toContain("Students will be able to analyze how the protagonist’s actions reveal character traits (RL.4.3)");
      expect(html).toContain("Students will be able to cite textual evidence to describe the mountain setting (RL.4.1)");
      expect(html.startsWith("<ul>")).toBe(true);
    });
  });

  describe("renderStandards", () => {
    it("renders compact strand-grouped lists with descriptions filled from code lookup", () => {
      const html = renderStandards({
        standards: [
          { code: "RL.4.1" },
          { code: "W.4.3" },
          { code: "L.4.4" },
          { code: "SL.4.1" },
        ],
      }, 4);
      expect(html).toContain("Reading Literature");
      expect(html).toContain("Writing");
      expect(html).toContain("Language");
      expect(html).toContain("Speaking and Listening");
      expect(html).toContain("RL.4.1");
      expect(html).toContain("W.4.3");
      expect(html).toMatch(/Refer to details and examples in a text/i);
      expect(html).not.toContain("Used in:");
    });

    it("ignores fabricated codes (no lookup match) without crashing", () => {
      const html = renderStandards({
        standards: [{ code: "ZZ.4.99" }],
      }, 4);
      expect(html).toContain("No standards selected for this chapter.");
    });
  });

  describe("renderGetReadyToRead", () => {
    it("renders quick-write prompt, ordered impl steps, and connection tip", () => {
      const html = renderGetReadyToRead({
        quickWritePrompt: "How do you feel about new places?",
        implementationSteps: ["Display the prompt.", "Write quietly.", "Pair share."],
        connectionTip: "Builds schema for the chapter.",
      });
      expect(html).toContain("Quick-write prompt");
      expect(html).toContain("How do you feel about new places?");
      expect(html).toContain('<ul class="tg-impl-steps">');
      expect(html).toContain("Display the prompt.");
      expect(html).toContain('<div class="tg-tip">');
      expect(html).toContain("Connection tip");
    });
  });

  describe("renderWordsToKnowMiniLesson", () => {
    it("renders Activities, Partner Practice, Quick Check sub-blocks plus tip", () => {
      const html = renderWordsToKnowMiniLesson({
        workedWord: "scrambled",
        workedQuote: "She scrambled up the path.",
        workedPage: 5,
        contextClueStrategy: "Look at the verbs.",
      }, []);
      expect(html).toContain("Activities");
      expect(html).toContain("Partner practice");
      expect(html).toContain("Quick check");
      expect(html).toContain("scrambled");
      expect(html).toContain("(p. 5)");
    });
  });

  describe("renderGuidedReading", () => {
    it("renders numbered sections with page ranges and pause-point questions", () => {
      const html = renderGuidedReading({
        sections: [
          {
            pageStart: 4,
            pageEnd: 6,
            openingPhrase: "It was a bright morning",
            closingPhrase: "She reached the top",
            questions: [
              { text: "Who is travelling?", questionType: "comprehension" },
              { text: "What does this suggest?", questionType: "inference" },
            ],
          },
          {
            pageStart: 7,
            pageEnd: 12,
            openingPhrase: "Grandfather watched",
            closingPhrase: "the door swung shut",
            questions: [
              { text: "Why doesn't Grandfather speak?", questionType: "analysis" },
              { text: "Was he right to take her in?", questionType: "evaluation" },
            ],
          },
        ],
        readAloudTip: "Pause after each segment.",
      });
      expect(html).toContain("Section 1: pages 4–6");
      expect(html).toContain("Section 2: pages 7–12");
      expect(html).toContain('<ol class="tg-pause-points">');
      expect(html).toContain("Who is travelling?");
      expect(html).toContain("Was he right to take her in?");
      expect(html).toContain("Read-aloud tip");
    });
  });

  describe("renderThinkAboutTheStoryAnswers", () => {
    it("renders Q/A blocks plus tiered discussion + analytical + personal sub-blocks", () => {
      const html = renderThinkAboutTheStoryAnswers({
        answers: [
          { question: "Who climbs the mountain?", answer: "Heidi and Deta.", page: 4 },
        ],
        inferentialPrompts: ["What does Heidi's reaction suggest?"],
        tieredDiscussion: {
          literal: ["Where does Grandfather live?"],
          inference: ["Why might Deta be eager to leave?"],
          analysis: ["How does the contrast reveal character?"],
          evaluation: ["Was Deta right?"],
        },
        analyticalThinking: ["How does the setting reveal character?"],
        personalConnection: ["Have you ever been judged?"],
      });
      expect(html).toContain('<div class="tg-answer">');
      expect(html).toContain("Heidi and Deta. (p. 4).");
      expect(html).toContain("Inferential Thinking");
      expect(html).toContain("Tiered Discussion Prompts");
      expect(html).toContain("Literal:");
      expect(html).toContain("Inference:");
      expect(html).toContain("Analysis:");
      expect(html).toContain("Evaluation:");
      expect(html).toContain("Analytical Thinking");
      expect(html).toContain("Personal Connection");
    });
  });

  describe("renderDifferentiatedSupports", () => {
    it("renders all three groups with before/during/after labels", () => {
      const phases = { before: ["b1", "b2"], during: ["d1"], after: ["a1"] };
      const html = renderDifferentiatedSupports({
        strugglingReaders: phases,
        englishLanguageLearners: phases,
        advancedStudents: phases,
      });
      expect(html).toContain("Struggling Readers");
      expect(html).toContain("English Language Learners");
      expect(html).toContain("Advanced Students");
      expect(html).toContain("Before reading:");
      expect(html).toContain("During reading:");
      expect(html).toContain("After reading:");
    });
  });

  describe("renderCommonStudentQuestions", () => {
    it("renders an ordered list with optional page reference", () => {
      const html = renderCommonStudentQuestions({
        questions: [
          { studentQ: "Why is Grandfather feared?", teacherA: "Villagers gossip about him.", page: 6 },
          { studentQ: "What do goats eat?", teacherA: "Grass and leaves." },
        ],
      });
      expect(html).toContain('<ol class="tg-csq">');
      expect(html).toContain("Why is Grandfather feared?");
      expect(html).toContain("(p. 6)");
      expect(html).toContain("What do goats eat?");
    });
  });

  describe("renderCreativeResponseErrors", () => {
    it("renders five fixed headings with weak example + how-to-fix bullets", () => {
      const body = { paragraph: "P.", weakExample: "WeakEx.", howToFix: "FixIt." };
      const html = renderCreativeResponseErrors({
        characterName: "Heidi",
        errors: {
          noSpecificDetails: body,
          breakingCharacter: body,
          retelling: body,
          noEvidence: body,
          modernLanguage: body,
        },
      });
      expect(html).toContain("No Specific Details From The Chapter");
      expect(html).toContain("Breaking Character");
      expect(html).toContain("Retelling The Whole Chapter Instead of Focusing on Heidi&#39;s Experience");
      expect(html).toContain("No Evidence From the Text");
      expect(html).toContain("Modern Language That Doesn&#39;t Fit The Story");
      const weakCount = (html.match(/Weak example/g) ?? []).length;
      const fixCount = (html.match(/How to fix/g) ?? []).length;
      expect(weakCount).toBe(5);
      expect(fixCount).toBe(5);
    });
  });

  describe("renderExitTicket", () => {
    it("renders prompt, success criteria, and example responses", () => {
      const html = renderExitTicket({
        prompt: "Predict what will happen next chapter, with text evidence.",
        successCriteria: ["names a prediction", "uses 'because'", "cites a chapter detail"],
        strongExample: "I predict X because Y.",
        developingExample: "Maybe X.",
      });
      expect(html).toContain("Prompt");
      expect(html).toContain("Predict what will happen next chapter");
      expect(html).toContain("Success Criteria");
      expect(html).toContain("Example Responses");
      expect(html).toContain("Strong:");
      expect(html).toContain("Developing:");
    });
  });

  describe("renderAnswerKey", () => {
    it("renders all six answer-key sub-blocks with the character chart table", () => {
      const html = renderAnswerKey({
        readingBetweenTheLines: [{ question: "Q1", answer: "A1", page: 5 }],
        digDeeper: [{ question: "Q2", answer: "A2", page: 6 }],
        multipleChoice: [{ question: "Q3", correctLetter: "B", rationale: "R" }],
        evidenceFromTheStory: [
          { question: "Q4", sampleAnswer: "S", quote: "Quote", page: 7 },
        ],
        characterChart: [
          { characterName: "Heidi", description: "Curious", whatThisShows: "Adapts", quote: "Q", page: 8 },
        ],
        drawItDetails: ["mountain", "goats", "hut"],
      });
      expect(html).toContain("Reading Between the Lines — Answers");
      expect(html).toContain("Dig Deeper — Answers");
      expect(html).toContain("Multiple Choice — Answers");
      expect(html).toContain("Evidence from the Story — Sample Answers");
      expect(html).toContain("Character Chart — Answer Key");
      expect(html).toContain('<table class="tg-character-key">');
      expect(html).toContain("Heidi");
      expect(html).toContain("Draw It! — Suggested Details");
      expect(html).toContain("mountain");
    });

    it("handles empty workbook sections gracefully", () => {
      const html = renderAnswerKey({
        readingBetweenTheLines: [],
        digDeeper: [],
        multipleChoice: [],
        evidenceFromTheStory: [],
        characterChart: [],
        drawItDetails: [],
      });
      expect(html).toContain('<table class="tg-character-key">');
    });
  });
});
