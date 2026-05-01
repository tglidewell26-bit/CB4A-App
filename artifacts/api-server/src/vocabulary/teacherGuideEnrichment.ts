import { anthropic, CLAUDE_MODEL } from "../ai/anthropic.js";
import {
  buildVocabularyEnrichmentSystemPrompt,
  buildVocabularyEnrichmentUserPrompt,
} from "../prompts/vocabularyEnrichmentPrompt.js";
import type { VocabularyWord } from "./types.js";

interface VocabularyEnrichment {
  word: string;
  kid_friendly_definition: string;
  context_sentence: string;
  example_sentence: string;
}

/**
 * Ask Claude for kid-friendly definitions, context sentences, and example
 * sentences for the selected vocabulary. The result is folded into each
 * VocabularyWord; on any failure the original list is returned unchanged.
 */
export async function enrichVocabularyForTeacherGuide(
  vocabulary: VocabularyWord[],
  gradeLevel: number,
  chapterText: string,
): Promise<VocabularyWord[]> {
  if (vocabulary.length === 0) return vocabulary;

  const systemPrompt = buildVocabularyEnrichmentSystemPrompt(gradeLevel);
  const userPrompt = buildVocabularyEnrichmentUserPrompt(
    vocabulary.map((v) => ({
      word: v.word,
      page_number: v.page_number,
      book_quote: v.book_quote,
    })),
    chapterText,
  );

  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = message.content.find((block: { type: string }) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") return vocabulary;

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return vocabulary;

  let parsed: { entries?: VocabularyEnrichment[] } = {};
  try {
    parsed = JSON.parse(jsonMatch[0]) as { entries?: VocabularyEnrichment[] };
  } catch {
    return vocabulary;
  }

  const enrichmentByWord = new Map(
    (parsed.entries ?? []).map((entry) => [entry.word.toLowerCase(), entry]),
  );

  return vocabulary.map((entry) => {
    const enrichment = enrichmentByWord.get(entry.word.toLowerCase());
    if (!enrichment) return entry;
    return {
      ...entry,
      kid_friendly_definition: enrichment.kid_friendly_definition,
      context_sentence: enrichment.context_sentence,
      example_sentence: enrichment.example_sentence,
    };
  });
}
