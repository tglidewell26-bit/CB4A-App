import type { PageText } from "./textExtractor.js";

export interface VocabularyWord {
  word: string;
  lemma: string;
  page_number: number;
  book_quote: string;
  grade_band: string;
  score: number;
}

const STOPWORDS = new Set([
  "about", "above", "after", "again", "against", "all", "also", "always", "among", "an", "and", "any", "are", "around", "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "can", "could", "did", "do", "does", "doing", "down", "during", "each", "few", "for", "from", "further", "had", "has", "have", "having", "he", "her", "here", "hers", "herself", "him", "himself", "his", "how", "i", "if", "in", "into", "is", "it", "its", "itself", "just", "me", "more", "most", "my", "myself", "no", "nor", "not", "now", "of", "off", "on", "once", "only", "or", "other", "our", "ours", "ourselves", "out", "over", "own", "same", "she", "should", "so", "some", "such", "than", "that", "the", "their", "theirs", "them", "themselves", "then", "there", "these", "they", "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "we", "were", "what", "when", "where", "which", "while", "who", "whom", "why", "will", "with", "would", "you", "your", "yours", "yourself", "yourselves",
]);

function lemmatize(token: string): string {
  if (token.endsWith("ies") && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith("ing") && token.length > 5) return token.slice(0, -3);
  if (token.endsWith("ed") && token.length > 4) return token.slice(0, -2);
  if (token.endsWith("es") && token.length > 4) return token.slice(0, -2);
  if (token.endsWith("s") && token.length > 3) return token.slice(0, -1);
  return token;
}

function posTag(word: string): "noun" | "verb" | "adjective" | "other" {
  if (/(ing|ed)$/.test(word)) return "verb";
  if (/(ous|ful|able|ible|ive|al|ic|less)$/.test(word)) return "adjective";
  if (/(tion|ness|ment|ity|ship|ance|ence)$/.test(word)) return "noun";
  return "other";
}

function targetBand(grade: number): [number, number] {
  return [grade, grade + 2];
}

function estimateWordGrade(word: string): number {
  const len = word.length;
  const syllableHint = (word.match(/[aeiouy]{1,2}/g) ?? []).length;
  return Math.max(1, Math.min(12, Math.round(1 + len / 2 + syllableHint / 2)));
}

function sentenceQuote(text: string, word: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const found = sentences.find((s) => new RegExp(`\\b${word}\\b`, "i").test(s));
  return (found ?? text).slice(0, 220).trim();
}

export function extractVocabulary(
  chapterPages: PageText[],
  gradeLevel: number,
): VocabularyWord[] {
  const [minGrade, maxGrade] = targetBand(gradeLevel);
  const maxAllowedGrade = gradeLevel + 2;
  const chapterSize = chapterPages.length || 1;

  type Candidate = {
    display: string;
    lemma: string;
    count: number;
    firstPage: number;
    firstPosition: number;
    pos: string;
  };

  const candidates = new Map<string, Candidate>();

  chapterPages.forEach((page) => {
    const tokens = page.text.match(/[A-Za-z][A-Za-z'-]{2,}/g) ?? [];
    tokens.forEach((raw, tokenIndex) => {
      const normalized = raw.toLowerCase();
      if (STOPWORDS.has(normalized) || normalized.length < 4) return;

      const lemma = lemmatize(normalized);
      const existing = candidates.get(lemma);
      if (existing) {
        existing.count += 1;
        return;
      }

      candidates.set(lemma, {
        display: raw,
        lemma,
        count: 1,
        firstPage: page.page_number,
        firstPosition: tokenIndex,
        pos: posTag(normalized),
      });
    });
  });

  const scored = Array.from(candidates.values())
    .map((item) => {
      const estimatedGrade = estimateWordGrade(item.lemma);
      if (estimatedGrade > maxAllowedGrade) return null;

      const difficultyFit = 1 - Math.min(Math.abs(estimatedGrade - gradeLevel) / 4, 1);
      const frequencyScore = Math.min(item.count / 4, 1);
      const positionWeight = 1 - (item.firstPage - 1) / chapterSize;
      const importance = frequencyScore * 0.7 + positionWeight * 0.3;
      const transferability = item.pos === "noun" || item.pos === "adjective" ? 1 : 0.7;

      const score = Number((difficultyFit * 0.45 + importance * 0.4 + transferability * 0.15).toFixed(4));

      const page = chapterPages.find((p) => p.page_number === item.firstPage);
      const quote = page ? sentenceQuote(page.text, item.display) : item.display;

      return {
        word: item.display,
        lemma: item.lemma,
        page_number: item.firstPage,
        book_quote: quote,
        grade_band: `${minGrade}-${maxGrade}`,
        score,
      } satisfies VocabularyWord;
    })
    .filter((item): item is VocabularyWord => !!item)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return scored;
}
