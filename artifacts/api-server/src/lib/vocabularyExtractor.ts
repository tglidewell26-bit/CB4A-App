import { isLikelyKnownByGrade } from "./cefrjVocabularyProfile.js";
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

const DOLCH_SIGHT_WORDS = new Set([
  "a", "and", "away", "big", "blue", "can", "come", "down", "find", "for", "funny", "go", "help", "here", "i", "in", "is", "it", "jump", "little", "look", "make", "me", "my", "not", "one", "play", "red", "run", "said", "see", "the", "three", "to", "two", "up", "we", "where", "yellow", "you",
  "all", "am", "are", "at", "ate", "be", "black", "brown", "but", "came", "did", "do", "eat", "four", "get", "good", "have", "he", "into", "like", "must", "new", "no", "now", "on", "our", "out", "please", "pretty", "ran", "ride", "saw", "say", "she", "so", "soon", "that", "there", "they", "this", "too", "under", "want", "was", "well", "went", "what", "white", "who", "will", "with", "yes",
  "after", "again", "an", "any", "as", "ask", "by", "could", "every", "fly", "from", "give", "giving", "had", "has", "her", "him", "his", "how", "just", "know", "let", "live", "may", "of", "old", "once", "open", "over", "put", "round", "some", "stop", "take", "thank", "them", "then", "think", "walk", "were", "when",
  "always", "around", "because", "been", "before", "best", "both", "buy", "call", "cold", "does", "dont", "fast", "first", "five", "found", "gave", "goes", "green", "its", "made", "many", "off", "or", "pull", "read", "right", "sing", "sit", "sleep", "tell", "their", "these", "those", "upon", "us", "use", "very", "wash", "which", "why", "wish", "work", "would", "write", "your",
  "about", "better", "bring", "carry", "clean", "cut", "done", "draw", "drink", "eight", "fall", "far", "full", "got", "grow", "hold", "hot", "hurt", "if", "keep", "kind", "laugh", "light", "long", "much", "myself", "never", "only", "own", "pick", "seven", "shall", "show", "six", "small", "start", "ten", "today", "together", "try", "warm",
  "apple", "baby", "back", "ball", "bear", "bed", "bell", "bird", "birthday", "boat", "box", "boy", "bread", "brother", "cake", "car", "cat", "chair", "chicken", "children", "christmas", "coat", "corn", "cow", "day", "dog", "doll", "door", "duck", "egg", "eye", "farm", "farmer", "father", "feet", "fire", "fish", "floor", "flower", "game", "garden", "girl", "goodbye", "grass", "ground", "hand", "head", "hill", "home", "horse", "house", "kitty", "leg", "letter", "man", "men", "milk", "money", "morning", "mother", "name", "nest", "night", "paper", "party", "picture", "pig", "rabbit", "rain", "ring", "robin", "school", "seed", "sheep", "shoe", "sister", "snow", "song", "squirrel", "stick", "street", "sun", "table", "thing", "time", "top", "toy", "tree", "watch", "water", "way", "wind", "window", "wood",
  "asking", "taking", "lived", "shoes", "path", "years", "clothes", "walked",
]);

const AWL_ACADEMIC_WORDS = new Set([
  "analyze", "analysis", "attire", "breathtaking", "cozy", "encouraged", "evaluate", "evidence", "frustrated", "guided", "identify", "impact", "inherited", "interpret", "maintain", "nimble", "perspective", "significant", "stern", "strategy", "summarize", "support", "gruff",
]);

