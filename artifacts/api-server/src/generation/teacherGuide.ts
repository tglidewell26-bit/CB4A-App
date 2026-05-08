import { anthropic, CLAUDE_MODEL } from "../ai/anthropic.js";
import {
  buildTeacherSectionSystemPrompt,
  buildTeacherSectionUserPrompt,
} from "../prompts/teacherGuidePrompts.js";
import type { VocabularyWord } from "../vocabulary/types.js";
import type { GradeLevel } from "../standards/types.js";
import { TEACHER_GUIDE_SECTIONS } from "./sectionSchema.js";
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
import type { StudentWorkbookResult, ParsedCoreQuestions } from "./studentWorkbook.js";

/**
 * HTML slices extracted from the rendered workbook HTML. Used only for
 * sections not covered by the co-generated coreQuestions (MC, ETS, char
 * chart, draw-it). The three core question sections (TATS, RBTL, DD) are
 * read directly from coreQuestions to avoid fragile regex extraction.
 */
interface ParsedWorkbookSlices {
  multipleChoice: string;
  evidenceFromTheStory: string;
  characterChart: string;
  drawIt: string;
  wordsToKnow: string;
}

function extractWorkbookSection(studentWorkbookHtml: string, key: string): string {
  const rx = new RegExp(
    `<div class="wb-section" data-section-key="${key}">([\\s\\S]*?)<\/div>\s*(?=<div class="wb-section"|<\/div>\s*$)`,
  );
  return studentWorkbookHtml.match(rx)?.[1]?.trim() ?? "";
}

function extractQuestionOnlySection(sectionHtml: string): string {
  if (!sectionHtml) return "";
  const questions = [...sectionHtml.matchAll(/<div class="question">[\s\S]*?<\/div>/g)].map((m) => m[0]);
  return questions.length > 0 ? questions.join("\n") : sectionHtml;
}

export function extractMultipleChoiceItems(sectionHtml: string): string {
  if (!sectionHtml) return "";
  const items = [
    ...sectionHtml.matchAll(/<div[^>]*class="[^"]*\bmc-item\b[^"]*"[^>]*>[\s\S]*?<\/ul>\s*<\/div>/g),
  ].map((m) => m[0]);
  if (items.length > 0) return items.join("\n");
  return extractQuestionOnlySection(sectionHtml);
}

/**
 * Extracts plain-text question strings from a core question section's raw HTML.
 * Each <div class="question">...</div> becomes a numbered line.
 */
function extractQuestionTexts(sectionHtml: string): string {
  const questions = [...sectionHtml.matchAll(/<div class="question">([\s\S]*?)<\/div>/g)]
    .map((m) => m[1].replace(/<[^>]+>/g, "").trim());
  return questions.map((q, i) => `${i + 1}. ${q}`).join("\n");
}

function parseWorkbookSlices(workbookHtml: string): ParsedWorkbookSlices {
  return {
    multipleChoice: extractMultipleChoiceItems(extractWorkbookSection(workbookHtml, "multiple_choice_questions")),
    evidenceFromTheStory: extractQuestionOnlySection(extractWorkbookSection(workbookHtml, "evidence_from_the_story")),
    characterChart: extractWorkbookSection(workbookHtml, "character_chart"),
    drawIt: extractWorkbookSection(workbookHtml, "draw_it"),
    wordsToKnow: extractWorkbookSection(workbookHtml, "words_to_know"),
  };
}

/**
 * Builds the workbookContext record for a given teacher guide section key.
 *
 * Core question sections (TATS, RBTL, DD) use the co-generated coreQuestions
 * HTML directly — this avoids the fragile regex extraction that caused empty
 * answer keys and blank focus questions.
 *
 * Template sections (MC, ETS, char chart, draw-it) still come from the
 * HTML-extracted slices, which are simpler and more reliably structured.
 */
function workbookContextForTeacherSection(
  sectionKey: string,
  slices: ParsedWorkbookSlices,
  coreQuestions: ParsedCoreQuestions,
): Record<string, string> {
  switch (sectionKey) {
    case "words_to_know_mini_lesson":
      return { wordsToKnow: slices.wordsToKnow };
    case "think_about_the_story_answers":
      return {
        thinkAboutTheStory: coreQuestions.think_about_the_story,
        thinkAboutTheStoryQuestions: extractQuestionTexts(coreQuestions.think_about_the_story),
      };
    case "answer_key":
      return {
        readingBetweenTheLines: coreQuestions.reading_between_the_lines,
        readingBetweenTheLinesQuestions: extractQuestionTexts(coreQuestions.reading_between_the_lines),
        digDeeper: coreQuestions.dig_deeper,
        digDeeperQuestions: extractQuestionTexts(coreQuestions.dig_deeper),
        multipleChoice: slices.multipleChoice,
        evidenceFromTheStory: slices.evidenceFromTheStory,
        characterChart: slices.characterChart,
        drawIt: slices.drawIt,
      };
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
  coreQuestions: ParsedCoreQuestions,
  focusQuestion: string,
  sectionDisplayTitle: string,
): Promise<string> {
  if (sectionKey === "lesson_overview") {
    return renderLessonOverview();
  }
  if (sectionKey === "materials_needed") {
    return renderMaterialsNeeded(meta);
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
    workbookContext: workbookContextForTeacherSection(sectionKey, slices, coreQuestions),
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
    case "think_about_the_story_answers":
      return renderThinkAboutTheStoryAnswers(parseThinkAboutTheStoryAnswers(rawJson));
    case "answer_key":
      return renderAnswerKey(parseAnswerKey(rawJson));
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
  const workbookSlices = parseWorkbookSlices(workbookResult.html);

  const generatedSections: GeneratedSection[] = [];

  for (const section of TEACHER_GUIDE_SECTIONS) {
    const bodyHtml = await generateSectionBody(
      section.key,
      meta,
      chapterText,
      chapterLabel,
      vocabulary,
      workbookSlices,
      workbookResult.coreQuestions,
      workbookResult.focusQuestion,
      section.display_title,
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
