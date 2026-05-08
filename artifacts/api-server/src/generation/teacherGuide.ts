import { anthropic, CLAUDE_MODEL } from "../ai/anthropic.js";
import {
  buildTeacherSectionSystemPrompt,
  buildTeacherSectionUserPrompt,
} from "../prompts/teacherGuidePrompts.js";
import type { VocabularyWord } from "../vocabulary/types.js";
import type { GradeLevel } from "../standards/types.js";
import { TEACHER_GUIDE_SECTIONS } from "./sectionSchema.js";
import {
  parseCommonStudentQuestions,
  parseCreativeResponseErrors,
  parseDifferentiatedSupports,
  parseExitTicket,
  parseGetReadyToRead,
  parseGuidedReading,
  parseMeasurableObjectives,
  parseStandards,
  parseWordsToKnowMiniLesson,
} from "./teacherGuideJsonParsers.js";
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
} from "./teacherGuideRenderers.js";
import {
  getChapterLabel,
  renderTeacherGuideSection,
  truncateText,
  type ChapterMeta,
  type GeneratedSection,
} from "./templateRenderers.js";
import type { StudentWorkbookResult, StudentWorkbookAnswers, ParsedCoreQuestions } from "./studentWorkbook.js";

/**
 * HTML slices extracted from the rendered workbook HTML plus the raw core
 * question HTML from the combined generation call.
 *
 * wordsToKnow — used by words_to_know_mini_lesson (still calls Claude).
 * coreQuestions — used by think_about_the_story_answers and answer_key so
 *   their workbook contexts carry correctly numbered question text. Even though
 *   those two sections currently render directly from pre-generated data (no
 *   Claude call), the context is kept accurate so the function remains
 *   testable and correct if the architecture changes.
 */
interface ParsedWorkbookSlices {
  wordsToKnow: string;
  coreQuestions: ParsedCoreQuestions;
}

function extractWorkbookSection(studentWorkbookHtml: string, key: string): string {
  const rx = new RegExp(
    `<div class="wb-section" data-section-key="${key}">([\\s\\S]*?)<\/div>\s*(?=<div class="wb-section"|<\/div>\s*$)`,
  );
  return studentWorkbookHtml.match(rx)?.[1]?.trim() ?? "";
}

function parseWorkbookSlices(workbookHtml: string, coreQuestions: ParsedCoreQuestions): ParsedWorkbookSlices {
  return {
    wordsToKnow: extractWorkbookSection(workbookHtml, "words_to_know"),
    coreQuestions,
  };
}

/**
 * Extracts plain-text question strings from a core question HTML section.
 * Matches every `<div class="question">...</div>` element in order and strips
 * any inner HTML tags, returning the bare question text for each item.
 *
 * Used to surface question text from ParsedCoreQuestions HTML so that callers
 * can verify or reference the questions that were generated for the workbook.
 * Returns an empty array when no questions are found (e.g. empty or malformed
 * HTML).
 */
export function extractQuestionTexts(coreQuestionHtml: string): string[] {
  const questions: string[] = [];
  const pattern = /<div class="question">([\s\S]*?)<\/div>/g;
  let match;
  while ((match = pattern.exec(coreQuestionHtml)) !== null) {
    const text = match[1].replace(/<[^>]+>/g, "").trim();
    if (text) questions.push(text);
  }
  return questions;
}

/**
 * Formats an array of question strings as a numbered list for use as Claude
 * prompt context (e.g. "1. Q1\n2. Q2\n3. Q3").
 */
function formatNumberedQuestions(questions: string[]): string {
  return questions.map((q, i) => `${i + 1}. ${q}`).join("\n");
}

/**
 * Builds the workbookContext record for teacher guide sections.
 *
 * - words_to_know_mini_lesson: passes the rendered words-to-know table HTML.
 * - think_about_the_story_answers: returns the numbered TATS question list so
 *   Claude (or any caller) can copy questions exactly. Currently this section
 *   renders directly from pre-generated data (no Claude call), but the context
 *   is kept accurate for testability and forward compatibility.
 * - answer_key: returns numbered RBTL and Dig Deeper question lists so answers
 *   can be matched exactly to question text. Same note on direct rendering.
 * - All other sections: return an empty context object.
 */
export function workbookContextForTeacherSection(
  sectionKey: string,
  slices: ParsedWorkbookSlices,
): Record<string, string> {
  switch (sectionKey) {
    case "words_to_know_mini_lesson":
      return { wordsToKnow: slices.wordsToKnow };
    case "think_about_the_story_answers": {
      const questions = extractQuestionTexts(slices.coreQuestions.think_about_the_story);
      return { thinkAboutTheStoryQuestions: formatNumberedQuestions(questions) };
    }
    case "answer_key": {
      const rbtlQuestions = extractQuestionTexts(slices.coreQuestions.reading_between_the_lines);
      const ddQuestions = extractQuestionTexts(slices.coreQuestions.dig_deeper);
      return {
        readingBetweenTheLinesQuestions: formatNumberedQuestions(rbtlQuestions),
        digDeeperQuestions: formatNumberedQuestions(ddQuestions),
      };
    }
    default:
      return {};
  }
}

