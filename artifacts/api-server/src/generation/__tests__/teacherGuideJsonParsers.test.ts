import { describe, expect, it } from "vitest";
import {
  parseAnswerKey,
  parseCommonStudentQuestions,
  parseCreativeResponseErrors,
  parseDifferentiatedSupports,
  parseExitTicket,
  parseGetReadyToRead,
  parseGuidedReading,
  parseHomeschoolParentGuide,
  parseMeasurableObjectives,
  parseStandards,
  parseStandardsMapping,
  parseThinkAboutTheStoryAnswers,
  parseWordsToKnowMiniLesson,
  validateAnswerKeyQuestionsMatchHtml,
  validateMultipleChoiceAnswerLetters,
  validateStandardsMappingCodes,
} from "../teacherGuideJsonParsers.js";
import type { ParsedCoreQuestions } from "../../prompts/workbookSectionPrompts.js";

describe("teacherGuideJsonParsers", () => {
  describe("parseMeasurableObjectives", () => {
    it("parses a valid 5-objective JSON object", () => {
      const json = JSON.stringify({
        objectives: [
          { text: "analyze how character actions reveal traits", standardCode: "RL.4.3" },
          { text: "cite textual evidence to explain key events", standardCode: "RL.4.1" },
          { text: "infer character motivations from dialogue and actions", standardCode: "RL.4.3" },
          { text: "determine the meaning of unfamiliar vocabulary using context clues", standardCode: "L.4.4" },
          { text: "collaborate to discuss evidence-based interpretations", standardCode: "SL.4.1" },
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
        implementationSteps: ["a", "b", "c", "d"],
        connectionTip: "Builds schema.",
      });
      const data = parseGetReadyToRead(json);
      expect(data.implementationSteps).toHaveLength(4);
    });

    it("throws on missing connectionTip", () => {
      const json = JSON.stringify({
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

    it("parses optional bonusChallenge string array when present", () => {
      const json = JSON.stringify({
        readingBetweenTheLines: [],
        digDeeper: [],
        multipleChoice: [],
        evidenceFromTheStory: [],
        characterChart: [],
        drawItDetails: [],
        bonusChallenge: ["E1", "E2", "E3", "E4", "E5", "E6", "E7"],
      });
      const data = parseAnswerKey(json);
      expect(data.bonusChallenge).toEqual(["E1", "E2", "E3", "E4", "E5", "E6", "E7"]);
    });

    it("leaves bonusChallenge undefined for legacy answer keys without the field", () => {
      const json = JSON.stringify({
        readingBetweenTheLines: [],
        digDeeper: [],
        multipleChoice: [],
        evidenceFromTheStory: [],
        characterChart: [],
        drawItDetails: [],
      });
      const data = parseAnswerKey(json);
      expect(data.bonusChallenge).toBeUndefined();
    });
  });

  describe("validateMultipleChoiceAnswerLetters", () => {
    const mcHtml = [
      '<div class="mc-item"><div class="question">Who takes Heidi up the mountain?</div><ul class="mc-options"><li>A. Grandfather</li><li>B. Deta</li><li>C. Peter</li><li>D. Grandmother</li></ul></div>',
      '<div class="mc-item"><div class="question">What does Heidi remove on the way up?</div><ul class="mc-options"><li>A. Hat</li><li>B. Shoes</li><li>C. Coat</li><li>D. Dress</li></ul></div>',
      '<div class="mc-item"><div class="question">Where does Grandfather live?</div><ul class="mc-options"><li>A. Village</li><li>B. Mountain</li><li>C. City</li><li>D. Farm</li></ul></div>',
    ].join("\n");

    it("passes when every correctLetter matches an option in the matching MC item", () => {
      expect(() =>
        validateMultipleChoiceAnswerLetters(mcHtml, [
          { correctLetter: "B" },
          { correctLetter: "C" },
          { correctLetter: "B" },
        ]),
      ).not.toThrow();
    });

    it("throws when correctLetter points to a letter not present in that MC item", () => {
      const truncatedHtml = mcHtml.replace(
        '<li>A. Hat</li><li>B. Shoes</li><li>C. Coat</li><li>D. Dress</li>',
        '<li>A. Hat</li><li>B. Shoes</li><li>C. Coat</li>',
      );
      expect(() =>
        validateMultipleChoiceAnswerLetters(truncatedHtml, [
          { correctLetter: "B" },
          { correctLetter: "D" },
          { correctLetter: "B" },
        ]),
      ).toThrow(/multipleChoice\[1\]\.correctLetter "D" is not one of the options/);
    });

    it("throws when the MC HTML and the answers JSON have different item counts", () => {
      expect(() =>
        validateMultipleChoiceAnswerLetters(mcHtml, [
          { correctLetter: "B" },
          { correctLetter: "C" },
        ]),
      ).toThrow(/2 answer\(s\) but the workbook HTML has 3 multiple choice item\(s\)/);
    });

    it("throws when an MC item is missing its options entirely", () => {
      const noOptionsHtml = '<div class="mc-item"><div class="question">Q?</div><ul class="mc-options"></ul></div>';
      expect(() =>
        validateMultipleChoiceAnswerLetters(noOptionsHtml, [{ correctLetter: "A" }]),
      ).toThrow(/found: none/);
    });
  });

  describe("validateAnswerKeyQuestionsMatchHtml", () => {
    const TATS_QS = [
      "Who takes Heidi up the mountain?",
      "What does Heidi do with her extra clothes?",
      "Where does Grandfather live?",
      "What does Deta tell Peter about Grandfather?",
      "When does Heidi first smile?",
      "What animals does Peter tend?",
    ];
    const RBTL_QS = [
      "Why might Heidi feel nervous meeting Grandfather?",
      "What clues show that Heidi is adventurous?",
      "Why does Deta walk quickly up the path?",
    ];
    const DD_QS = [
      "How does the mountain symbolize Heidi's freedom?",
      "Compare how Deta and the villagers view Grandfather.",
      "What does this chapter suggest about adapting to change?",
    ];
    const MC_QS = [
      "Who takes Heidi to Grandfather?",
      "What does Heidi remove on the way up?",
      "Where does Grandfather live?",
    ];
    const ETS_QS = [
      "Find evidence that Heidi enjoys the mountain.",
      "Find evidence of Deta's hurry.",
      "Find evidence that Grandfather is isolated.",
    ];

    function listHtml(questions: string[]): string {
      return `<ol class="question-list">${questions
        .map(
          (q) =>
            `<li class="question-item"><div class="question">${q}</div><div class="answer-space"></div></li>`,
        )
        .join("")}</ol>`;
    }

    function mcHtml(questions: string[]): string {
      return questions
        .map(
          (q) =>
            `<div class="mc-item"><div class="question">${q}</div><ul class="mc-options"><li>A. x</li><li>B. y</li><li>C. z</li><li>D. w</li></ul></div>`,
        )
        .join("\n");
    }

    function makeCoreQuestions(overrides: Partial<ParsedCoreQuestions> = {}): ParsedCoreQuestions {
      return {
        think_about_the_story: listHtml(TATS_QS),
        reading_between_the_lines: listHtml(RBTL_QS),
        dig_deeper: listHtml(DD_QS),
        multiple_choice_questions: mcHtml(MC_QS),
        evidence_from_the_story: listHtml(ETS_QS),
        ...overrides,
      };
    }

    function makeAnswers(overrides: {
      tats?: string[];
      rbtl?: string[];
      dd?: string[];
      mc?: string[];
      ets?: string[];
    } = {}) {
      const tats = overrides.tats ?? TATS_QS;
      const rbtl = overrides.rbtl ?? RBTL_QS;
      const dd = overrides.dd ?? DD_QS;
      const mc = overrides.mc ?? MC_QS;
      const ets = overrides.ets ?? ETS_QS;
      return {
        thinkAboutTheStory: {
          answers: tats.map((q, i) => ({ question: q, answer: "a", page: i + 1 })),
        },
        answerKey: {
          readingBetweenTheLines: rbtl.map((q, i) => ({ question: q, answer: "a", page: i + 1 })),
          digDeeper: dd.map((q, i) => ({ question: q, answer: "a", page: i + 1 })),
          multipleChoice: mc.map((q) => ({
            question: q,
            correctLetter: "A" as const,
            rationale: "r",
          })),
          evidenceFromTheStory: ets.map((q, i) => ({
            question: q,
            sampleAnswer: "s",
            quote: "q",
            page: i + 1,
          })),
        },
      };
    }

    it("passes when every section's answer questions exactly match the workbook HTML questions", () => {
      expect(() =>
        validateAnswerKeyQuestionsMatchHtml(makeCoreQuestions(), makeAnswers()),
      ).not.toThrow();
    });

    it("tolerates whitespace differences (leading/trailing/internal collapse) and inner HTML tags", () => {
      const tatsWithTags = TATS_QS.map((q, i) =>
        i === 0 ? `<em>${q}</em>` : i === 1 ? `  ${q}  ` : q,
      );
      const answers = makeAnswers({
        tats: TATS_QS.map((q, i) => (i === 1 ? q.replace(/ /g, "  ") : q)),
      });
      expect(() =>
        validateAnswerKeyQuestionsMatchHtml(
          makeCoreQuestions({ think_about_the_story: listHtml(tatsWithTags) }),
          answers,
        ),
      ).not.toThrow();
    });

    it("fails loudly when Claude paraphrases a TATS question in the answers JSON", () => {
      const answers = makeAnswers({
        tats: [
          "Who is the person taking Heidi up the mountain?", // paraphrased
          ...TATS_QS.slice(1),
        ],
      });
      expect(() =>
        validateAnswerKeyQuestionsMatchHtml(makeCoreQuestions(), answers),
      ).toThrow(/thinkAboutTheStory\[0\] question text does not match/);
    });

    it("fails loudly when Claude reorders RBTL questions in the answers JSON (swap indices)", () => {
      const answers = makeAnswers({
        rbtl: [RBTL_QS[1], RBTL_QS[0], RBTL_QS[2]],
      });
      expect(() =>
        validateAnswerKeyQuestionsMatchHtml(makeCoreQuestions(), answers),
      ).toThrow(/readingBetweenTheLines\[0\] question text does not match/);
    });

    it("fails when an MC answer question text does not match the workbook MC HTML", () => {
      const answers = makeAnswers({
        mc: [MC_QS[0], "What does Heidi take off on the way up?", MC_QS[2]],
      });
      expect(() =>
        validateAnswerKeyQuestionsMatchHtml(makeCoreQuestions(), answers),
      ).toThrow(/multipleChoice\[1\] question text does not match/);
    });

    it("fails when an Evidence-from-the-Story question is paraphrased", () => {
      const answers = makeAnswers({
        ets: [ETS_QS[0], ETS_QS[1], "Show that Grandfather lives alone."],
      });
      expect(() =>
        validateAnswerKeyQuestionsMatchHtml(makeCoreQuestions(), answers),
      ).toThrow(/evidenceFromTheStory\[2\] question text does not match/);
    });

    it("fails when a Dig Deeper question count is different between HTML and answers JSON", () => {
      const answers = makeAnswers({ dd: DD_QS.slice(0, 2) });
      expect(() =>
        validateAnswerKeyQuestionsMatchHtml(makeCoreQuestions(), answers),
      ).toThrow(/digDeeper has 2 answer\(s\) but the workbook HTML has 3 question\(s\)/);
    });

    it("error message includes both the workbook and answers-JSON snippets so the offending pair is visible", () => {
      const answers = makeAnswers({
        rbtl: ["Totally different question?", RBTL_QS[1], RBTL_QS[2]],
      });
      try {
        validateAnswerKeyQuestionsMatchHtml(makeCoreQuestions(), answers);
        throw new Error("expected validator to throw");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        expect(msg).toContain('Workbook: "Why might Heidi feel nervous meeting Grandfather?"');
        expect(msg).toContain('Answers JSON: "Totally different question?"');
      }
    });
  });

  describe("parseHomeschoolParentGuide", () => {
    const validJson = () =>
      JSON.stringify({
        chapterSnapshot: { synopsis: "S", whyThisMatters: "W" },
        pacingTips: {
          day1: "D1",
          day2: "D2",
          day3: "D3",
          pausePoints: ["p1"],
          stoppingPoints: ["s1"],
        },
        discussionQuestions: {
          understanding: ["u1", "u2", "u3"],
          thinkingDeeper: ["t1", "t2", "t3"],
          personalConnections: ["c1", "c2", "c3"],
        },
        simpleActivity: {
          name: "Activity",
          materials: ["m1"],
          steps: ["step1", "step2", "step3"],
          bonusChallenge: "bonus",
        },
        parentNotes: { contentAwareness: ["ca"], vocabTips: ["vt"], wordsToExplain: ["w1", "w2"] },
        encouragement: { paragraph: "para", reminders: ["r1", "r2"] },
      });

    it("parses a valid payload", () => {
      const data = parseHomeschoolParentGuide(validJson());
      expect(data.chapterSnapshot.synopsis).toBe("S");
      expect(data.pacingTips.day3).toBe("D3");
      expect(data.discussionQuestions.thinkingDeeper).toHaveLength(3);
      expect(data.simpleActivity.steps).toHaveLength(3);
    });

    it("treats missing or empty day3 as undefined", () => {
      const obj = JSON.parse(validJson());
      delete obj.pacingTips.day3;
      const data = parseHomeschoolParentGuide(JSON.stringify(obj));
      expect(data.pacingTips.day3).toBeUndefined();

      obj.pacingTips.day3 = "  ";
      const data2 = parseHomeschoolParentGuide(JSON.stringify(obj));
      expect(data2.pacingTips.day3).toBeUndefined();
    });

    it("throws when a required nested field is missing", () => {
      const obj = JSON.parse(validJson());
      delete obj.encouragement.paragraph;
      expect(() => parseHomeschoolParentGuide(JSON.stringify(obj))).toThrow(
        /encouragement\.paragraph/,
      );
    });
  });

  describe("parseStandardsMapping", () => {
    it("parses a valid payload", () => {
      const json = JSON.stringify({
        rows: [
          { code: "RL.3.1", howAddressed: "ha", assessmentEvidence: "ae" },
          { code: "W.3.3", howAddressed: "ha2", assessmentEvidence: "ae2" },
        ],
      });
      const data = parseStandardsMapping(json);
      expect(data.rows).toHaveLength(2);
      expect(data.rows[0].code).toBe("RL.3.1");
      expect(data.rows[1].assessmentEvidence).toBe("ae2");
    });

    it("accepts an empty rows array", () => {
      const data = parseStandardsMapping(JSON.stringify({ rows: [] }));
      expect(data.rows).toEqual([]);
    });

    it("throws on missing assessmentEvidence", () => {
      const json = JSON.stringify({
        rows: [{ code: "RL.3.1", howAddressed: "ha" }],
      });
      expect(() => parseStandardsMapping(json)).toThrow(/rows\[0\]\.assessmentEvidence/);
    });
  });

  describe("validateStandardsMappingCodes", () => {
    const row = (code: string) => ({ code, howAddressed: "ha", assessmentEvidence: "ae" });

    it("passes when codes match expected in order", () => {
      expect(() =>
        validateStandardsMappingCodes(
          ["RL.3.1", "W.3.3"],
          { rows: [row("RL.3.1"), row("W.3.3")] },
        ),
      ).not.toThrow();
    });

    it("throws when a row is missing", () => {
      expect(() =>
        validateStandardsMappingCodes(["RL.3.1", "W.3.3"], { rows: [row("RL.3.1")] }),
      ).toThrow(/expected 2 row\(s\).*got 1/);
    });

    it("throws when an extra row is present", () => {
      expect(() =>
        validateStandardsMappingCodes(
          ["RL.3.1"],
          { rows: [row("RL.3.1"), row("W.3.3")] },
        ),
      ).toThrow(/expected 1 row\(s\).*got 2/);
    });

    it("throws when codes are reordered", () => {
      expect(() =>
        validateStandardsMappingCodes(
          ["RL.3.1", "W.3.3"],
          { rows: [row("W.3.3"), row("RL.3.1")] },
        ),
      ).toThrow(/rows\[0\]\.code "W\.3\.3" does not match expected "RL\.3\.1"/);
    });

    it("throws when a code is invented (not in expected)", () => {
      expect(() =>
        validateStandardsMappingCodes(["RL.3.1"], { rows: [row("L.3.4")] }),
      ).toThrow(/rows\[0\]\.code "L\.3\.4" does not match expected "RL\.3\.1"/);
    });
  });
});
