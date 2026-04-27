import { anthropic } from "@workspace/integrations-anthropic-ai";
import {
  DIFFERENTIATION_BLOCKS,
  EXAMPLE_RESPONSE_TIERS,
  QUESTION_TYPE_TAGS,
  READING_STAGES,
  STANDARDS_SUBHEADERS,
  STUDENT_WORKBOOK_SECTIONS,
  TEACHER_GUIDE_SECTIONS,
  TIERED_DISCUSSION_TIERS,
  WORDS_TO_KNOW_ACTIVITIES,
  type StudentWorkbookSectionSchema,
  type TeacherGuideSectionSchema,
} from "./sectionSchema.js";
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

interface ParsedSection {
  title: string;
  bodyHtml: string;
}

interface SanitizationResult {
  html: string;
  log: string[];
}

const STUDENT_TITLE_ALIASES: Record<string, string> = {
  "rubric": "writing rubric",
  "draw it!": "draw it",
  "bonus challenge—follow the story": "bonus challenge-follow the story",
  "bonus challenge - follow the story": "bonus challenge-follow the story",
  "prediction": "thinking deeper",
};

const TEACHER_TITLE_ALIASES: Record<string, string> = {
  "words to know mini-lesson": "words to know",
  "guided reading with pause points": "guided reading",
  "thinking deeper": "thinking deeper / exit ticket",
  "thinking deeper exit ticket": "thinking deeper / exit ticket",
};

const UNAUTHORIZED_CALLOUT_LABELS = [
  "KEY IDEA",
  "NOTE",
  "IMPORTANT",
  "OBJECTIVE",
  "TEACHER TIP",
  "LEARNING TARGET",
];

const QUESTION_TYPE_TAG_SET = new Set<string>(QUESTION_TYPE_TAGS);
const LOCKED_LABEL_SET = new Set<string>([
  ...DIFFERENTIATION_BLOCKS,
  ...READING_STAGES,
  ...TIERED_DISCUSSION_TIERS,
  ...EXAMPLE_RESPONSE_TIERS,
  ...STANDARDS_SUBHEADERS,
  ...WORDS_TO_KNOW_ACTIVITIES,
  "FOCUS QUESTION",
]);

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

function normalizeTitle(title: string, aliases: Record<string, string>): string {
  const base = title.trim().toLowerCase().replace(/[“”]/g, '"');
  return aliases[base] ?? base;
}

function extractSections(html: string, sectionClassName: "wb-section" | "tg-section"): ParsedSection[] {
  const regex = new RegExp(
    `<div class="${sectionClassName}">([\\s\\S]*?)(?=<div class="${sectionClassName}">|$)`,
    "g",
  );
  const out: ParsedSection[] = [];
  for (const match of html.matchAll(regex)) {
    const block = (match[1] ?? "").replace(/<\/div>\s*$/i, "");
    const titleMatch = block.match(/<h2>([\s\S]*?)<\/h2>/i);
    if (!titleMatch) {
      continue;
    }
    const title = titleMatch[1].replace(/<[^>]+>/g, "").trim();
    const bodyHtml = block.replace(/^[\s\S]*?<\/h2>/i, "").trim();
    out.push({ title, bodyHtml });
  }
  return out;
}

function stripUnauthorizedHeadings(body: string, log: string[]): string {
  let out = body;
  out = out.replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, (m) => {
    log.push(`removed heading tag: ${m.slice(0, 60)}`);
    return "";
  });

  out = out.replace(/<p[^>]*>\s*([A-Z][A-Z\s\-]{3,})\s*<\/p>/g, (m, captured: string) => {
    if (LOCKED_LABEL_SET.has(captured.trim())) {
      return m;
    }
    log.push(`removed all-caps heading line: ${captured.trim()}`);
    return "";
  });

  out = out.replace(/(^|\n)\s{0,3}#{1,6}\s+.*(?=\n|$)/g, (m) => {
    log.push(`removed markdown heading: ${m.trim()}`);
    return "";
  });

  return out;
}

