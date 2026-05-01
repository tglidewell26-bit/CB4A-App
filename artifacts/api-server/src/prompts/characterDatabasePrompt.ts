export const CHARACTER_DATABASE_SYSTEM_PROMPT =
  "You return only strict JSON. No markdown. Build a book-level character database for a classic book. Include canonical names and common aliases/spellings only.";

export function buildCharacterDatabaseUserPrompt(
  title: string,
  author: string,
  grade: number,
): string {
  return `Return JSON with shape:
{
  "book_title": "${title.trim()}",
  "author": "${author.trim()}",
  "grade_level": ${grade},
  "characters": [
    { "canonical_name": "Name", "aliases": ["Alias 1", "Alias 2"] }
  ]
}
Rules:
- Include major and recurring characters for the full book, not just chapter 1.
- aliases must include canonical name as one alias.
- No extra keys.
- If unsure, return best-known list for this title.
- Output valid JSON only.`;
}
