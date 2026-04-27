import { anthropic } from "@workspace/integrations-anthropic-ai";
import {
  QUESTION_TYPE_TAGS,
  STUDENT_WORKBOOK_SECTIONS,
  TEACHER_GUIDE_SECTIONS,
  type SectionSchemaEntry,
  type TeacherGuideSectionSchemaEntry,
} from "./section_schema.js";
import type { VocabularyWord } from "./vocabularyExtractor.js";

interface ChapterMeta {
  bookTitle: string;
  author: string;
  chapterNum?: number;
  chapterTitle: string;
  pages: string;
  grade: number;
  extractedText: string;
}

interface GeneratedSection {
  key: string;
  displayTitle: string;
  standingSubheader: string | null;
  bodySource: "llm" | "manual";
  bodyHtml: string;
  tipSlots?: number;
}

function truncateText(text: string, maxChars = 80000): string {
  return text.length <= maxChars ? text : `${text.slice(0, maxChars)}\n\n[Text truncated for length]`;
}

function serializeVocabulary(vocabulary: VocabularyWord[]): string {
  return vocabulary.map((v, i) => `${i + 1}. word="${v.word}" quote="${v.book_quote}" page=${v.page_number}`).join("\n");
}

function buildWordsToKnowTableHtml(vocabulary: VocabularyWord[]): string {
  const rows = vocabulary
    .map(
      (v) => `<tr>
  <td>${v.word}</td>
  <td>__________________________________________</td>
  <td>"${v.book_quote}" (p.${v.page_number})</td>
  <td>__________________________________________</td>
</tr>`,
    )
    .join("\n");

  return `<table class="rubric-table">
  <thead>
    <tr>
      <th>Word</th>
      <th>Definition using context clues</th>
      <th>Sentence from book with page number</th>
      <th>My own sentence</th>
    </tr>
  </thead>
  <tbody>
${rows}
  </tbody>
</table>`;
}

function answerLines(count = 3): string {
  return Array(count).fill('<div class="answer-space"></div>').join("\n");
}

function stripLeadingQuestionNumbers(html: string): string {
  return html
    .replace(/(<div class="question">\s*)(\d+\s*[\.\)]\s*)+/g, "$1")
    .replace(/(<div class="question">\s*)(\d+\s*-\s*)+/g, "$1")
    .replace(/(<li class="question-item">\s*<div class="question">\s*)(\d+\s*[\.\)]\s*)+/g, "$1");
}

function getChapterLabel(meta: ChapterMeta): string {
  return meta.chapterNum ? `Chapter ${meta.chapterNum}: ${meta.chapterTitle}` : meta.chapterTitle;
}

function applyStandingSubstitutions(raw: string, meta: ChapterMeta): string {
  const chapterNumber = meta.chapterNum ? String(meta.chapterNum) : "N";
  return raw
    .replaceAll("[N]", chapterNumber)
    .replaceAll("[count]", "7")
    .replaceAll("[creative response noun]", "letter");
}

function buildManualSlot(sectionName: string): string {
  return `<!-- MANUAL: ${sectionName} -->`;
}

function renderStudentWorkbookSection(section: GeneratedSection): string {
  const subheaderHtml = section.standingSubheader
    ? `\n  <p class="wb-instructions">${section.standingSubheader}</p>`
    : "";
  return `<div class="wb-section" data-section-key="${section.key}">
  <h2>${section.displayTitle}</h2>${subheaderHtml}
  ${section.bodyHtml}
</div>`;
}

function renderTeacherGuideSection(section: GeneratedSection): string {
  const subheaderHtml = section.standingSubheader
    ? `\n  <p class="tg-instructions">${section.standingSubheader}</p>`
    : "";
  const tipHtml = Array(section.tipSlots ?? 0)
    .fill(0)
    .map((_, idx) => `<div class="discussion-note">${buildManualSlot(`TIP ${section.key} ${idx + 1}`)}</div>`)
    .join("\n  ");

  return `<div class="tg-section" data-section-key="${section.key}">
  <h2>${section.displayTitle}</h2>${subheaderHtml}
  ${section.bodyHtml}${tipHtml ? `\n  ${tipHtml}` : ""}
</div>`;
}