async function callClaudeForJson(systemPrompt: string, userPrompt: string): Promise<string> {
  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const block = message.content[0];
  return block.type === "text" ? block.text.trim() : "";
}

async function generateSectionBody(
  sectionKey: string,
  meta: ChapterMeta,
  chapterText: string,
  chapterLabel: string,
  vocabulary: VocabularyWord[],
  slices: ParsedWorkbookSlices,
  focusQuestion: string,
  sectionDisplayTitle: string,
  answers: StudentWorkbookAnswers,
): Promise<string> {
  if (sectionKey === "lesson_overview") {
    return renderLessonOverview();
  }
  if (sectionKey === "materials_needed") {
    return renderMaterialsNeeded(meta);
  }

  // Direct render from pre-generated data — no Claude call.
  if (sectionKey === "think_about_the_story_answers") {
    return renderThinkAboutTheStoryAnswers(answers.thinkAboutTheStory);
  }
  if (sectionKey === "answer_key") {
    return renderAnswerKey(answers.answerKey);
  }

  const promptInputs = {
    sectionKey,
    bookTitle: meta.bookTitle,
    author: meta.author,
    chapterLabel,
    pages: meta.pages,
    grade: meta.grade as 3 | 4 | 5 | 6 | 7 | 8,
    vocabulary,
    sectionDisplayTitle,
    workbookContext: workbookContextForTeacherSection(sectionKey, slices),
    chapterText,
  };
  const systemPrompt = buildTeacherSectionSystemPrompt(promptInputs);
  const userPrompt = buildTeacherSectionUserPrompt(promptInputs);
  console.info(
    `tg_prompt_size:${sectionKey}:system=${systemPrompt.length}:user=${userPrompt.length}:total=${systemPrompt.length + userPrompt.length}`,
  );
  const rawJson = await callClaudeForJson(systemPrompt, userPrompt);

  switch (sectionKey) {
    case "measurable_objectives":
      return renderMeasurableObjectives(parseMeasurableObjectives(rawJson));
    case "standards":
      return renderStandards(parseStandards(rawJson), meta.grade as GradeLevel);
    case "get_ready_to_read":
      return renderGetReadyToRead(parseGetReadyToRead(rawJson), focusQuestion);
    case "words_to_know_mini_lesson":
      return renderWordsToKnowMiniLesson(parseWordsToKnowMiniLesson(rawJson), vocabulary);
    case "guided_reading":
      return renderGuidedReading(parseGuidedReading(rawJson));
    case "differentiated_supports":
      return renderDifferentiatedSupports(parseDifferentiatedSupports(rawJson));
    case "common_student_questions":
      return renderCommonStudentQuestions(parseCommonStudentQuestions(rawJson));
    case "creative_response_common_errors":
      return renderCreativeResponseErrors(parseCreativeResponseErrors(rawJson));
    case "exit_ticket":
      return renderExitTicket(parseExitTicket(rawJson));
    default:
      throw new Error(`Teacher Guide: no renderer registered for section "${sectionKey}".`);
  }
}

export async function generateTeacherGuide(
  meta: ChapterMeta,
  workbookResult: StudentWorkbookResult,
  vocabulary: VocabularyWord[],
): Promise<string> {
  const chapterText = truncateText(meta.extractedText);
  const chapterLabel = getChapterLabel(meta);
  const workbookSlices = parseWorkbookSlices(workbookResult.html, workbookResult.coreQuestions);

  const generatedSections: GeneratedSection[] = [];

  for (const section of TEACHER_GUIDE_SECTIONS) {
    const bodyHtml = await generateSectionBody(
      section.key,
      meta,
      chapterText,
      chapterLabel,
      vocabulary,
      workbookSlices,
      workbookResult.focusQuestion,
      section.display_title,
      workbookResult.answers,
    );

    generatedSections.push({
      key: section.key,
      displayTitle: section.display_title,
      standingSubheader: section.standing_subheader,
      bodySource: section.body_source,
      bodyHtml,
      tipSlots: section.tip_slots,
    });
  }

  const headerHtml = `<div class="wb-header">
  <div class="wb-title">Teacher Guide</div>
  <div class="wb-meta">${meta.bookTitle} · ${chapterLabel} · Grade ${meta.grade}</div>
</div>`;

  const sectionHtml = generatedSections.map(renderTeacherGuideSection).join("\n");
  return `<div class="teacher-guide">\n${headerHtml}\n${sectionHtml}\n</div>`;
}
