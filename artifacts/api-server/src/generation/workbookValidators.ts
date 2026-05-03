import {
  QUESTION_TYPE_TAGS,
  type SectionSchemaEntry,
  type TeacherGuideSectionSchemaEntry,
} from "./sectionSchema.js";
import { applyStandingSubstitutions } from "./htmlSanitizer.js";
import {
  getExpectedItemCount,
  getPromptWordCountLimit,
} from "../prompts/workbookSectionPrompts.js";
import { ALL_STANDARDS } from "../standards/elaStandards.js";
import type { ChapterMeta, GeneratedSection } from "./templateRenderers.js";

// ---------------------------------------------------------------------------
// Question classification
//
// Used by think_about_the_story / reading_between_the_lines / dig_deeper
// validators below. Uses a POSITIVE pattern set: a question is "higher order"
// when it explicitly requests inference, analysis, comparison, or
// interpretive reasoning; a question is "clearly literal" when it only asks
// for recalled facts.
// ---------------------------------------------------------------------------

const HIGHER_ORDER_PATTERNS: RegExp[] = [
  /\bwhy do you think\b/i,
  /\bwhy might\b/i,
  /\bwhy would\b/i,
  /\bwhy does the author\b/i,
  /\bwhat do you think\b/i,
  /\bwhat does this (?:show|reveal|suggest|tell us)\b/i,
  /\bwhat can you infer\b/i,
  /\bwhat clues\b/i,
  /\bhow do you know\b/i,
  /\bhow does this (?:show|connect|reveal)\b/i,
  /\bhow does the author\b/i,
  /\bcompare\b/i,
  /\bcontrast\b/i,
  /\bsymboli[sz]e\b/i,
  /\brepresent\b/i,
  /\btheme\b/i,
  /\bauthor['’]s purpose\b/i,
  /\bwhat (?:is|are) the (?:significance|meaning|impact|effect|consequences|relationship)\b/i,
  /\bwhat (?:lesson|message)\b/i,
  /\bwhat can we (?:learn|conclude)\b/i,
  /\bwhy is this important\b/i,
  /\binfer\b/i,
  /\bmotivat/i,
  /\breaction\b/i,
  /\bemotion\b/i,
  /\bfeel(?:s|ing)?\b/i,
];

const CLEARLY_LITERAL_PATTERNS: RegExp[] = [
  /^\s*who\s/i,
  /^\s*what\s/i,
  /^\s*when\s/i,
  /^\s*where\s/i,
  /\baccording to the text\b/i,
  /\bin the story\b/i,
  /\bhappened\b/i,
  /\bdid\b/i,
];

export function isHigherOrderQuestion(question: string): boolean {
  return HIGHER_ORDER_PATTERNS.some((rx) => rx.test(question));
}

export function isClearlyLiteralQuestion(question: string): boolean {
  if (isHigherOrderQuestion(question)) return false;
  return CLEARLY_LITERAL_PATTERNS.some((rx) => rx.test(question));
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
      console.warn(
        `[workbook-validation] "${section.key}" contains a multi-sentence item (length quality): "${itemText.slice(0, 80)}..."`,
      );
    }
    if (countWords(itemText) > maxWords) {
      console.warn(
        `[workbook-validation] "${section.key}" exceeded ${maxWords} words in one item (length quality): "${itemText.slice(0, 80)}..."`,
      );
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
    console.warn('[workbook-validation] character_chart rendered with no rows — character database may be empty for this chapter.');
    return;
  }
  for (const match of rowMatches) {
    if (!match[1].trim()) {
      console.warn('[workbook-validation] character_chart column 1 has a blank character name cell.');
    }
    if (match[2].trim().length > 0 || match[3].trim().length > 0) {
      throw new Error('Student Workbook validation failed: character_chart columns 2 and 3 must be blank.');
    }
  }
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

function questionsIn(section: GeneratedSection): string[] {
  return [...section.bodyHtml.matchAll(/<div class="question">([\s\S]*?)<\/div>/g)].map((m) => m[1].trim());
}

/**
 * think_about_the_story: throws if a higher-order question is detected (hard check).
 * reading_between_the_lines and dig_deeper: warn only (quality hints, not blockers).
 */
function validateCoreQuestionTypeSeparation(section: GeneratedSection): void {
  if (section.key === "think_about_the_story") {
    for (const question of questionsIn(section)) {
      if (isHigherOrderQuestion(question)) {
        throw new Error(
          `Student Workbook validation failed: "think_about_the_story" contains a higher-order question (expected literal/comprehension only). Offending question: "${question.slice(0, 120)}"`,
        );
      }
    }
  } else if (section.key === "reading_between_the_lines") {
    for (const question of questionsIn(section)) {
      if (!isHigherOrderQuestion(question) && isClearlyLiteralQuestion(question)) {
        console.warn(
          `[workbook-validation] Possible literal question in "reading_between_the_lines" (expected inference). Question: "${question}"`,
        );
      }
    }
  } else if (section.key === "dig_deeper") {
    for (const question of questionsIn(section)) {
      if (!isHigherOrderQuestion(question) && isClearlyLiteralQuestion(question)) {
        console.warn(
          `[workbook-validation] Possible literal question in "dig_deeper" (expected analysis). Question: "${question}"`,
        );
      }
    }
  }
}

export function validateQuestionTypeTags(section: GeneratedSection): void {
  const extracted = [...section.bodyHtml.matchAll(/\[question-type:\s*([^\]]+)\]/gi)].map((m) =>
    m[1].trim().toLowerCase(),
  );

  if (extracted.length === 0) {
    console.warn(`[workbook-validation] Teacher Guide section "${section.key}" has no [question-type:] tags.`);
    return;
  }

  for (const tag of extracted) {
    if (!QUESTION_TYPE_TAGS.includes(tag as (typeof QUESTION_TYPE_TAGS)[number])) {
      console.warn(
        `[workbook-validation] Teacher Guide section "${section.key}" has an unrecognised question-type tag: "${tag}".`,
      );
    }
  }
}

