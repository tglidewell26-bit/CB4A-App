import {
  type SectionSchemaEntry,
} from "./sectionSchema.js";
import { applyStandingSubstitutions } from "./htmlSanitizer.js";
import {
  getExpectedItemCount,
  getPromptWordCountLimit,
} from "../prompts/workbookSectionPrompts.js";
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
  /\bwhat is (?:his|her|their|the) reaction\b/i,
  /\bhow does (?:he|she|the character|this) feel\b/i,
  /\bwhat emotion\b/i,
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

/**
 * Validates the full set of generated Student Workbook sections: required-key
 * coverage, ordering, manual-slot wiring, template-structure presence, item
 * counts, and content guardrails.
 *
 * Note: Teacher Guide validation has been replaced by typed JSON parsing in
 * teacherGuideJsonParsers.ts — Claude no longer returns HTML for the Teacher
 * Guide, so structural HTML validation is unnecessary.
 */
export function validateSections(
  generatedSections: GeneratedSection[],
  schema: SectionSchemaEntry[],
  meta: ChapterMeta,
): void {
  const context = "Student Workbook";
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
    validateTemplateStructure(generated);
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

    if (expectedSubheader !== generated.standingSubheader) {
      throw new Error(`${context} validation failed: standing subheader mismatch in section "${generated.key}".`);
    }
  }
}
