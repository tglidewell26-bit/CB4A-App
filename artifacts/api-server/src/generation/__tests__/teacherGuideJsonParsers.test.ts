import { describe, expect, it } from "vitest";
import {
  parseAnswerKey,
  parseCommonStudentQuestions,
  parseCreativeResponseErrors,
  parseDifferentiatedSupports,
  parseExitTicket,
  parseGetReadyToRead,
  parseGuidedReading,
  parseMeasurableObjectives,
  parseStandards,
  parseThinkAboutTheStoryAnswers,
  parseWordsToKnowMiniLesson,
} from "../teacherGuideJsonParsers.js";

describe("teacherGuideJsonParsers", () => {
  describe("parseMeasurableObjectives", () => {
    it("parses a valid 5-objective JSON object", () => {
      const json = JSON.stringify({
        objectives: [
          { text: "identify the main character", standardCode: "RL.4.3" },
          { text: "describe the setting", standardCode: "RL.4.1" },
          { text: "infer character feelings", standardCode: "RL.4.3" },
          { text: "use new vocabulary words", standardCode: "L.4.4" },
          { text: "discuss text in a partner pair", standardCode: "SL.4.1" },
        ],
      });
      const data = parseMeasurableObjectives(json);
      expect(data.objectives).toHaveLength(5);
      expect(data.objectives[0].standardCode).toBe("RL.4.3");
    });

    it("strips markdown fences before parsing", () => {
      const json = `\`\`\`json\n${JSON.stringify({
        objectives: [
          { text: "a", standardCode: "RL.4.1" },
          { text: "b", standardCode: "RL.4.2" },
          { text: "c", standardCode: "L.4.4" },
          { text: "d", standardCode: "W.4.3" },
          { text: "e", standardCode: "SL.4.1" },
        ],
      })}\n\`\`\``;
      expect(() => parseMeasurableObjectives(json)).not.toThrow();
    });

    it("throws on invalid JSON", () => {
      expect(() => parseMeasurableObjectives("not json {")).toThrow(/not valid JSON/);
    });

    it("throws when objectives count is out of range", () => {
      const json = JSON.stringify({
        objectives: [{ text: "a", standardCode: "RL.4.1" }],
      });
      expect(() => parseMeasurableObjectives(json)).toThrow(/expected 5–6 objectives/);
    });

    it("throws when a required field is missing", () => {
      const json = JSON.stringify({
        objectives: [
          { text: "a" },
          { text: "b", standardCode: "RL.4.2" },
          { text: "c", standardCode: "L.4.4" },
          { text: "d", standardCode: "W.4.3" },
          { text: "e", standardCode: "SL.4.1" },
        ],
      });
      expect(() => parseMeasurableObjectives(json)).toThrow(/standardCode/);
    });
  });

  describe("parseStandards", () => {
    it("parses a valid standards object", () => {
      const json = JSON.stringify({
        standards: [{ code: "RL.4.1" }, { code: "W.4.3" }],
      });
      const data = parseStandards(json);
      expect(data.standards).toHaveLength(2);
    });

    it("throws if code is missing", () => {
      const json = JSON.stringify({
        standards: [{}],
      });
      expect(() => parseStandards(json)).toThrow(/code/);
    });
  });

  describe("parseGetReadyToRead", () => {
    it("parses valid get_ready_to_read", () => {
      const json = JSON.stringify({
        quickWritePrompt: "How do you feel about new places?",
        implementationSteps: ["a", "b", "c", "d"],
        connectionTip: "Builds schema.",
      });
      const data = parseGetReadyToRead(json);
      expect(data.quickWritePrompt).toContain("new places");
      expect(data.implementationSteps).toHaveLength(4);
    });

    it("throws on missing connectionTip", () => {
      const json = JSON.stringify({
        quickWritePrompt: "Q",
        implementationSteps: ["a"],
      });
      expect(() => parseGetReadyToRead(json)).toThrow(/connectionTip/);
    });
  });

  describe("parseWordsToKnowMiniLesson", () => {
    it("parses a valid worked example", () => {
      const json = JSON.stringify({
        workedWord: "scrambled",
        workedQuote: "She scrambled up the path.",
        workedPage: 5,
        contextClueStrategy: "Look at the verbs nearby.",
        studentDefinition: "moved quickly using hands and feet",
        vocabularyTip: "Have students gesture the word.",
      });
      const data = parseWordsToKnowMiniLesson(json);
      expect(data.workedWord).toBe("scrambled");
      expect(data.workedPage).toBe(5);
    });

    it("throws when workedPage is not a number", () => {
      const json = JSON.stringify({
        workedWord: "x",
        workedQuote: "x",
        workedPage: "five",
        contextClueStrategy: "x",
        studentDefinition: "x",
        vocabularyTip: "x",
      });
      expect(() => parseWordsToKnowMiniLesson(json)).toThrow(/workedPage/);
    });
  });

  describe("parseGuidedReading", () => {
    it("parses a valid sectioned object", () => {
      const json = JSON.stringify({
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
        ],
        readAloudTip: "Pause after each segment.",
      });
      const data = parseGuidedReading(json);
      expect(data.sections[0].questions[0].questionType).toBe("comprehension");
    });

    it("throws on unknown questionType", () => {
      const json = JSON.stringify({
        sections: [
          {
            pageStart: 4,
            pageEnd: 6,
            openingPhrase: "x",
            closingPhrase: "y",
            questions: [{ text: "?", questionType: "synthesis" }],
          },
        ],
        readAloudTip: "x",
      });
      expect(() => parseGuidedReading(json)).toThrow(/questionType/);
    });
  });

  describe("parseThinkAboutTheStoryAnswers", () => {
    it("parses with all required tiers", () => {
      const json = JSON.stringify({
        answers: [{ question: "Q?", answer: "A.", page: 5 }],
        inferentialPrompts: ["x", "y"],
        tieredDiscussion: {
          literal: ["a"],
          inference: ["b"],
          analysis: ["c"],
          evaluation: ["d"],
        },
        analyticalThinking: ["e"],
        personalConnection: ["f"],
      });
      const data = parseThinkAboutTheStoryAnswers(json);
      expect(data.tieredDiscussion.evaluation).toEqual(["d"]);
      expect(data.personalConnection).toEqual(["f"]);
    });

    it("throws on missing tier", () => {
      const json = JSON.stringify({
        answers: [],
        inferentialPrompts: [],
        tieredDiscussion: { literal: [], inference: [], analysis: [] },
        analyticalThinking: [],
        personalConnection: [],
      });
      expect(() => parseThinkAboutTheStoryAnswers(json)).toThrow(/evaluation/);
    });
  });

  describe("parseDifferentiatedSupports", () => {
    it("parses all three groups with three phases each", () => {
      const phases = { before: ["a"], during: ["b"], after: ["c"] };
      const json = JSON.stringify({
        strugglingReaders: phases,
        englishLanguageLearners: phases,
        advancedStudents: phases,
      });
      const data = parseDifferentiatedSupports(json);
      expect(data.advancedStudents.during).toEqual(["b"]);
    });

    it("throws when a group is missing", () => {
      const phases = { before: ["a"], during: ["b"], after: ["c"] };
      const json = JSON.stringify({
        strugglingReaders: phases,
        englishLanguageLearners: phases,
      });
      expect(() => parseDifferentiatedSupports(json)).toThrow(/advancedStudents/);
    });
  });

  describe("parseCommonStudentQuestions", () => {
    it("parses 5 Q&A pairs with optional page", () => {
      const json = JSON.stringify({
        questions: [
          { studentQ: "1?", teacherA: "A.", page: 4 },
          { studentQ: "2?", teacherA: "A." },
          { studentQ: "3?", teacherA: "A." },
          { studentQ: "4?", teacherA: "A." },
          { studentQ: "5?", teacherA: "A." },
        ],
      });
      const data = parseCommonStudentQuestions(json);
      expect(data.questions).toHaveLength(5);
      expect(data.questions[0].page).toBe(4);
      expect(data.questions[1].page).toBeUndefined();
    });

    it("throws if too few questions", () => {
      const json = JSON.stringify({
        questions: [{ studentQ: "1?", teacherA: "A." }],
      });
      expect(() => parseCommonStudentQuestions(json)).toThrow(/expected 5–8 questions/);
    });
  });

  describe("parseCreativeResponseErrors", () => {
    it("parses all five error keys", () => {
      const body = { paragraph: "p", weakExample: "w", howToFix: "h" };
      const json = JSON.stringify({
        characterName: "Heidi",
        errors: {
          noSpecificDetails: body,
          breakingCharacter: body,
          retelling: body,
          noEvidence: body,
          modernLanguage: body,
        },
      });
      const data = parseCreativeResponseErrors(json);
      expect(data.characterName).toBe("Heidi");
      expect(data.errors.modernLanguage.howToFix).toBe("h");
    });

    it("throws if an error key is missing", () => {
      const body = { paragraph: "p", weakExample: "w", howToFix: "h" };
      const json = JSON.stringify({
        characterName: "Heidi",
        errors: { noSpecificDetails: body },
      });
      expect(() => parseCreativeResponseErrors(json)).toThrow(/breakingCharacter/);
    });
  });

  describe("parseExitTicket", () => {
    it("parses a valid exit ticket", () => {
      const json = JSON.stringify({
        prompt: "Predict what will happen next chapter, with text evidence.",
        successCriteria: ["a", "b", "c"],
        strongExample: "Strong.",
        developingExample: "Developing.",
      });
      const data = parseExitTicket(json);
      expect(data.successCriteria).toHaveLength(3);
    });

    it("throws when fewer than 3 success criteria", () => {
      const json = JSON.stringify({
        prompt: "p",
        successCriteria: ["a", "b"],
        strongExample: "s",
        developingExample: "d",
      });
      expect(() => parseExitTicket(json)).toThrow(/at least 3 successCriteria/);
    });
  });

  describe("parseAnswerKey", () => {
    it("parses a full answer key", () => {
      const json = JSON.stringify({
        readingBetweenTheLines: [{ question: "Q", answer: "A", page: 5 }],
        digDeeper: [{ question: "Q", answer: "A", page: 6 }],
        multipleChoice: [{ question: "Q", correctLetter: "B", rationale: "R" }],
        evidenceFromTheStory: [{ question: "Q", sampleAnswer: "S", quote: "Q", page: 7 }],
        characterChart: [
          { characterName: "C", description: "D", whatThisShows: "S", quote: "Q", page: 8 },
        ],
        drawItDetails: ["a", "b", "c"],
      });
      const data = parseAnswerKey(json);
      expect(data.multipleChoice[0].correctLetter).toBe("B");
      expect(data.drawItDetails).toHaveLength(3);
    });

    it("throws on invalid correctLetter", () => {
      const json = JSON.stringify({
        readingBetweenTheLines: [],
        digDeeper: [],
        multipleChoice: [{ question: "Q", correctLetter: "Z", rationale: "R" }],
        evidenceFromTheStory: [],
        characterChart: [],
        drawItDetails: [],
      });
      expect(() => parseAnswerKey(json)).toThrow(/correctLetter must be A\/B\/C\/D/);
    });
  });
});
