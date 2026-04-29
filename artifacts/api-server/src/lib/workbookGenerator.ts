import { anthropic } from "@workspace/integrations-anthropic-ai";
import {
  QUESTION_TYPE_TAGS,
  STUDENT_WORKBOOK_SECTIONS,
  TEACHER_GUIDE_SECTIONS,
  type SectionSchemaEntry,
  type TeacherGuideSectionSchemaEntry,
} from "./section_schema.js";
import type { VocabularyWord } from "./vocabularyExtractor.js";

export interface BookCharacterDatabase {
  book_title: string;
  author: string;
  grade_level: number;
  characters: { canonical_name: string; aliases: string[] }[];
}

interface ChapterMeta {
  bookTitle: string;
  author: string;
  chapterNum?: number;
  chapterTitle: string;
  pages: string;
  grade: number;
  extractedText: string;
  characterDatabase?: BookCharacterDatabase;
}

interface GeneratedSection {
  key: string;
  displayTitle: string;
  standingSubheader: string | null;
  bodySource: "llm" | "manual" | "template";
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

function blankWritingLines(count = 10): string {
  return Array(count).fill('<div class="blank-line">_____</div>').join("\n");
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

function getPromptWordCountLimit(sectionKey: string): number | null {
  switch (sectionKey) {
    case "get_ready_to_read":
      return 25;
    case "think_about_the_story":
    case "reading_between_the_lines":
    case "multiple_choice_questions":
    case "thinking_deeper":
      return 22;
    case "dig_deeper":
    case "evidence_from_the_story":
      return 35;
    case "draw_it":
      return 25;
    default:
      return null;
  }
}

function getExpectedItemCount(sectionKey: string): number | null {
  switch (sectionKey) {
    case "think_about_the_story":
      return 6;
    case "reading_between_the_lines":
    case "dig_deeper":
    case "multiple_choice_questions":
    case "evidence_from_the_story":
      return 3;
    case "bonus_challenge":
      return 7;
    case "draw_it":
      return 1;
    default:
      return null;
  }
}

function countWords(text: string): number {
  return (text.match(/\b[\w'-]+\b/g) ?? []).length;
}

function extractSentenceValidatedItems(section: GeneratedSection): string[] {
  switch (section.key) {
    case "get_ready_to_read":
      return [...section.bodyHtml.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => m[1].trim()).filter(Boolean);
    case "thinking_deeper":
    case "draw_it":
      return [section.bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()].filter(Boolean);
    default:
      return [...section.bodyHtml.matchAll(/<div class="question">([\s\S]*?)<\/div>/g)].map((m) => m[1].trim()).filter(Boolean);
  }
}

function validateSentenceLimits(section: GeneratedSection): void {
  const maxWords = getPromptWordCountLimit(section.key);
  if (!maxWords) return;
  const items = extractSentenceValidatedItems(section);
  for (const itemText of items) {
    const sentenceCount = (itemText.match(/[.!?](?=\s|$)/g) ?? []).length || 1;
    if (sentenceCount > 1) {
      throw new Error(`Student Workbook validation failed: "${section.key}" contains a multi-sentence item.`);
    }
    if (countWords(itemText) > maxWords) {
      throw new Error(`Student Workbook validation failed: "${section.key}" exceeded ${maxWords} words in one item.`);
    }
  }
}

function validateItemCount(section: GeneratedSection): void {
  const expectedCount = getExpectedItemCount(section.key);
  if (!expectedCount) return;
  const liCount = (section.bodyHtml.match(/<li[\s>]/g) ?? []).length;
  if (section.key === "draw_it") {
    const sentenceCount = (section.bodyHtml.match(/[.!?](?=\s|$)/g) ?? []).length || 1;
    if (sentenceCount !== expectedCount) {
      throw new Error(`Student Workbook validation failed: "${section.key}" must contain exactly ${expectedCount} sentence.`);
    }
    return;
  }
  const itemCount =
    section.key === "multiple_choice_questions"
      ? (section.bodyHtml.match(/<div[^>]*class="[^"]*\bmc-item\b[^"]*"[^>]*>/g) ?? []).length
      : liCount;

  if (itemCount !== expectedCount) {
    throw new Error(`Student Workbook validation failed: "${section.key}" must contain exactly ${expectedCount} items.`);
  }
}

function validateCharacterChartEmptyCells(html: string): void {
  const rowMatches = [...html.matchAll(/<tr>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/g)];
  if (rowMatches.length === 0) {
    throw new Error('Student Workbook validation failed: character_chart template is missing table cells.');
  }
  for (const match of rowMatches) {
    if (!match[1].trim()) {
      throw new Error('Student Workbook validation failed: character_chart column 1 must contain character names.');
    }
    if (match[2].trim().length > 0 || match[3].trim().length > 0) {
      throw new Error('Student Workbook validation failed: character_chart columns 2 and 3 must be blank.');
    }
  }
}

function getChapterCharacterNames(meta: ChapterMeta): string[] {
  const db = meta.characterDatabase;
  if (!db?.characters?.length) return [];
  const text = meta.extractedText.toLowerCase();
  return db.characters
    .map((character) => {
      const aliases = [character.canonical_name, ...character.aliases];
      const mentionCount = aliases.reduce((sum, alias) => {
        const rx = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&").toLowerCase()}\\b`, "g");
        return sum + (text.match(rx)?.length ?? 0);
      }, 0);
      return { name: character.canonical_name, mentionCount };
    })
    .filter((c) => c.mentionCount > 2)
    .map((c) => c.name);
}

function validateTemplateStructure(section: GeneratedSection): void {
  if (section.bodySource !== "template") return;
  switch (section.key) {
    case "creative_response":
      if (!/Dear \[recipient\],/i.test(section.bodyHtml) || !/Sincerely,/i.test(section.bodyHtml)) {
        throw new Error("Student Workbook validation failed: creative_response template structure is missing.");
      }
      break;
    case "writing_rubric":
      if (!/<table[^>]*class="rubric-table"/i.test(section.bodyHtml)) {
        throw new Error("Student Workbook validation failed: writing_rubric template table is missing.");
      }
      break;
    case "character_chart":
      if (!/<table[^>]*class="character-chart"/i.test(section.bodyHtml)) {
        throw new Error("Student Workbook validation failed: character_chart template table is missing.");
      }
      break;
    case "draw_it":
      if (!/<div[^>]*class="drawing-box"/i.test(section.bodyHtml)) {
        throw new Error("Student Workbook validation failed: draw_it template drawing box is missing.");
      }
      break;
    case "reflect_on_your_drawing":
      if (!/<ol[^>]*class="reflect-stems"/i.test(section.bodyHtml)) {
        throw new Error("Student Workbook validation failed: reflect_on_your_drawing template stems are missing.");
      }
      break;
    case "bonus_challenge":
      if (!/<ol[^>]*class="timeline-list"/i.test(section.bodyHtml)) {
        throw new Error("Student Workbook validation failed: bonus_challenge template list is missing.");
      }
      break;
    default:
      break;
  }
}

function sanitizeLlmBodyHtml(bodyHtml: string, section: SectionSchemaEntry): { cleaned: string; removed: string[] } {
  let cleaned = bodyHtml;
  const removed: string[] = [];
  const bannedSnippets = ["What do you already know?", "This word means", "My sentence", "Vocabulary"];
  for (const snippet of bannedSnippets) {
    const rx = new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    if (rx.test(cleaned)) {
      removed.push(`Removed banned snippet: "${snippet}"`);
      cleaned = cleaned.replace(rx, "");
    }
  }
  if (section.key !== "words_to_know") {
    const vocabRx = /<h[1-6][^>]*>\s*Vocabulary\s*<\/h[1-6]>/gi;
    if (vocabRx.test(cleaned)) {
      removed.push('Removed unauthorized heading: "Vocabulary"');
      cleaned = cleaned.replace(vocabRx, "");
    }
    const fillInRx = /<p[^>]*>[\s\S]*?(this word means|my sentence|fill in)[\s\S]*?<\/p>/gi;
    if (fillInRx.test(cleaned)) {
      removed.push("Removed unauthorized fill-in prompt paragraph(s)");
      cleaned = cleaned.replace(fillInRx, "");
    }
  }

  const introRx = /<p[^>]*>\s*(intro|introduction|summary)[:\s][\s\S]*?<\/p>/gi;
  if (introRx.test(cleaned)) {
    removed.push("Removed intro/summary paragraph(s)");
    cleaned = cleaned.replace(introRx, "");
  }

  const sectionWrapperRx = /<div[^>]*class="[^"]*(wb-section|tg-section)[^"]*"[^>]*>[\s\S]*?<\/div>/gi;
  if (sectionWrapperRx.test(cleaned)) {
    removed.push("Removed unauthorized section wrapper(s)");
    cleaned = cleaned.replace(sectionWrapperRx, "");
  }
  cleaned = cleaned.replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, "");
  return { cleaned: cleaned.trim(), removed };
}

function sanitizeLogLine(sectionKey: string, removed: string[]): string {
  if (removed.length === 0) {
    return `[sanitize] section=${sectionKey} removed=0`;
  }
  return `[sanitize] section=${sectionKey} removed=${removed.length} details=${removed.join(" | ")}`;
}

function keepFirstSentence(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return cleaned;
  const match = cleaned.match(/^(.+?[.!?])(?:\s|$)/);
  return match ? match[1].trim() : cleaned;
}

function enforceSingleSentenceItems(sectionKey: string, bodyHtml: string): string {
  if (sectionKey !== "get_ready_to_read") return bodyHtml;
  return bodyHtml
    .replace(/<p>([\s\S]*?)<\/p>/g, (_full, text: string) => `<p>${keepFirstSentence(text)}</p>`)
    .replace(/<div class="question">([\s\S]*?)<\/div>/g, (_full, text: string) => {
      return `<div class="question">${keepFirstSentence(text)}</div>`;
    });
}

function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function buildTemplateSectionBody(sectionKey: string, llmBodyHtml: string, meta: ChapterMeta): string {
  switch (sectionKey) {
    case "creative_response":
      return `<div class="creative-template">
  <p>Dear [recipient],</p>
  ${blankWritingLines(12)}
  <p>Sincerely,</p>
  <p>[name]</p>
</div>`;
    case "writing_rubric":
      return `<table class="rubric-table">
  <thead><tr><th>Category</th><th>4 Points</th><th>3 Points</th><th>2 Points</th><th>1 Point</th><th>My Score</th></tr></thead>
  <tbody>
    ${Array(6).fill("<tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>").join("\n    ")}
  </tbody>
</table>`;
    case "character_chart": {
      const names = getChapterCharacterNames(meta);
      const rows = names.map((name) => `<tr><td>${name}</td><td></td><td></td></tr>`).join("\n");
      return `<table class="character-chart">
  <thead>
    <tr><th>Character Name</th><th>What They Look Like and How They Act</th><th>What This Shows About Them</th></tr>
  </thead>
  <tbody>
    ${rows}
  </tbody>
</table>`;
    }
    case "draw_it":
      return `<div class="draw-it-template">
  <div class="draw-it-prompt">${llmBodyHtml}</div>
  <div class="drawing-box"></div>
</div>`;
    case "reflect_on_your_drawing":
      return `<ol class="reflect-stems">
  <li>In my drawing, ___ because ___.</li>
  <li>One detail I included is ___.</li>
  <li>I would add ___ because ___.</li>
</ol>`;
    case "thinking_deeper":
      return `<p>I predict that ________________________________________________</p>
<p>because _____________________________________________________.</p>`;
    case "bonus_challenge": {
      const events = [...llmBodyHtml.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1].trim()).slice(0, 7);
      const shuffled = shuffleArray(events);
      if (shuffled.length !== 7) {
        throw new Error("Student Workbook validation failed: bonus_challenge requires exactly 7 events from LLM.");
      }
      return `<ol class="timeline-list">
  ${shuffled.map((event) => `<li>_____ ${event}</li>`).join("\n  ")}
</ol>`;
    }
    default:
      return llmBodyHtml;
  }
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
  const generatedKeys = generatedSections.map((s) => s.key);
  if (generatedKeys.length !== new Set(generatedKeys).size) {
    throw new Error(`${context} validation failed: duplicate sections detected.`);
  }

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
    if (generated.bodySource === "template" && generated.key === "character_chart") {
      validateCharacterChartEmptyCells(generated.bodyHtml);
    }
    if (context === "Student Workbook") {
      validateTemplateStructure(generated);
    }
    if (
      generated.bodySource === "template" &&
      !["draw_it", "bonus_challenge"].includes(generated.key) &&
      /<div class="question">|<li class="question-item">/i.test(generated.bodyHtml)
    ) {
      throw new Error(
        `${context} validation failed: template-only section "${generated.key}" contains unexpected LLM-generated question content.`,
      );
    }
    if (generated.bodySource === "llm") {
      validateSentenceLimits(generated);
    }
    if (context === "Student Workbook") {
      validateItemCount(generated);
      validateCoreQuestionTypeSeparation(generated);
      if (generated.key !== "words_to_know" && /vocabulary|this word means|my sentence/i.test(generated.bodyHtml)) {
        throw new Error(`Student Workbook validation failed: unauthorized vocabulary content in section "${generated.key}".`);
      }
      if (/what do you already know\?/i.test(generated.bodyHtml)) {
        throw new Error(`Student Workbook validation failed: unauthorized intro prompt in section "${generated.key}".`);
      }
      if (generated.key === "get_ready_to_read" && /what happens when/i.test(generated.bodyHtml)) {
        throw new Error('Student Workbook validation failed: get_ready_to_read contains plot-summary phrasing.');
      }
      if (generated.key === "writing_rubric") {
        if (!/Category<\/th><th>4 Points<\/th><th>3 Points<\/th><th>2 Points<\/th><th>1 Point<\/th><th>My Score<\/th>/.test(generated.bodyHtml)) {
          throw new Error("Student Workbook validation failed: writing_rubric headers do not match required structure.");
        }
        const blankRows = (generated.bodyHtml.match(/<tr><td><\/td><td><\/td><td><\/td><td><\/td><td><\/td><td><\/td><\/tr>/g) ?? []).length;
        if (blankRows !== 6) throw new Error("Student Workbook validation failed: writing_rubric must contain 6 blank rows.");
      }
      if (generated.key === "bonus_challenge" && /<\/li>\s*_____/.test(generated.bodyHtml)) {
        throw new Error("Student Workbook validation failed: bonus_challenge blanks must appear before events.");
      }
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



type CoreQuestionType = "literal" | "inference" | "analysis";
function classifyQuestion(question: string): CoreQuestionType {
  const q = question.toLowerCase();
  if (
    q.includes("compare") ||
    q.includes("how does this show") ||
    q.includes("what might happen if") ||
    q.includes("what is the theme") ||
    q.includes("what does this tell us about") ||
    q.includes("what does this reveal about") ||
    q.includes("what message") ||
    q.includes("author's purpose") ||
    q.includes("how does the author")
  ) return "analysis";
  if (
    q.includes("why do you think") ||
    q.includes("how do you know") ||
    q.includes("what can you infer") ||
    q.includes("why did") ||
    q.includes("why might") ||
    q.includes("why would") ||
    q.includes("why does") ||
    q.includes("how might") ||
    q.includes("how does") ||
    q.includes("how did") ||
    q.includes("how would") ||
    q.includes("what do you think") ||
    q.includes("what clues") ||
    q.includes("what does this suggest") ||
    q.includes("what made") ||
    q.includes("what could") ||
    q.includes("what might") ||
    q.includes("feel") ||
    q.includes("motivat") ||
    q.includes("reaction") ||
    q.includes("emotion") ||
    q.includes("infer")
  ) return "inference";
  return "literal";
}

function validateCoreQuestionTypeSeparation(section: GeneratedSection): void {
  const expectedBySection: Partial<Record<string, CoreQuestionType>> = {
    think_about_the_story: "literal",
    reading_between_the_lines: "inference",
    dig_deeper: "analysis",
  };
  const expected = expectedBySection[section.key];
  if (!expected) return;
  const questions = [...section.bodyHtml.matchAll(/<div class="question">([\s\S]*?)<\/div>/g)].map((m) => m[1].trim());
  for (const question of questions) {
    const actual = classifyQuestion(question);
    if (actual !== expected) {
      throw new Error(`Student Workbook validation failed: "${section.key}" must contain only ${expected} questions, but found ${actual}.`);
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
  const globalGuardrails = `Do NOT mix question types.
Each section must strictly follow its assigned type:
- Think About the Story = literal only
- Reading Between the Lines = inference only
- Dig Deeper = analysis only
Do NOT reuse the same question style across sections.
- Avoid repetitive phrasing across questions
- Avoid forcing vocabulary words into questions
- Keep language grade-appropriate
- Keep questions concise and clear
Internal model:
- Think About → What happened?
- Reading Between → Why did it happen?
- Dig Deeper → Why does it matter?`;
  switch (key) {
    case "get_ready_to_read":
      return `<div class="focus-question"><div class="focus-label">FOCUS QUESTION</div><p>...</p></div>.
Output exactly one short open-ended personal pre-reading question in a single <p> under 25 words. No plot recap. No chapter event summary.`;
    case "words_to_know":
      return `Output NOTHING except the placeholder:
WORDS_TO_KNOW_TABLE_PLACEHOLDER
Do not include: vocabulary lists, definitions, example sentences, fill-in exercises, duplicate tables.`;
    case "think_about_the_story":
      return `${globalGuardrails}
Generate 5–6 literal comprehension questions.
Rules:
- Answers must be directly stated in the text
- Each question must have ONE clear answer
- Each answer must come from a single location in the chapter
- Each answer must be ONE sentence
- Do NOT require interpretation, opinion, or inference
Disallowed:
- "Why do you think..."
- "How does this show..."
- emotional reasoning
- multi-step thinking
Output as <ol class="question-list"><li class="question-item"><div class="question">...</div>${answerLines(2)}</li></ol> with exactly 6 questions.`;
    case "reading_between_the_lines":
      return `${globalGuardrails}
Generate 3–4 inference questions.
Rules:
- Answers are NOT directly stated in the text
- Answers must be supported by clues from the text
- Focus on character feelings, motivations, or reactions
- Each answer must include reasoning ("because")
- Do NOT ask opinion-only questions
- Do NOT ask direct factual questions
Output as <ol class="question-list"><li class="question-item"><div class="question">...</div>${answerLines(2)}</li></ol> with exactly 3 questions.`;
    case "dig_deeper":
      return `${globalGuardrails}
Generate 3 higher-level analysis questions.
Rules:
- Answers must go beyond the text
- May include: comparison, cause/effect, theme, symbolism, or "what if" scenarios
- Answers must be justified using evidence from the text
- Questions should NOT be answerable with one sentence
- Do NOT ask simple inference questions
- Do NOT ask direct factual questions
Output as <ol class="question-list"><li class="question-item"><div class="question">...</div>${answerLines(2)}</li></ol> with exactly 3 questions.`;
    case "multiple_choice_questions":
      return "Do not force vocabulary words into the questions. Write natural story-based questions that match the section purpose.\n" + '<div class="mc-item"><div class="question">...</div><ul class="mc-options"><li>A. ...</li><li>B. ...</li><li>C. ...</li><li>D. ...</li></ul></div> with exactly 3 questions.';
    case "evidence_from_the_story":
      return "Do not force vocabulary words into the questions. Write natural story-based questions that match the section purpose.\n" + `<ol class="question-list"><li class="question-item"><div class="question">...</div>${answerLines(3)}</li></ol> with exactly 3 questions.`;
    case "writing_rubric":
      return "Checklist table with exactly 4 criteria rows: I answered the prompt; I included details from Chapter 1; I wrote in Heidi's voice; I checked my spelling and grammar.";
    case "character_chart":
      return "Character table with exactly 5 rows and columns: Character Name, What They Look Like and How They Act, What This Shows About Them.";
    case "draw_it":
      return "Output exactly 1 item. One sentence under 25 words. No paragraph. No list. No scene-description list.";
    case "reflect_on_your_drawing":
      return "Exactly 3 sentence stems for reflection.";
    case "bonus_challenge":
      return '<ol class="timeline-list"><li>...</li></ol> with exactly 7 scrambled events.';
    case "thinking_deeper":
      return "Output exactly two lines with the prediction frame and no additional prompt text.";
    default:
      return "Generate only body HTML for this section.";
  }
}

function studentLengthConstraintBySection(key: string): string {
  if (key === "words_to_know") {
    return "";
  }
  const count = getExpectedItemCount(key);
  const maxWords = getPromptWordCountLimit(key);
  if (!maxWords) {
    return "";
  }
  const resolvedCount = count ?? 1;
  return `Output exactly ${resolvedCount} ${resolvedCount === 1 ? "item" : "items"}.
Each item must:
- be ONE sentence
- be under ${maxWords} words
Do NOT include:
- explanations
- multi-sentence responses
- paragraph formatting`;
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

    const shouldCallLlm =
      section.body_source === "llm" || (section.body_source === "template" && ["draw_it", "bonus_challenge"].includes(section.key));

    const rawBodyHtml = !shouldCallLlm
      ? section.body_source === "manual"
        ? buildManualSlot(section.display_title)
        : ""
      : await generateLlmSectionBody(
            `You are creating one section body for a CB4A Student Workbook as HTML.
Output only the body HTML content (no wrapper section div, no title, no standing subheader).
Never emit the section title or instructional subheader text.
Use only chapter text and provided vocabulary.
Question text must not start with numbering prefixes.
Never use emojis.
Output ONLY the required structure for this section.
Do NOT add:
- extra headings
- additional sections
- vocabulary lists
- summaries
- intro paragraphs
- sentence starters
- callouts
- duplicated content
Use ONLY the provided vocabulary list.
Do not add, remove, or replace words.
Required section key: ${section.key}
Formatting target: ${studentSectionRequirementByKey(section.key)}
${studentLengthConstraintBySection(section.key)}`,
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

    const sanitized = shouldCallLlm
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

function teacherSectionRequirementByKey(key: string): string {
  switch (key) {
    case "get_ready_to_read":
      return "Provide short warm-up prompts with exactly one simple sentence per item. No semicolons, no compound sentences, no chained clauses.";
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
