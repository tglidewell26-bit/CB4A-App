import { anthropic, CLAUDE_MODEL } from "../ai/anthropic.js";
import {
  buildTeacherSectionSystemPrompt,
  buildTeacherSectionUserPrompt,
} from "../prompts/teacherGuidePrompts.js";
import type { VocabularyWord } from "../vocabulary/types.js";
import {
  applyStandingSubstitutions,
  enforceSingleSentenceItems,
  sanitizeLlmBodyHtml,
  sanitizeLogLine,
} from "./htmlSanitizer.js";
import { TEACHER_GUIDE_SECTIONS } from "./sectionSchema.js";
import {
  buildManualSlot,
  getChapterLabel,
  renderTeacherGuideSection,
  truncateText,
  type ChapterMeta,
  type GeneratedSection,
} from "./templateRenderers.js";
import { validateQuestionTypeTags, validateSections } from "./workbookValidators.js";

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

export async function generateTeacherGuide(
  meta: ChapterMeta,
  studentWorkbookHtml: string,
  vocabulary: VocabularyWord[],
): Promise<string> {
  const chapterText = truncateText(meta.extractedText);
  const chapterLabel = getChapterLabel(meta);

  const generatedSections: GeneratedSection[] = [];

  for (const section of TEACHER_GUIDE_SECTIONS) {
    const standingSubheader = section.standing_subheader
      ? applyStandingSubstitutions(section.standing_subheader, meta.chapterNum)
      : null;

    let bodyHtml: string;
    if (section.body_source === "manual") {
      bodyHtml = buildManualSlot(section.display_title);
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
        studentWorkbookHtml,
        chapterText,
      };
      const rawBodyHtml = await generateLlmSectionBody(
        buildTeacherSectionSystemPrompt(promptInputs),
        buildTeacherSectionUserPrompt(promptInputs),
      );
      const sanitized = sanitizeLlmBodyHtml(rawBodyHtml, section);
      console.info(sanitizeLogLine(`tg:${section.key}`, sanitized.removed));
      bodyHtml = sanitized.cleaned;
    }

    const sentenceSafeBody = enforceSingleSentenceItems(section.key, bodyHtml);

    const generated: GeneratedSection = {
      key: section.key,
      displayTitle: section.display_title,
      standingSubheader,
      bodySource: section.body_source,
      bodyHtml: sentenceSafeBody,
      tipSlots: section.tip_slots,
    };

    if (section.key === "guided_reading" || section.key === "tiered_discussion") {
      validateQuestionTypeTags(generated);
    }

    generatedSections.push(generated);
  }

  validateSections(generatedSections, TEACHER_GUIDE_SECTIONS, "Teacher Guide", meta);

  const headerHtml = `<div class="wb-header">
  <div class="wb-title">Teacher Guide</div>
  <div class="wb-meta">${meta.bookTitle} · ${chapterLabel} · Grade ${meta.grade}</div>
</div>`;

  const sectionHtml = generatedSections.map(renderTeacherGuideSection).join("\n");
  return `<div class="teacher-guide">\n${headerHtml}\n${sectionHtml}\n</div>`;
}