function lemmatize(token: string): string {
  if (token.endsWith("ies") && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith("ing") && token.length > 5) return token.slice(0, -3);
  if (token.endsWith("ed") && token.length > 4) {
    const stem = token.slice(0, -2);
    if (stem.endsWith("v") || stem.endsWith("k") || stem.endsWith("z")) return `${stem}e`;
    return stem;
  }
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

function isLikelyContraction(token: string): boolean {
  const lower = token.toLowerCase();
  if (lower.includes("'")) return true;
  return /(n't|'re|'ve|'ll|'d|'m|'s)$/.test(lower);
}

function buildProperNounLexicon(chapterPages: PageText[]): Set<string> {
  const counts = new Map<string, { upper: number; lower: number }>();
  const punctuation = /^[^A-Za-z]+|[^A-Za-z]+$/g;

  chapterPages.forEach((page) => {
    const words = page.text.match(/\b[A-Za-z][A-Za-z'-]*\b/g) ?? [];
    words.forEach((raw) => {
      const cleaned = raw.replace(punctuation, "");
      if (!cleaned) return;
      const base = cleaned.toLowerCase();
      if (base.length < 3) return;
      if (STOPWORDS.has(base)) return;
      if (isLikelyContraction(cleaned)) return;

      const stat = counts.get(base) ?? { upper: 0, lower: 0 };
      if (/^[A-Z]/.test(cleaned)) stat.upper += 1;
      else stat.lower += 1;
      counts.set(base, stat);
    });
  });

  const properNouns = new Set<string>();
  for (const [base, stat] of counts.entries()) {
    if (stat.upper >= 2 && stat.lower === 0) properNouns.add(base);
  }
  return properNouns;
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
  const properNounLexicon = buildProperNounLexicon(chapterPages);

  chapterPages.forEach((page) => {
    const tokens = page.text.match(/[A-Za-z][A-Za-z'-]{2,}/g) ?? [];
    tokens.forEach((raw, tokenIndex) => {
      if (isLikelyContraction(raw)) return;
      if (/^[A-Z]/.test(raw) && properNounLexicon.has(raw.toLowerCase())) return;

      const normalized = raw.toLowerCase();
      if (STOPWORDS.has(normalized) || normalized.length < 4) return;

      const lemma = lemmatize(normalized);
      if (DOLCH_SIGHT_WORDS.has(normalized) || DOLCH_SIGHT_WORDS.has(lemma)) return;
      if (isLikelyKnownByGrade(lemma, gradeLevel)) return;
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

      const gradeDist = estimatedGrade - gradeLevel;
      if (gradeDist < -1) return null;

      let difficultyFit = 0;
      if (gradeDist === 0) difficultyFit = 1.0;
      else if (gradeDist === 1) difficultyFit = 0.7;
      else if (gradeDist >= 2) difficultyFit = 0.3;
      const frequencyScore = Math.min(item.count / 4, 1);
      const positionWeight = 1 - (item.firstPage - 1) / chapterSize;
      const importance = frequencyScore * 0.7 + positionWeight * 0.3;
      const transferability = item.pos === "noun" || item.pos === "adjective" ? 1 : 0.7;
      let score = difficultyFit * 0.45 + importance * 0.4 + transferability * 0.15;
      if (estimatedGrade < gradeLevel - 1) score *= 0.1;
      if (AWL_ACADEMIC_WORDS.has(item.lemma.toLowerCase())) score += 0.3;
      score = Number(score.toFixed(4));

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

  const easyWordCount = scored.filter((w) => {
    const normalized = w.word.toLowerCase();
    return DOLCH_SIGHT_WORDS.has(normalized) || DOLCH_SIGHT_WORDS.has(w.lemma) || isLikelyKnownByGrade(w.lemma, gradeLevel);
  }).length;
  if (easyWordCount > 0) {
    throw new Error(`${easyWordCount} too-easy words selected (Dolch/CEFR-J) - REJECTED. Re-run with stricter filter.`);
  }

  const onGradeCount = scored.filter((w) => {
    const estimatedGrade = estimateWordGrade(w.lemma);
    return Math.abs(estimatedGrade - gradeLevel) <= 1;
  }).length;
  if (onGradeCount < 7) {
    throw new Error(`Only ${onGradeCount}/10 on-grade. REJECTED. Need at least 7.`);
  }

  return scored;
}
