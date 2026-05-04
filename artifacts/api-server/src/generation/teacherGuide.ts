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
import {
  validateQuestionTypeTags,
  validateSections,
  validateTeacherGuideSectionStructure,
} from "./workbookValidators.js";

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

function parseWorkbookSlices(studentWorkbookHtml: string): ParsedWorkbookSlices {
  const wordsToKnow = extractWorkbookSection(studentWorkbookHtml, "words_to_know");
  const sectionNames = [...studentWorkbookHtml.matchAll(/<h2>([^<]+)<\/h2>/g)].map((m) => m[1].trim());

  return {
    thinkAboutTheStory: extractQuestionOnlySection(extractWorkbookSection(studentWorkbookHtml, "think_about_the_story")),
    readingBetweenTheLines: extractQuestionOnlySection(extractWorkbookSection(studentWorkbookHtml, "reading_between_the_lines")),
    digDeeper: extractQuestionOnlySection(extractWorkbookSection(studentWorkbookHtml, "dig_deeper")),
    multipleChoice: extractQuestionOnlySection(extractWorkbookSection(studentWorkbookHtml, "multiple_choice_questions")),
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

function buildMaterialsNeededHtml(meta: ChapterMeta): string {
  return `<p>Materials needed</p>
<ul>
  <li>${meta.bookTitle}, by ${meta.author} (Classic Books for All edition), Chapter ${meta.chapterNum}, for each student.</li>
  <li>Classic Books for All ${meta.bookTitle} Student Workbook.</li>
  <li>Chart paper or whiteboard for class discussions.</li>
  <li>Sticky notes for exit tickets.</li>
  <li>Pencils, crayons/markers for graphic organizers.</li>
</ul>`;
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
    const standingSubheader = section.standing_subheader
      ? applyStandingSubstitutions(section.standing_subheader, meta.chapterNum)
      : null;

    let bodyHtml: string;
    if (section.key === "materials_needed") {
      bodyHtml = buildMaterialsNeededHtml(meta);
    } else if (section.body_source === "manual") {
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
        workbookContext: workbookContextForTeacherSection(section.key, workbookSlices),
        chapterText,
        priorSections: generatedSections,
      };
      const systemPrompt = buildTeacherSectionSystemPrompt(promptInputs);
      const userPrompt = buildTeacherSectionUserPrompt(promptInputs);
      console.info(`tg_prompt_size:${section.key}:system=${systemPrompt.length}:user=${userPrompt.length}:total=${systemPrompt.length + userPrompt.length}`);
      const rawBodyHtml = await generateLlmSectionBody(systemPrompt, userPrompt);
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

    if (section.key === "guided_reading") {
      validateQuestionTypeTags(generated);
    }

    if (section.body_source === "llm") {
      validateTeacherGuideSectionStructure(generated, meta);
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
