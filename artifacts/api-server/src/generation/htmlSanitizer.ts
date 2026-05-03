import type { SectionSchemaEntry } from "./sectionSchema.js";

export interface SanitizeResult {
  cleaned: string;
  removed: string[];
}

const BANNED_SNIPPETS = ["What do you already know?", "This word means", "My sentence", "Vocabulary"];

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function sanitizeLlmBodyHtml(bodyHtml: string, section: SectionSchemaEntry): SanitizeResult {
  let cleaned = bodyHtml;
  const removed: string[] = [];

  const isVocabSection =
    section.key === "words_to_know" || section.key === "words_to_know_mini_lesson";

  for (const snippet of BANNED_SNIPPETS) {
    // The literal word "Vocabulary" is legitimate teacher-facing terminology
    // inside the Words to Know mini-lesson; only strip it elsewhere.
    if (isVocabSection && snippet === "Vocabulary") continue;
    const rx = new RegExp(escapeRegExp(snippet), "gi");
    if (rx.test(cleaned)) {
      removed.push(`Removed banned snippet: "${snippet}"`);
      cleaned = cleaned.replace(rx, "");
    }
  }
  if (!isVocabSection) {
    // (isVocabSection already declared above.)
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
  // Strip only h1/h2 — those would duplicate the section title rendered by the
  // template wrapper. Sub-headings (h3/h4/h5/h6) are required by the redesigned
  // Teacher Guide structure (Words to Know sub-blocks, Guided Reading sections,
  // Answer Key sub-blocks, Differentiated Supports groups, etc.) so they must
  // be preserved.
  cleaned = cleaned.replace(/<h[12][^>]*>[\s\S]*?<\/h[12]>/gi, "");
  return { cleaned: cleaned.trim(), removed };
}

export function sanitizeLogLine(sectionKey: string, removed: string[]): string {
  if (removed.length === 0) return `[sanitize] section=${sectionKey} removed=0`;
  return `[sanitize] section=${sectionKey} removed=${removed.length} details=${removed.join(" | ")}`;
}

export function stripLeadingQuestionNumbers(html: string): string {
  return html
    .replace(/(<div class="question">\s*)(\d+\s*[\.\)]\s*)+/g, "$1")
    .replace(/(<div class="question">\s*)(\d+\s*-\s*)+/g, "$1")
    .replace(/(<li class="question-item">\s*<div class="question">\s*)(\d+\s*[\.\)]\s*)+/g, "$1");
}

function keepFirstSentence(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return cleaned;
  const match = cleaned.match(/^(.+?[.!?])(?:\s|$)/);
  return match ? match[1].trim() : cleaned;
}

export function enforceSingleSentenceItems(sectionKey: string, bodyHtml: string): string {
  if (sectionKey !== "get_ready_to_read") return bodyHtml;
  return bodyHtml
    .replace(/<p>([\s\S]*?)<\/p>/g, (_full, text: string) => `<p>${keepFirstSentence(text)}</p>`)
    .replace(/<div class="question">([\s\S]*?)<\/div>/g, (_full, text: string) => `<div class="question">${keepFirstSentence(text)}</div>`);
}

export function applyStandingSubstitutions(raw: string, chapterNum: number | undefined): string {
  const chapterNumber = chapterNum ? String(chapterNum) : "N";
  return raw
    .replaceAll("[N]", chapterNumber)
    .replaceAll("[count]", "7")
    .replaceAll("[creative response noun]", "letter");
}