function stripUnauthorizedCallouts(body: string, log: string[]): string {
  const labelPattern = new RegExp(`<p[^>]*>\\s*(${UNAUTHORIZED_CALLOUT_LABELS.join("|")})\\s*:?\\s*<\\/p>`, "gi");
  return body.replace(labelPattern, (_m, label: string) => {
    log.push(`removed unauthorized callout label: ${label}`);
    return "";
  });
}

function stripTopIntroParagraph(body: string, log: string[]): string {
  return body.replace(/^(\s*<p class="wb-instructions">[\s\S]*?<\/p>\s*)/i, (m) => {
    log.push(`removed top intro instructions paragraph: ${m.slice(0, 80)}`);
    return "";
  });
}

function stripDisallowedPageReferences(body: string): string {
  return body.replace(/\s*\(?\b(?:page\s*\d+|p\.\s*\d+|pp\.\s*\d+\s*[-–]\s*\d+|pages\s*\d+\s*[-–]\s*\d+)\b\)?/gi, "");
}

function sanitizeStudentSectionBody(sectionId: string, body: string): SanitizationResult {
  const log: string[] = [];
  let out = body;

  out = stripUnauthorizedHeadings(out, log);
  out = stripUnauthorizedCallouts(out, log);
  out = stripTopIntroParagraph(out, log);

  if (sectionId !== "words_to_know") {
    const before = out;
    out = stripDisallowedPageReferences(out);
    if (before !== out) {
      log.push("stripped student page references outside Words to Know");
    }
  }

  if (sectionId === "get_ready_to_read") {
    const focusBoxMatch = out.match(/<div class="focus-question">[\s\S]*?<\/div>/i);
    out = focusBoxMatch ? focusBoxMatch[0] : "";
    log.push("enforced Get Ready to Read focus-only constraint");
  }

  return { html: out.trim(), log };
}

function renderStandingSubheader(section: StudentWorkbookSectionSchema, chapterNum?: number): string {
  if (!section.standingSubheader) {
    return "";
  }
  const resolved = section.standingSubheader
    .replace(/\[N\]/g, String(chapterNum ?? "N"))
    .replace(/\[count\]/g, "7");
  return section.id === "get_ready_to_read" ? "" : `<p class="wb-instructions">${resolved}</p>`;
}

function buildCanonicalStudentWorkbook(html: string, chapterNum?: number): { html: string; log: string[] } {
  const log: string[] = [];
  const parsed = extractSections(html, "wb-section");
  const byTitle = new Map(parsed.map((s) => [normalizeTitle(s.title, STUDENT_TITLE_ALIASES), s]));

  const orderedSections = STUDENT_WORKBOOK_SECTIONS.map((schemaSection) => {
    const key = schemaSection.displayTitle.toLowerCase();
    const parsedSection = byTitle.get(key) ?? byTitle.get(normalizeTitle(schemaSection.displayTitle, STUDENT_TITLE_ALIASES));

    if (!parsedSection && schemaSection.bodySource === "llm") {
      throw new Error(`Validation failed: missing required student section "${schemaSection.displayTitle}".`);
    }

    const rawBody = schemaSection.bodySource === "manual" ? '<div class="manual-slot"></div>' : parsedSection?.bodyHtml ?? "";
    const sanitized = sanitizeStudentSectionBody(schemaSection.id, rawBody);
    log.push(...sanitized.log.map((entry) => `[${schemaSection.id}] ${entry}`));

    if (schemaSection.id === "get_ready_to_read" && !sanitized.html.includes('class="focus-question"')) {
      throw new Error("Validation failed: Get Ready to Read must contain a FOCUS QUESTION box.");
    }

    return `<div class="wb-section"><h2>${schemaSection.displayTitle}</h2>${renderStandingSubheader(schemaSection, chapterNum)}${sanitized.html}</div>`;
  });

  return { html: orderedSections.join("\n"), log };
}

