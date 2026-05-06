import type { VocabularyWord } from "./types.js";

const PAGE_SEPARATOR = "\n\n---PAGE---\n\n";

interface ParsedPage {
  page_number: number;
  text: string;
}

function gradeBand(gradeLevel: number): string {
  const grade = Math.min(8, Math.max(3, Math.trunc(gradeLevel)));
  return `${grade}-${Math.min(8, grade + 2)}`;
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sentenceQuote(text: string, word: string): string {
  const escaped = escapeRegExp(word);
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const sentence of sentences) {
    if (new RegExp(`\\b${escaped}\\b`, "i").test(sentence)) {
      return sentence.slice(0, 220);
    }
  }
  return text.trim().slice(0, 220);
}

/**
 * Parse the serialized chapter text (with `[PAGE N]` markers / `---PAGE---`
 * separators) into per-page records. Mirrors `_parse_chapter_pages` in the
 * deleted workbook_generator/vocab_enricher.py byte-for-byte so first-page
 * lookup behavior is unchanged after the port.
 */
export function parseChapterPages(extractedText: string): ParsedPage[] {
  const markerPattern = /^\[PAGE\s+(\d+)\]\s*\n?/gim;
  const markerMatches: Array<{ index: number; end: number; page: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = markerPattern.exec(extractedText)) !== null) {
    markerMatches.push({
      index: match.index,
      end: match.index + match[0].length,
      page: Number(match[1]),
    });
  }

  if (markerMatches.length > 0) {
    const pagesFromMarkers: ParsedPage[] = [];
    for (let i = 0; i < markerMatches.length; i += 1) {
      const marker = markerMatches[i];
      const contentEnd = i + 1 < markerMatches.length ? markerMatches[i + 1].index : extractedText.length;
      const pageText = extractedText.slice(marker.end, contentEnd).trim();
      if (pageText) {
        pagesFromMarkers.push({ page_number: marker.page, text: pageText });
      }
    }
    if (pagesFromMarkers.length > 0) return pagesFromMarkers;
  }

  const pages: ParsedPage[] = [];
  const segments = extractedText
    .split(PAGE_SEPARATOR)
    .map((s) => s.trim())
    .filter(Boolean);
  segments.forEach((segment, index) => {
    const inlineMarker = segment.match(/^\[PAGE\s+(\d+)\]\s*\n?/i);
    let pageNumber: number;
    let text: string;
    if (inlineMarker) {
      pageNumber = Number(inlineMarker[1]);
      text = segment.replace(/^\[PAGE\s+\d+\]\s*\n?/i, "").trim();
    } else {
      pageNumber = index + 1;
      text = segment;
    }
    if (text) pages.push({ page_number: pageNumber, text });
  });
  return pages;
}

/**
 * For each selected word, find the FIRST page on which it appears (case
 * insensitive whole-word match) and emit a VocabularyWord with the sentence
 * containing that hit. Ported from workbook_generator/vocab_enricher.py.
 */
export function enrichSelectedVocabWords(
  words: ReadonlyArray<string>,
  extractedText: string,
  gradeLevel: number,
): VocabularyWord[] {
  const pages = parseChapterPages(extractedText);
  const band = gradeBand(gradeLevel);
  const enriched: VocabularyWord[] = [];

  for (const word of words) {
    const escaped = escapeRegExp(word);
    const hitPage = pages.find((page) => new RegExp(`\\b${escaped}\\b`, "i").test(page.text));
    if (!hitPage) continue;

    enriched.push({
      word,
      page_number: hitPage.page_number,
      book_quote: sentenceQuote(hitPage.text, word),
      grade_band: band,
      score: 1.0,
    });
  }

  return enriched;
}
