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

export type { BookCharacterDatabase, ChapterMeta } from "./templateRenderers.js";

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
): Promise<ParsedCoreQuestions> {
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

export async function generateStudentWorkbook(
  meta: ChapterMeta,
  vocabulary: VocabularyWord[],
): Promise<string> {
  const chapterText = truncateText(meta.extractedText);
  const chapterLabel = getChapterLabel(meta);
  const wordsToKnowTableHtml = buildWordsToKnowTableHtml(vocabulary);

  const coreQuestions = await generateCoreQuestionsCombined(
    meta,
    vocabulary,
    chapterLabel,
    chapterText,
  );

  const generatedSections: GeneratedSection[] = [];

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

  validateSections(generatedSections, STUDENT_WORKBOOK_SECTIONS, "Student Workbook", meta);

  const headerHtml = `<div class="wb-header">
  <div class="wb-title">Student Workbook</div>
  <div class="wb-meta">${meta.bookTitle} · ${chapterLabel} · Grade ${meta.grade}</div>
</div>`;

  const sectionHtml = generatedSections.map(renderStudentWorkbookSection).join("\n");
  return stripLeadingQuestionNumbers(`<div class="workbook">\n${headerHtml}\n${sectionHtml}\n</div>`);
}
