import { anthropic, CLAUDE_MODEL } from "../ai/anthropic.js";
import {
  buildCoreQuestionsCombinedSystemPrompt,
  buildCoreQuestionsCombinedUserPrompt,
  buildStudentSectionSystemPrompt,
  buildStudentSectionUserPrompt,
  CORE_QUESTION_SECTION_KEYS,
  parseCoreQuestionsResponse,
  type CoreQuestionSectionKey,
  type ParsedCoreQuestions,
  type ParsedCoreQuestionsResponse,
} from "../prompts/workbookSectionPrompts.js";
import type { VocabularyWord } from "../vocabulary/types.js";
import {
  applyStandingSubstitutions,
  enforceSingleSentenceItems,
  sanitizeLlmBodyHtml,
  sanitizeLogLine,
  stripLeadingQuestionNumbers,
} from "./htmlSanitizer.js";
import { STUDENT_WORKBOOK_SECTIONS } from "./sectionSchema.js";
import {
  buildManualSlot,
  buildTemplateSectionBody,
  buildWordsToKnowTableHtml,
  getChapterLabel,
  renderStudentWorkbookSection,
  truncateText,
  type ChapterMeta,
  type GeneratedSection,
} from "./templateRenderers.js";
import { validateSections } from "./workbookValidators.js";
import {
  parseThinkAboutTheStoryAnswers,
  parseAnswerKey,
} from "./teacherGuideJsonParsers.js";
import type { ThinkAboutTheStoryAnswersData, AnswerKeyData } from "./teacherGuideTypes.js";

export type { BookCharacterDatabase, ChapterMeta } from "./templateRenderers.js";
export type { ParsedCoreQuestions };

/**
 * Pre-generated teacher-facing answers co-produced during student workbook
 * creation. The Teacher Guide renders both sections directly from this data —
 * no second Claude call is needed for think_about_the_story_answers or
 * answer_key.
 */
export interface StudentWorkbookAnswers {
  thinkAboutTheStory: ThinkAboutTheStoryAnswersData;
  answerKey: AnswerKeyData;
}

/**
 * The result of generating a student workbook. Returns the rendered HTML plus
 * the co-generated structured data needed by the Teacher Guide so it does not
 * have to re-derive them from the HTML via fragile regex extraction.
 */
export interface StudentWorkbookResult {
  /** Fully rendered student workbook HTML. */
  html: string;
  /**
   * Raw HTML body for each core question section (think_about_the_story,
   * reading_between_the_lines, dig_deeper, multiple_choice_questions,
   * evidence_from_the_story). The Teacher Guide reads question text directly
   * from these strings instead of parsing the full workbook HTML.
   */
  coreQuestions: ParsedCoreQuestions;
  /**
   * The plain-text focus question from the get_ready_to_read section. Passed
   * directly to the Teacher Guide to avoid regex extraction from the workbook.
   */
  focusQuestion: string;
  /**
   * Pre-generated answers for the Teacher Guide. Eliminates Claude calls for
   * think_about_the_story_answers and answer_key in the teacher guide pipeline.
   */
  answers: StudentWorkbookAnswers;
}

const CORE_QUESTION_KEY_SET: ReadonlySet<string> = new Set(CORE_QUESTION_SECTION_KEYS);

async function generateLlmSectionBody(systemPrompt: string, userPrompt: string): Promise<string> {
  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const block = message.content[0];
  return block.type === "text" ? block.text.trim() : "";
}

async function generateCoreQuestionsCombined(
  meta: ChapterMeta,
  vocabulary: VocabularyWord[],
  chapterLabel: string,
  chapterText: string,
): Promise<ParsedCoreQuestionsResponse> {
  const promptInputs = {
    bookTitle: meta.bookTitle,
    author: meta.author,
    chapterLabel,
    pages: meta.pages,
    grade: meta.grade,
    vocabulary,
    chapterText,
  };
  const raw = await generateLlmSectionBody(
    buildCoreQuestionsCombinedSystemPrompt(promptInputs),
    buildCoreQuestionsCombinedUserPrompt(promptInputs),
  );
  return parseCoreQuestionsResponse(raw);
}

/**
 * Parses the raw answers JSON string from the combined core questions call
 * into typed StudentWorkbookAnswers. Re-uses the existing Teacher Guide JSON
 * parsers for full field-level validation.
 */