function appendTipPlaceholders(body: string, tipSlots: number): string {
  if (tipSlots <= 0) {
    return body;
  }
  const placeholders = Array.from(
    { length: tipSlots },
    (_, idx) => `<div class="discussion-note">Teaching tip: [Manual tip slot ${idx + 1}]</div>`,
  ).join("\n");
  return `${body}\n${placeholders}`;
}

function validateLockedLabels(html: string): void {
  const tagMatches = [...html.matchAll(/data-question-tag="([^"]+)"/g)];
  for (const m of tagMatches) {
    const tag = m[1]?.trim().toLowerCase();
    if (!QUESTION_TYPE_TAG_SET.has(tag)) {
      throw new Error(`Validation failed: invalid question type tag "${tag}".`);
    }
  }
}

function enforceTeacherGuideOrder(html: string): string {
  const parsed = extractSections(html, "tg-section");
  const byTitle = new Map(parsed.map((s) => [normalizeTitle(s.title, TEACHER_TITLE_ALIASES), s]));

  const ordered = TEACHER_GUIDE_SECTIONS.map((schemaSection: TeacherGuideSectionSchema) => {
    const key = normalizeTitle(schemaSection.displayTitle, TEACHER_TITLE_ALIASES);
    const existing = byTitle.get(key);
    if (!existing && schemaSection.bodySource === "llm") {
      throw new Error(`Validation failed: missing required teacher section "${schemaSection.displayTitle}".`);
    }

    const rawBody = schemaSection.bodySource === "manual" ? '<div class="manual-slot"></div>' : existing?.bodyHtml ?? "";
    return `<div class="tg-section"><h2>${schemaSection.displayTitle}</h2>${appendTipPlaceholders(rawBody, schemaSection.tipSlots)}</div>`;
  });

  return ordered.join("\n");
}

function extractContainerInnerHtml(html: string, containerClass: "workbook" | "teacher-guide"): string {
  const match = html.match(new RegExp(`<div class="${containerClass}">([\\s\\S]*)<\\/div>`, "i"));
  if (!match) {
    throw new Error(`Validation failed: missing root .${containerClass} container.`);
  }
  return match[1] ?? "";
}

export function sanitizeStudentWorkbookHtmlForTesting(html: string, chapterNum?: number): { html: string; log: string[] } {
  const stripped = stripLeadingQuestionNumbers(html);
  const inner = extractContainerInnerHtml(stripped, "workbook");
  return buildCanonicalStudentWorkbook(inner, chapterNum);
}