/**
 * Hard structural validators for the redesigned Teacher Guide sections.
 * These check shape only (presence of headers, sub-blocks, page ranges, weak/fix
 * pairs, etc.) — never check for specific book/chapter/grade content. Throws
 * with a descriptive error so the caller knows exactly which section failed.
 */
export function validateTeacherGuideSectionStructure(
  section: GeneratedSection,
  meta: ChapterMeta,
): void {
  const html = section.bodyHtml;
  const fail = (msg: string): never => {
    throw new Error(`Teacher Guide validation failed: section "${section.key}" — ${msg}`);
  };

  switch (section.key) {
    case "lesson_overview": {
      if (!/<div[^>]*class="[^"]*\btg-tip\b[^"]*"/i.test(html)) {
        fail('missing inline <div class="tg-tip"> pacing/connection callout.');
      }
      break;
    }
    case "measurable_objectives": {
      const liCount = (html.match(/<li[\s>]/g) ?? []).length;
      if (liCount < 5 || liCount > 6) {
        fail(`expected 5–6 SWBAT bullets, got ${liCount}.`);
      }
      const codeMatches = html.match(/\((?:RL|RI|W|L|SL)\.\d\.[0-9a-z]+\)/g) ?? [];
      if (codeMatches.length < 5) {
        fail(`expected at least 5 standard codes in parentheses, got ${codeMatches.length}.`);
      }
      const wrongGrade = codeMatches.find((c) => !c.includes(`.${meta.grade}.`));
      if (wrongGrade) {
        fail(`standard code ${wrongGrade} is not for grade ${meta.grade}.`);
      }
      break;
    }
    case "standards": {
      if (!/<table[^>]*class="[^"]*\btg-standards-table\b[^"]*"/i.test(html)) {
        fail('missing <table class="tg-standards-table">.');
      }
      if (!/<th>\s*Standard\s*<\/th>\s*<th>\s*Description\s*<\/th>\s*<th>\s*Workbook Section\(s\)\s*<\/th>/i.test(html)) {
        fail("standards table headers must be Standard | Description | Workbook Section(s).");
      }
      const rowCount = (html.match(/<tr>/gi) ?? []).length;
      if (rowCount < 4) {
        fail(`standards table must have at least one header row plus a few standards rows; got ${rowCount} <tr>.`);
      }
      const codes = html.match(/\b(?:RL|RI|W|L|SL)\.\d\.[0-9a-z]+/g) ?? [];
      const knownCodes = new Set(ALL_STANDARDS.map((s) => s.code));
      const fabricated = codes.find((c) => !knownCodes.has(c));
      if (fabricated) {
        fail(`standards table contains unknown standard code "${fabricated}". Standards must come from the supplied profile; never invent codes.`);
      }
      const strandsPresent = new Set(codes.map((c) => c.split(".")[0]));
      const readingPresent = strandsPresent.has("RL") || strandsPresent.has("RI");
      if (!readingPresent) fail("standards table must include at least one Reading Literature (RL) or Reading Informational (RI) standard.");
      if (!strandsPresent.has("W")) fail("standards table must include at least one Writing (W) standard.");
      if (!strandsPresent.has("L")) fail("standards table must include at least one Language (L) standard.");
      if (!strandsPresent.has("SL")) fail("standards table must include at least one Speaking and Listening (SL) standard.");
      const wrongGrade = codes.find((c) => !c.includes(`.${meta.grade}.`));
      if (wrongGrade) {
        fail(`standards table contains code ${wrongGrade}, which is not for grade ${meta.grade}.`);
      }
      break;
    }
    case "materials_needed": {
      if (!/<ul[\s>]|<ol[\s>]/i.test(html)) {
        fail("must contain a <ul> or <ol> list of materials.");
      }
      const liCount = (html.match(/<li[\s>]/g) ?? []).length;
      if (liCount < 4) {
        fail(`expected at least 4 material items, got ${liCount}.`);
      }
      break;
    }
    case "get_ready_to_read": {
      if (!/Quick-write prompt/i.test(html)) {
        fail('missing "Quick-write prompt" label.');
      }
      if (!/<ol[^>]*class="[^"]*\btg-impl-steps\b[^"]*"/i.test(html)) {
        fail('missing <ol class="tg-impl-steps"> implementation list.');
      }
      if (!/<div[^>]*class="[^"]*\btg-tip\b[^"]*"/i.test(html)) {
        fail('missing inline <div class="tg-tip"> connection callout.');
      }
      break;
    }
    case "words_to_know_mini_lesson": {
      const subblocks = [...html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)].map((m) =>
        m[1].trim().toLowerCase(),
      );
      const required = ["activities", "partner practice", "quick check"];
      let cursor = -1;
      for (const label of required) {
        const idx = subblocks.findIndex((s, i) => i > cursor && s.includes(label));
        if (idx === -1) {
          fail(`missing or out-of-order sub-block heading "${label}". Expected order: Activities → Partner Practice → Quick Check.`);
        }
        cursor = idx;
      }
      if (!/<div[^>]*class="[^"]*\btg-subblock\b[^"]*"/i.test(html)) {
        fail('missing <div class="tg-subblock"> wrappers.');
      }
      if (!/<div[^>]*class="[^"]*\btg-tip\b[^"]*"/i.test(html)) {
        fail('missing inline <div class="tg-tip"> vocabulary-extension callout.');
      }
      break;
    }
    case "guided_reading": {
      const sectionCount = (html.match(/<div[^>]*class="[^"]*\btg-gr-section\b/gi) ?? []).length;
      if (sectionCount < 3) {
        fail(`expected at least 3 numbered Guided Reading sections, got ${sectionCount}.`);
      }
      // Each section must have a page range like "pages 4–7" / "pages 4-7" / "p. 4 to 7" / "pp. 4–7"
      const rangeRegex = /(?:pages?|pp?\.)\s*(\d+)\s*(?:[–\-—]|to)\s*(\d+)/gi;
      const ranges = [...html.matchAll(rangeRegex)].map((m) => ({
        start: parseInt(m[1], 10),
        end: parseInt(m[2], 10),
      }));
      if (ranges.length < sectionCount) {
        fail(`each Guided Reading section must include a page range; found ${ranges.length} for ${sectionCount} sections.`);
      }
      // Cross-check coverage against the chapter's actual page span when parseable.
      const metaSpan = meta.pages.match(/(\d+)\s*[–\-—]\s*(\d+)/);
      if (metaSpan) {
        const chapterStart = parseInt(metaSpan[1], 10);
        const chapterEnd = parseInt(metaSpan[2], 10);
        for (const r of ranges) {
          if (r.start < chapterStart || r.end > chapterEnd || r.end < r.start) {
            fail(`Guided Reading page range ${r.start}–${r.end} falls outside the chapter span ${chapterStart}–${chapterEnd}.`);
          }
        }
        const minStart = Math.min(...ranges.map((r) => r.start));
        const maxEnd = Math.max(...ranges.map((r) => r.end));
        if (minStart > chapterStart || maxEnd < chapterEnd) {
          fail(`Guided Reading sections (covering ${minStart}–${maxEnd}) do not span the full chapter ${chapterStart}–${chapterEnd}.`);
        }
      }
      const tagCount = (html.match(/\[question-type:/gi) ?? []).length;
      if (tagCount < sectionCount * 2) {
        fail(`expected at least ${sectionCount * 2} tagged pause-point questions, got ${tagCount}.`);
      }
      if (!/<div[^>]*class="[^"]*\btg-tip\b[^"]*"/i.test(html)) {
        fail('missing inline <div class="tg-tip"> read-aloud callout.');
      }
      break;
    }
    case "think_about_the_story_answers": {
      const answerCount = (html.match(/<div[^>]*class="[^"]*\btg-answer\b[^"]*"/gi) ?? []).length;
      if (answerCount < 1) {
        fail('expected at least one <div class="tg-answer"> Q/A block.');
      }
      if (!/<div[^>]*class="[^"]*\btg-inferential\b[^"]*"/i.test(html)) {
        fail('missing inline Inferential Thinking sub-block (<div class="tg-subblock tg-inferential">).');
      }
      break;
    }
    case "answer_key": {
      const required = [
        "reading between the lines",
        "dig deeper",
        "multiple choice",
        "evidence from the story",
        "character chart",
        "draw it",
      ];
      const headings = [...html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)].map((m) =>
        m[1].trim().toLowerCase(),
      );
      for (const label of required) {
        if (!headings.some((h) => h.includes(label))) {
          fail(`missing answer-key sub-block with heading containing "${label}".`);
        }
      }
      if (!/<table[^>]*class="[^"]*\btg-character-key\b[^"]*"/i.test(html)) {
        fail('missing <table class="tg-character-key"> character chart answer table.');
      }
      break;
    }
    case "differentiated_supports": {
      const required = ["struggling readers", "english language learners", "advanced students"];
      const headings = [...html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)].map((m) =>
        m[1].trim().toLowerCase(),
      );
      for (const label of required) {
        if (!headings.some((h) => h.includes(label))) {
          fail(`missing learner-group sub-block "${label}".`);
        }
      }
      const phaseCount = (html.match(/before reading|during reading|after reading/gi) ?? []).length;
      if (phaseCount < 9) {
        fail(`expected each of 3 groups to have Before/During/After reading labels (≥9 total); got ${phaseCount}.`);
      }
      break;
    }
    case "common_student_questions": {
      if (!/<ol[^>]*class="[^"]*\btg-csq\b[^"]*"/i.test(html)) {
        fail('missing <ol class="tg-csq"> question list.');
      }
      const liCount = (html.match(/<li[\s>]/g) ?? []).length;
      if (liCount < 5 || liCount > 8) {
        fail(`expected 5–8 Q/A pairs, got ${liCount}.`);
      }
      break;
    }
    case "creative_response_common_errors": {
      const pairCount = (html.match(/<div[^>]*class="[^"]*\btg-weak-fix\b[^"]*"/gi) ?? []).length;
      if (pairCount < 3) {
        fail(`expected at least 3 weak/fix pairs (<div class="tg-weak-fix">), got ${pairCount}.`);
      }
      const weakCount = (html.match(/Weak example/gi) ?? []).length;
      const fixCount = (html.match(/How to fix/gi) ?? []).length;
      if (weakCount < pairCount || fixCount < pairCount) {
        fail(`each weak/fix pair must have both "Weak example:" and "How to fix:" labels (${weakCount}/${fixCount}/${pairCount}).`);
      }
      break;
    }
    case "exit_ticket": {
      const headingMatches = [...html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)];
      const headings = headingMatches.map((m) => m[1].trim().toLowerCase());
      for (const label of ["prompt", "success criteria", "example responses"]) {
        if (!headings.some((h) => h.includes(label))) {
          fail(`missing exit-ticket sub-block "${label}".`);
        }
      }
      // Slice the HTML by sub-block heading to count items per sub-block.
      const sliceLis = (heading: string): number => {
        const headingRx = new RegExp(`<h3[^>]*>\\s*${heading}\\s*<\\/h3>([\\s\\S]*?)(?=<h3[^>]*>|$)`, "i");
        const m = html.match(headingRx);
        if (!m) return 0;
        return (m[1].match(/<li[\s>]/g) ?? []).length;
      };
      const criteriaCount = sliceLis("success criteria");
      if (criteriaCount < 3) {
        fail(`exit-ticket "Success Criteria" sub-block must contain at least 3 <li> items, got ${criteriaCount}.`);
      }
      const exampleCount = sliceLis("example responses");
      if (exampleCount < 1) {
        fail(`exit-ticket "Example Responses" sub-block must contain at least 1 <li>, got ${exampleCount}.`);
      }
      break;
    }
    default:
      break;
  }
}

export function validateSections(
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
      ? applyStandingSubstitutions(expected.standing_subheader, meta.chapterNum)
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
