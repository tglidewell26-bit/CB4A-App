import { GRADE_VOCAB } from "./gradeWordPools.js";

const TARGET_WORD_COUNT = 10;
const BATCH_SIZE = 10;
const MIN_GRADE = 3;
const MAX_GRADE = 8;

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

  const grade = Math.min(MAX_GRADE, Math.max(MIN_GRADE, Math.trunc(gradeLevel)));
  const selected: string[] = [];
  const seen = new Set<string>();

  const tryMatchFromPool = (pool: readonly string[]): void => {
    for (let start = 0; start < pool.length; start += BATCH_SIZE) {
      const batch = pool.slice(start, start + BATCH_SIZE);
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
        if (selected.length >= TARGET_WORD_COUNT) return;
      }
      if (selected.length >= TARGET_WORD_COUNT) return;
    }
  };

  // Primary pass: the student's exact grade-banded pool.
  tryMatchFromPool(GRADE_VOCAB[grade] ?? []);

  // Fallback pass: when the primary pool didn't yield 10 words (typically a
  // shorter single-chapter lesson with a small token overlap), walk adjacent
  // grade pools by proximity (grade ± 1, ± 2, ...) and keep matching against
  // the SAME chapter text so the "word must appear in the chapter" invariant
  // is preserved. This pushes vocab toward the 10-word target without ever
  // inventing words the student can't find on the page.
  if (selected.length < TARGET_WORD_COUNT) {
    for (let delta = 1; delta <= MAX_GRADE - MIN_GRADE; delta += 1) {
      for (const candidateGrade of [grade - delta, grade + delta]) {
        if (candidateGrade < MIN_GRADE || candidateGrade > MAX_GRADE) continue;
        tryMatchFromPool(GRADE_VOCAB[candidateGrade] ?? []);
        if (selected.length >= TARGET_WORD_COUNT) return selected;
      }
    }
  }

  return selected;
}
