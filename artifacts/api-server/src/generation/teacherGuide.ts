import { anthropic, CLAUDE_MODEL } from "../ai/anthropic.js";
import {
  buildTeacherSectionSystemPrompt,
  buildTeacherSectionUserPrompt,
} from "../prompts/teacherGuidePrompts.js";
import type { VocabularyWord } from "../vocabulary/types.js";
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

interface ParsedWorkbookSlices {
  thinkAboutTheStory: string;
  readingBetweenTheLines: string;
  digDeeper: string;
  multipleChoice: string;
  evidenceFromTheStory: string;
  characterChart: string;
  drawIt: string;
  wordsToKnow: string;
  sectionNames: string[];
}

function extractWorkbookSection(studentWorkbookHtml: string, key: string): string {
  const rx = new RegExp(
    `<div class="wb-section" data-section-key="${key}">([\\s\\S]*?)<\\/div>\\s*(?=<div class="wb-section"|<\\/div>\\s*$)`,
  );
  return studentWorkbookHtml.match(rx)?.[1]?.trim() ?? "";
}

function extractQuestionOnlySection(sectionHtml: string): string {
  if (!sectionHtml) return "";
  const questions = [...sectionHtml.matchAll(/<div class="question">[\s\S]*?<\/div>/g)].map((m) => m[0]);
  return questions.length > 0 ? questions.join("\n") : sectionHtml;
}

/**
 * Multiple choice questions are wrapped in:
 *   <div class="mc-item">
 *     <div class="question">...</div>
 *     <ul class="mc-options"><li>A. ...</li>...</ul>
 *   </div>
 * The answer-key generator needs the FULL block (question + options) so Claude
 * can name each letter's content. Match terminates on `</ul>\s*</div>` since
 * every mc-item ends with the options list immediately followed by the outer
 * closing div.
 */
export function extractMultipleChoiceItems(sectionHtml: string): string {
  if (!sectionHtml) return "";
  const items = [
    ...sectionHtml.matchAll(/<div[^>]*class="[^"]*\bmc-item\b[^"]*"[^>]*>[\s\S]*?<\/ul>\s*<\/div>/g),
  ].map((m) => m[0]);
  if (items.length > 0) return items.join("\n");
  return extractQuestionOnlySection(sectionHtml);
}

function parseWorkbookSlices(studentWorkbookHtml: string): ParsedWorkbookSlices {
  const wordsToKnow = extractWorkbookSection(studentWorkbookHtml, "words_to_know");
  const sectionNames = [...studentWorkbookHtml.matchAll(/<h2>([^<]+)<\/h2>/g)].map((m) => m[1].trim());

  return {
    thinkAboutTheStory: extractQuestionOnlySection(extractWorkbookSection(studentWorkbookHtml, "think_about_the_story")),
    readingBetweenTheLines: extractQuestionOnlySection(extractWorkbookSection(studentWorkbookHtml, "reading_between_the_lines")),
    digDeeper: extractQuestionOnlySection(extractWorkbookSection(studentWorkbookHtml, "dig_deeper")),
    multipleChoice: extractMultipleChoiceItems(extractWorkbookSection(studentWorkbookHtml, "multiple_choice_questions")),
    evidenceFromTheStory: extractQuestionOnlySection(extractWorkbookSection(studentWorkbookHtml, "evidence_from_the_story")),
    characterChart: extractWorkbookSection(studentWorkbookHtml, "character_chart"),
    drawIt: extractWorkbookSection(studentWorkbookHtml, "draw_it"),
    wordsToKnow,
    sectionNames,
  };
}

function workbookContextForTeacherSection(sectionKey: string, slices: ParsedWorkbookSlices): Record<string, string> {
  switch (sectionKey) {
    case "standards":
      return { sectionNames: slices.sectionNames.join(", ") };
    case "words_to_know_mini_lesson":
      return { wordsToKnow: slices.wordsToKnow };
    case "think_about_the_story_answers":
      return { thinkAboutTheStory: slices.thinkAboutTheStory };
    case "answer_key":
      return {
        readingBetweenTheLines: slices.readingBetweenTheLines,
        digDeeper: slices.digDeeper,
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

/**
 * Render a single Teacher Guide section. For LLM sections this:
 *   1. Builds the JSON-only prompt.
 *   2. Calls Claude.
 *   3. Parses the JSON into typed data (throws on malformed input).
 *   4. Hands the typed data to the section's renderer to produce HTML.
 *
 * Pure-code sections (lesson_overview, materials_needed) skip Claude entirely.
 */
async function generateSectionBody(
  sectionKey: string,
  meta: ChapterMeta,
  chapterText: string,
  chapterLabel: string,
  vocabulary: VocabularyWord[],
  slices: ParsedWorkbookSlices,
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
    grade: meta.grade,
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
      return renderStandards(parseStandards(rawJson));
    case "get_ready_to_read":
      return renderGetReadyToRead(parseGetReadyToRead(rawJson));
    case "words_to_know_mini_lesson":
      return renderWordsToKnowMiniLesson(parseWordsToKnowMiniLesson(rawJson));
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
  studentWorkbookHtml: string,
  vocabulary: VocabularyWord[],
): Promise<string> {
  const chapterText = truncateText(meta.extractedText);
  const chapterLabel = getChapterLabel(meta);
  const workbookSlices = parseWorkbookSlices(studentWorkbookHtml);

  const generatedSections: GeneratedSection[] = [];

  for (const section of TEACHER_GUIDE_SECTIONS) {
    const bodyHtml = await generateSectionBody(
      section.key,
      meta,
      chapterText,
      chapterLabel,
      vocabulary,
      workbookSlices,
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