function parseWorkbookAnswers(answersJsonRaw: string): StudentWorkbookAnswers {
  const cleaned = answersJsonRaw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

  let root: Record<string, unknown>;
  try {
    const data = JSON.parse(cleaned);
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      throw new Error("root must be a JSON object");
    }
    root = data as Record<string, unknown>;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to parse workbook answers JSON: ${message}. First 300 chars: ${cleaned.slice(0, 300)}`,
    );
  }

  const thinkAboutTheStory = parseThinkAboutTheStoryAnswers(
    JSON.stringify(root.thinkAboutTheStory ?? {}),
  );

  const answerKey = parseAnswerKey(
    JSON.stringify({
      readingBetweenTheLines: root.readingBetweenTheLines,
      digDeeper: root.digDeeper,
      multipleChoice: root.multipleChoice,
      evidenceFromTheStory: root.evidenceFromTheStory,
      characterChart: root.characterChart,
      drawItDetails: root.drawItDetails,
    }),
  );

  return { thinkAboutTheStory, answerKey };
}

/**
 * Extracts the plain-text focus question from the raw get_ready_to_read body
 * HTML returned by the LLM. Returns an empty string if the expected structure
 * is not found (the Teacher Guide handles empty gracefully with a fallback).
 */
function extractFocusQuestionText(rawBodyHtml: string): string {
  const match = rawBodyHtml.match(/<div class="focus-question">[\s\S]*?<p>([\s\S]*?)<\/p>/);
  return match?.[1]?.replace(/<[^>]+>/g, "").trim() ?? "";
}

export async function generateStudentWorkbook(
  meta: ChapterMeta,
  vocabulary: VocabularyWord[],
): Promise<StudentWorkbookResult> {
  const chapterText = truncateText(meta.extractedText);
  const chapterLabel = getChapterLabel(meta);
  const wordsToKnowTableHtml = buildWordsToKnowTableHtml(vocabulary);

  const coreResponse = await generateCoreQuestionsCombined(
    meta,
    vocabulary,
    chapterLabel,
    chapterText,
  );
  const coreQuestions = coreResponse.questions;
  const workbookAnswers = parseWorkbookAnswers(coreResponse.answersJsonRaw);

  const generatedSections: GeneratedSection[] = [];
  let focusQuestion = "";

  for (const section of STUDENT_WORKBOOK_SECTIONS) {
    const standingSubheader = section.standing_subheader
      ? applyStandingSubstitutions(section.standing_subheader, meta.chapterNum)
      : null;

    const isCoreQuestionSection = CORE_QUESTION_KEY_SET.has(section.key);
    const shouldCallLlm =
      !isCoreQuestionSection &&
      (section.body_source === "llm" ||
        (section.body_source === "template" && ["draw_it", "bonus_challenge"].includes(section.key)));

    let rawBodyHtml: string;
    if (isCoreQuestionSection) {
      rawBodyHtml = coreQuestions[section.key as CoreQuestionSectionKey];
    } else if (!shouldCallLlm) {
      rawBodyHtml = section.body_source === "manual" ? buildManualSlot(section.display_title) : "";
    } else {
      const promptInputs = {
        sectionKey: section.key,
        bookTitle: meta.bookTitle,
        author: meta.author,
        chapterLabel,
        pages: meta.pages,
        grade: meta.grade,
        vocabulary,
        sectionDisplayTitle: section.display_title,
        standingSubheader,
        chapterText,
      };
      rawBodyHtml = await generateLlmSectionBody(
        buildStudentSectionSystemPrompt(promptInputs),
        buildStudentSectionUserPrompt(promptInputs),
      );
    }

    if (section.key === "get_ready_to_read" && rawBodyHtml) {
      focusQuestion = extractFocusQuestionText(rawBodyHtml);
    }

    const runSanitizer = shouldCallLlm || isCoreQuestionSection;
    const sanitized = runSanitizer
      ? sanitizeLlmBodyHtml(rawBodyHtml, section)
      : { cleaned: rawBodyHtml, removed: [] };
    console.info(sanitizeLogLine(section.key, sanitized.removed));

    if (section.key === "words_to_know" && sanitized.cleaned.trim() !== "WORDS_TO_KNOW_TABLE_PLACEHOLDER") {
      throw new Error(
        'Student Workbook validation failed: words_to_know must output only "WORDS_TO_KNOW_TABLE_PLACEHOLDER".',
      );
    }

    const normalizedBody =
      section.key === "words_to_know"
        ? sanitized.cleaned.replace("WORDS_TO_KNOW_TABLE_PLACEHOLDER", wordsToKnowTableHtml)
        : sanitized.cleaned;
    const sentenceSafeBody = enforceSingleSentenceItems(section.key, normalizedBody);

    const bodyHtml =
      section.body_source === "template"
        ? buildTemplateSectionBody(
            section.key,
            section.key === "draw_it" || section.key === "bonus_challenge" ? sentenceSafeBody : "",
            meta,
          )
        : sentenceSafeBody;

    generatedSections.push({
      key: section.key,
      displayTitle: section.display_title,
      standingSubheader,
      bodySource: section.body_source,
      bodyHtml,
    });
  }

  validateSections(generatedSections, STUDENT_WORKBOOK_SECTIONS, meta);

  const headerHtml = `<div class="wb-header">
  <div class="wb-title">Student Workbook</div>
  <div class="wb-meta">${meta.bookTitle} · ${chapterLabel} · Grade ${meta.grade}</div>
</div>`;

  const sectionHtml = generatedSections.map(renderStudentWorkbookSection).join("\n");
  const html = stripLeadingQuestionNumbers(`<div class="workbook">\n${headerHtml}\n${sectionHtml}\n</div>`);

  return { html, coreQuestions, focusQuestion, answers: workbookAnswers };
}
