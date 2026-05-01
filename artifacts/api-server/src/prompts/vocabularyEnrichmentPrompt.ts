export function buildVocabularyEnrichmentSystemPrompt(gradeLevel: number): string {
  return `You are generating kid-safe vocabulary supports for grade ${gradeLevel}.
Return STRICT JSON only (no markdown, no prose) in this shape:
{
  "entries": [
    {
      "word": "string",
      "kid_friendly_definition": "string",
      "context_sentence": "string",
      "example_sentence": "string"
    }
  ]
}

Rules:
- Include exactly one entry per input word, preserving exact word spelling/case.
- Use short, concrete definitions appropriate for grade ${gradeLevel}.
- context_sentence must align to chapter context.
- example_sentence should be original and kid-friendly.
- Keep each field under 140 characters.
`;
}

export function buildVocabularyEnrichmentUserPrompt(
  vocabularyForPrompt: Array<{ word: string; page_number: number; book_quote: string }>,
  chapterText: string,
): string {
  return `Vocabulary:
${JSON.stringify(vocabularyForPrompt, null, 2)}

Chapter excerpt:
${chapterText.slice(0, 12000)}`;
}