export async function generateStudentWorkbook(meta: ChapterMeta, vocabulary: VocabularyWord[]): Promise<string> {
  const chapterText = truncateText(meta.extractedText);
  const chapterLabel = meta.chapterNum ? `Chapter ${meta.chapterNum}: ${meta.chapterTitle}` : meta.chapterTitle;

  const wordsToKnowTableHtml = buildWordsToKnowTableHtml(vocabulary);

  const systemPrompt = `You are a curriculum specialist creating a CB4A Student Workbook as an HTML fragment.

Output ONLY the inner HTML — no <!DOCTYPE>, no <html>, no <head>, no <body> tags.
Start your output with: <div class="workbook">
End your output with: </div>

Use EXACTLY these CSS class names (they are pre-styled):
  Sections:        <div class="wb-section"><h2>Section Title</h2>...</div>
  Instructions:    <p class="wb-instructions">...</p>
  Focus box:       <div class="focus-question"><div class="focus-label">FOCUS QUESTION</div><p>...</p></div>
  Words table:     WORDS_TO_KNOW_TABLE_PLACEHOLDER
  Questions (numbered): <ol class="question-list"><li class="question-item"><div class="question">...</div>${answerLines(2)}</li></ol>
  MC question:     <div class="mc-item"><div class="question">...</div><ul class="mc-options"><li>A. ...</li><li>B. ...</li><li>C. ...</li><li>D. ...</li></ul></div>
  Short answer:    <ol class="question-list"><li class="question-item"><div class="question">...</div>${answerLines(3)}</li></ol>
  Creative hints:  <ul class="hints"><li>...</li></ul>
  Writing space:   <div class="writing-space"></div>
  Timeline:        <ol class="timeline-list"><li>...</li></ol>
  Character table: <table class="rubric-table"><thead>...</thead><tbody>...</tbody></table>
  Rubric table:    <table class="rubric-table">...</table>

RULES:
1) Use ONLY chapter text — no outside knowledge.
2) Use ONLY these 10 vocabulary words. Do not add, remove, or replace any words.
3) Sections in this EXACT order: Get Ready to Read · Words to Know · Think About the Story · Reading Between the Lines · Dig Deeper · Evidence from the Story · Multiple Choice · Creative Response · Writing Rubric · Character Chart · Draw It · Reflect on Your Drawing · Bonus Challenge-Follow the Story · Thinking Deeper
4) Generate EXACTLY: 6 Think About the Story, 3 Reading Between the Lines, 3 Dig Deeper, 3 Multiple Choice, 3 Evidence from the Story questions.
5) Page citations are allowed only in Words to Know within the Student Workbook. Student Workbook question stems must NOT include page citations.
6) Words to Know: DO NOT generate definitions/examples. Insert WORDS_TO_KNOW_TABLE_PLACEHOLDER exactly, unchanged.
7) Creative Response must be a LETTER prompt to Deta from Heidi with EXACTLY 3 hint bullet points, followed by a writing space.
8) Writing Rubric must be a checklist table with exactly these 4 criteria rows:
   - I answered the prompt
   - I included details from Chapter 1
   - I wrote in Heidi's voice
   - I checked my spelling and grammar
9) Character Chart must have exactly 5 rows with columns:
   - Character Name
   - What They Look Like and How They Act
   - What This Shows About Them
10) Draw It must tell students to draw Heidi climbing the mountain with Peter and the goats.
11) Reflect on Your Drawing must include exactly 3 sentence stems to reflect on the drawing.
12) Bonus Challenge-Follow the Story must provide exactly 7 scrambled events for students to number 1–7.
13) Thinking Deeper must ask what the reader predicts will happen next.
14) Question text must not start with any numbering prefix (no "1.", "2)", or similar). The UI handles numbering.
15) Never use emojis.
16) Do NOT output section titles or standing instructions; output section body content only inside each section.`;

  const userPrompt = `Book: ${meta.bookTitle}
Author: ${meta.author}
Chapter: ${chapterLabel}
Pages: ${meta.pages}
Grade: ${meta.grade}

Vocabulary words (pre-extracted — use these exact words and quotes):
${serializeVocabulary(vocabulary)}

Chapter text:
${chapterText}`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const block = message.content[0];
  let html = block.type === "text" ? block.text : "";

  html = html.replace("WORDS_TO_KNOW_TABLE_PLACEHOLDER", wordsToKnowTableHtml);

  const headerHtml = `<div class="wb-header">
  <div class="wb-title">Student Workbook</div>
  <div class="wb-meta">${meta.bookTitle} · ${chapterLabel} · Grade ${meta.grade}</div>
</div>`;

  html = html.replace('<div class="workbook">', `<div class="workbook">\n${headerHtml}`);
  html = stripLeadingQuestionNumbers(html);

  const workbookInner = extractContainerInnerHtml(html, "workbook");
  const canonical = buildCanonicalStudentWorkbook(workbookInner, meta.chapterNum);
  const sanitizationLog = canonical.log;
  validateLockedLabels(canonical.html);

  if (sanitizationLog.length > 0) {
    // eslint-disable-next-line no-console
    console.info("[student_workbook_sanitization_log]", JSON.stringify(sanitizationLog, null, 2));
  }

  return `<div class="workbook">\n${headerHtml}\n${canonical.html}\n</div>`;
}