function validateSections(
  generatedSections: GeneratedSection[],
  schema: SectionSchemaEntry[] | TeacherGuideSectionSchemaEntry[],
  context: "Student Workbook" | "Teacher Guide",
  meta: ChapterMeta,
): void {
  const requiredKeys = schema.filter((s) => s.required).map((s) => s.key);
  for (const key of requiredKeys) {
    if (!generatedSections.some((s) => s.key === key)) {
      throw new Error(`${context} validation failed: missing required section "${key}".`);
    }
  }

  const generatedOrder = generatedSections.map((s) => s.key).join(" -> ");
  const schemaOrder = schema.map((s) => s.key).join(" -> ");
  if (generatedOrder !== schemaOrder) {
    throw new Error(`${context} validation failed: section order mismatch. Expected ${schemaOrder} but got ${generatedOrder}.`);
  }

  for (let i = 0; i < schema.length; i++) {
    const generated = generatedSections[i];
    const expected = schema[i];
    const expectedSubheader = expected.standing_subheader
      ? applyStandingSubstitutions(expected.standing_subheader, meta)
      : null;
    if (generated.bodySource === "manual" && !generated.bodyHtml.includes("<!-- MANUAL:")) {
      throw new Error(`${context} validation failed: manual slot missing for section "${generated.key}".`);
    }

    if (expectedSubheader !== generated.standingSubheader) {
      throw new Error(`${context} validation failed: standing subheader mismatch in section "${generated.key}".`);
    }
  }
}

function validateQuestionTypeTags(section: GeneratedSection): void {
  const extracted = [...section.bodyHtml.matchAll(/\[question-type:\s*([^\]]+)\]/gi)].map((m) =>
    m[1].trim().toLowerCase(),
  );

  if (extracted.length === 0) {
    throw new Error(`Teacher Guide validation failed: no question-type tags found in section "${section.key}".`);
  }

  for (const tag of extracted) {
    if (!QUESTION_TYPE_TAGS.includes(tag as (typeof QUESTION_TYPE_TAGS)[number])) {
      throw new Error(`Teacher Guide validation failed: invalid question-type tag "${tag}" in section "${section.key}".`);
    }
  }
}

async function generateLlmSectionBody(systemPrompt: string, userPrompt: string): Promise<string> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const block = message.content[0];
  return block.type === "text" ? block.text.trim() : "";
}

function studentSectionRequirementByKey(key: string): string {
  switch (key) {
    case "get_ready_to_read":
      return '<div class="focus-question"><div class="focus-label">FOCUS QUESTION</div><p>...</p></div>';
    case "words_to_know":
      return "Include WORDS_TO_KNOW_TABLE_PLACEHOLDER exactly once.";
    case "think_about_the_story":
      return `<ol class="question-list"><li class="question-item"><div class="question">...</div>${answerLines(2)}</li></ol> with exactly 6 questions.`;
    case "reading_between_the_lines":
      return `<ol class="question-list"><li class="question-item"><div class="question">...</div>${answerLines(2)}</li></ol> with exactly 3 questions.`;
    case "dig_deeper":
      return `<ol class="question-list"><li class="question-item"><div class="question">...</div>${answerLines(2)}</li></ol> with exactly 3 questions.`;
    case "multiple_choice_questions":
      return '<div class="mc-item"><div class="question">...</div><ul class="mc-options"><li>A. ...</li><li>B. ...</li><li>C. ...</li><li>D. ...</li></ul></div> with exactly 3 questions.';
    case "evidence_from_the_story":
      return `<ol class="question-list"><li class="question-item"><div class="question">...</div>${answerLines(3)}</li></ol> with exactly 3 questions.`;
    case "writing_rubric":
      return "Checklist table with exactly 4 criteria rows: I answered the prompt; I included details from Chapter 1; I wrote in Heidi's voice; I checked my spelling and grammar.";
    case "character_chart":
      return "Character table with exactly 5 rows and columns: Character Name, What They Look Like and How They Act, What This Shows About Them.";
    case "draw_it":
      return "Prompt students to draw Heidi climbing the mountain with Peter and the goats.";
    case "reflect_on_your_drawing":
      return "Exactly 3 sentence stems for reflection.";
    case "bonus_challenge":
      return '<ol class="timeline-list"><li>...</li></ol> with exactly 7 scrambled events.';
    case "thinking_deeper":
      return "Prediction question asking what will happen next.";
    default:
      return "Generate only body HTML for this section.";
  }
}

