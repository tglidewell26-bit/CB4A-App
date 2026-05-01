import { enrichSelectedVocabWords } from "./enricher.js";
import { selectVocabWords } from "./selector.js";
import type { VocabularyWord } from "./types.js";

/**
 * One-shot pipeline: pick grade-appropriate words from the chapter, then
 * enrich each one with its first-occurrence page number and the sentence
 * containing it. Replaces the prior shell-out to vocab_selector.py +
 * vocab_enricher.py.
 */
export function selectAndEnrichVocabulary(
  extractedText: string,
  gradeLevel: number,
): VocabularyWord[] {
  const words = selectVocabWords(extractedText, gradeLevel);
  if (words.length === 0) return [];
  return enrichSelectedVocabWords(words, extractedText, gradeLevel);
}

export { enrichVocabularyForTeacherGuide } from "./teacherGuideEnrichment.js";
export type { VocabularyWord } from "./types.js";