export async function generateTeacherGuide(
  meta: ChapterMeta,
  studentWorkbookHtml: string,
  vocabulary: VocabularyWord[],
): Promise<string> {
  const chapterText = truncateText(meta.extractedText);
  const chapterLabel = meta.chapterNum ? `Chapter ${meta.chapterNum}: ${meta.chapterTitle}` : meta.chapterTitle;

  const systemPrompt = `You are a curriculum specialist creating a CB4A Teacher Guide as an HTML fragment.

Output ONLY the inner HTML — no <!DOCTYPE>, no <html>, no <head>, no <body> tags.
Start your output with: <div class="teacher-guide">
End your output with: </div>

Use EXACTLY these CSS class names (they are pre-styled):
  Sections:        <div class="tg-section"><h2>Section Title</h2>...</div>
  Instructions:    <p class="tg-instructions">...</p>
  Answers:         <div class="answer-item"><div class="question">Q: ...</div><div class="answer">A: ...</div></div>
  Tips:            <div class="discussion-note">Teaching tip: ...</div>
  Vocab table:     <table class="rubric-table"><thead><tr><th>Word</th><th>Definition</th><th>Example Sentence</th><th>Part of Speech</th></tr></thead><tbody>...</tbody></table>
  Diff grid:       <div class="diff-grid"><div class="diff-card"><h3>Approaching</h3>...</div><div class="diff-card"><h3>On Level</h3>...</div><div class="diff-card"><h3>Advanced</h3>...</div></div>
  MC answers:      <ol><li>Correct answer: [letter]. [Explanation with page cite]</li></ol>

RULES:
1) Mirror the student workbook structure exactly — same sections, same questions.
2) Use ONLY these 10 vocabulary words. Do not add, remove, or replace any words.
3) Sections in this EXACT order: Lesson Overview · Words to Know · Guided Reading · Think About the Story · Reading Dig Deeper · Multiple Choice · Evidence from the Story · Creative Response · Character Chart · Draw It · Thinking Deeper / Exit Ticket
4) For every student question: provide a model answer with page citations.
5) Standards section must include this exact Grade 3 standards list when grade = 3: RL.3.1, RL.3.3, RL.3.4, L.3.4, L.3.5, SL.3.1, SL.3.3, W.3.3.
6) Words to Know mini-lesson should explain how students infer meaning from context without giving away answers.
7) Guided Reading with pause points must provide at least 3 pause points labeled by where to stop, what to ask, and what evidence to notice.
8) Tiered Discussion must include three levels: literal, inferential, and analytical prompts.
9) Answers aligned to workbook pages must keep section names exactly matched to the workbook.
10) Struggling Readers / ELL / Advanced Students support must include one actionable support for each group.
11) Never use emojis.
12) Teacher Guide may include page references where needed.`;

  const userPrompt = `Book: ${meta.bookTitle}
Author: ${meta.author}
Chapter: ${chapterLabel}
Pages: ${meta.pages}
Grade: ${meta.grade}

Vocabulary words:
${serializeVocabulary(vocabulary)}

Student workbook (HTML — source of truth for questions):
${studentWorkbookHtml}

Chapter text:
${chapterText}`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const block = message.content[0];
  let html = block.type === "text" ? block.text : "";

  const headerHtml = `<div class="wb-header">
  <div class="wb-title">Teacher Guide</div>
  <div class="wb-meta">${meta.bookTitle} · ${chapterLabel} · Grade ${meta.grade}</div>
</div>`;

  html = html.replace('<div class="teacher-guide">', `<div class="teacher-guide">\n${headerHtml}`);

  const guideInner = extractContainerInnerHtml(html, "teacher-guide");
  const canonicalGuide = enforceTeacherGuideOrder(guideInner);
  validateLockedLabels(canonicalGuide);

  return `<div class="teacher-guide">\n${headerHtml}\n${canonicalGuide}\n</div>`;
}
