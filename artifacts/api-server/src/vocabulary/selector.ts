import { GRADE_VOCAB } from "./gradeWordPools.js";

const TARGET_WORD_COUNT = 10;
const BATCH_SIZE = 10;

export function normalizeToken(token: string): string {
  return token.toLowerCase().replace(/[^a-z]/g, "");
}

export function lemmatize(token: string): string {
  if (token.endsWith("ies") && token.length > 4) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.endsWith("ing") && token.length > 5) {
    return token.slice(0, -3);
  }
  if (token.endsWith("ed") && token.length > 4) {
    return token.slice(0, -2);
  }
  if (token.endsWith("es") && token.length > 4) {
    return token.slice(0, -2);
  }
  if (token.endsWith("s") && token.length > 3) {
    return token.slice(0, -1);
  }
  return token;
}

/**
 * Pick up to TARGET_WORD_COUNT vocabulary words from the chapter text by
 * intersecting the chapter's normalized token set with the grade-banded
 * target pool. Ported from workbook_generator/vocab_selector.py — same
 * tokenizer regex, same lemmatizer, same iteration order.
 */
export function selectVocabWords(text: string, gradeLevel: number): string[] {
  const tokens = text.match(/[A-Za-z][A-Za-z'-]{2,}/g) ?? [];
  const tokenSet = new Set<string>();
  for (const t of tokens) {
    const n = normalizeToken(t);
    if (n) tokenSet.add(n);
  }

  const grade = Math.min(8, Math.max(3, Math.trunc(gradeLevel)));
  const selected: string[] = [];
  const seen = new Set<string>();

  const vocabPool = GRADE_VOCAB[grade] ?? [];
  for (let start = 0; start < vocabPool.length; start += BATCH_SIZE) {
    const batch = vocabPool.slice(start, start + BATCH_SIZE);
    for (const candidate of batch) {
      const normalizedCandidate = normalizeToken(candidate);
      const lemma = normalizeToken(lemmatize(candidate));

      let choice: string | null = null;
      if (tokenSet.has(normalizedCandidate)) {
        choice = normalizedCandidate;
      } else if (tokenSet.has(lemma)) {
        choice = lemma;
      } else {
        continue;
      }

      if (seen.has(choice)) continue;

      selected.push(choice);
      seen.add(choice);
      if (selected.length >= TARGET_WORD_COUNT) {
        return selected;
      }
    }
    if (selected.length >= TARGET_WORD_COUNT) break;
  }

  return selected;
}
