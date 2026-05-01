import {
  QUESTION_TYPE_TAGS,
  type SectionSchemaEntry,
  type TeacherGuideSectionSchemaEntry,
} from "./sectionSchema.js";
import { applyStandingSubstitutions } from "./htmlSanitizer.js";
import { isClearlyLiteralQuestion, isHigherOrderQuestion } from "./questionClassifier.js";
import {
  getExpectedItemCount,
  getPromptWordCountLimit,
} from "../prompts/workbookSectionPrompts.js";
import type { ChapterMeta, GeneratedSection } from "./templateRenderers.js";

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
 * All three "core question type separation" checks now warn rather than
 * throw. The previous implementation rejected entire workbook generations
 * because of a false positive in the keyword classifier; we now record
 * the offending question text so editors can review it without losing the
 * generation.
 */
function validateCoreQuestionTypeSeparation(section: GeneratedSection): void {
  if (section.key === "think_about_the_story") {
    for (const question of questionsIn(section)) {
      if (isHigherOrderQuestion(question)) {
        console.warn(
          `[workbook-validation] Possible higher-order question in "think_about_the_story" (expected literal-only). Question: "${question}"`,
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
    throw new Error(`Teacher Guide validation failed: no question-type tags found in section "${section.key}".`);
  }

  for (const tag of extracted) {
    if (!QUESTION_TYPE_TAGS.includes(tag as (typeof QUESTION_TYPE_TAGS)[number])) {
      throw new Error(`Teacher Guide validation failed: invalid question-type tag "${tag}" in section "${section.key}".`);
    }
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