export async function generateStudentWorkbook(meta: ChapterMeta, vocabulary: VocabularyWord[]): Promise<string> {
  const chapterText = truncateText(meta.extractedText);
  const chapterLabel = getChapterLabel(meta);
  const wordsToKnowTableHtml = buildWordsToKnowTableHtml(vocabulary);

  const generatedSections: GeneratedSection[] = [];

  for (const section of STUDENT_WORKBOOK_SECTIONS) {
    const standingSubheader = section.standing_subheader
      ? applyStandingSubstitutions(section.standing_subheader, meta)
      : null;

    const bodyHtml =
      section.body_source === "manual"
        ? buildManualSlot(section.display_title)
        : await generateLlmSectionBody(
            `You are creating one section body for a CB4A Student Workbook as HTML.
Output only the body HTML content (no wrapper section div, no title, no standing subheader).
Never emit the section title or instructional subheader text.
Use only chapter text and provided vocabulary.
Question text must not start with numbering prefixes.
Never use emojis.
Required section key: ${section.key}
Formatting target: ${studentSectionRequirementByKey(section.key)}`,
            `Book: ${meta.bookTitle}
Author: ${meta.author}
Chapter: ${chapterLabel}
Pages: ${meta.pages}
Grade: ${meta.grade}

Vocabulary words (use exactly these words and quotes):
${serializeVocabulary(vocabulary)}

Section title (for your context only, DO NOT output): ${section.display_title}
Standing subheader (for your context only, DO NOT output): ${standingSubheader ?? "None"}

Chapter text:
${chapterText}`,
          );

    const normalizedBody =
      section.key === "words_to_know"
        ? bodyHtml.replace("WORDS_TO_KNOW_TABLE_PLACEHOLDER", wordsToKnowTableHtml)
        : bodyHtml;

    generatedSections.push({
      key: section.key,
      displayTitle: section.display_title,
      standingSubheader,
      bodySource: section.body_source,
      bodyHtml: normalizedBody,
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

function teacherSectionRequirementByKey(key: string): string {
  switch (key) {
    case "guided_reading":
      return `Provide pause-point questions. Every question must include [question-type: ...] where ... is one of: ${QUESTION_TYPE_TAGS.join(", ")}.`;
    case "tiered_discussion":
      return `Provide tiered discussion prompts. Every prompt must include [question-type: ...] where ... is one of: ${QUESTION_TYPE_TAGS.join(", ")}.`;
    case "standards":
      return "If grade is 3, include RL.3.1, RL.3.3, RL.3.4, L.3.4, L.3.5, SL.3.1, SL.3.3, W.3.3.";
    default:
      return "Generate body HTML for this teacher section using chapter text and workbook as source of truth.";
  }
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
      ? applyStandingSubstitutions(section.standing_subheader, meta)
      : null;

    const bodyHtml =
      section.body_source === "manual"
        ? buildManualSlot(section.display_title)
        : await generateLlmSectionBody(
            `You are creating one section body for a CB4A Teacher Guide as HTML.
Output only section body HTML (no wrapper section div, no title, no standing subheader).
Never emit the section title or instructional subheader text.
Mirror student workbook structure and questions where relevant.
Never use emojis.
Required section key: ${section.key}
${teacherSectionRequirementByKey(section.key)}`,
            `Book: ${meta.bookTitle}
Author: ${meta.author}
Chapter: ${chapterLabel}
Pages: ${meta.pages}
Grade: ${meta.grade}

Vocabulary words:
${serializeVocabulary(vocabulary)}

Section title (for your context only, DO NOT output): ${section.display_title}
Standing subheader (for your context only, DO NOT output): ${standingSubheader ?? "None"}

Student workbook (HTML — source of truth):
${studentWorkbookHtml}

Chapter text:
${chapterText}`,
          );

    const generated: GeneratedSection = {
      key: section.key,
      displayTitle: section.display_title,
      standingSubheader,
      bodySource: section.body_source,
      bodyHtml,
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
