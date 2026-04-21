export const EXACT_COUNTS = {
  think_about_story_questions: 6,
  inference_questions: 3,
  analysis_questions: 3,
  multiple_choice: 3,
  short_answer_questions: 3,
  creative_hints: 3,
  character_names: 5,
  reflection_stems: 3,
  timeline_events: 7,
} as const;

export function validateCounts(aiOutput: Record<string, unknown>): void {
  for (const [key, expected] of Object.entries(EXACT_COUNTS)) {
    const value = aiOutput[key];
    const actual = Array.isArray(value) ? value.length : 0;
    if (actual !== expected) {
      throw new Error(`${key}: expected ${expected}, got ${actual}`);
    }
  }
}

function countQuestionLines(section: string): number {
  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^(\d+[.)]|[-*])\s+/.test(line)).length;
}

export function validateWorkbookMarkdownCounts(markdown: string): void {
  const section = (name: string) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\[${escaped}\\]([\\s\\S]*?)(?=\\n\\[[^\\]]+\\]|$)`, "i");
    const match = markdown.match(regex);
    return match?.[1] ?? "";
  };

  const multipleChoiceSection = section("Multiple Choice");
  const creativeSection = section("Creative Response");
  const reflectSection = section("Reflect on Your Drawing");
  const characterSection = section("Character Chart");
  const bonusSection = section("Bonus Challenge");

  const extractNames = characterSection.match(/\b[A-Z][a-z]+\b/g) ?? [];
  const extractCreativeHints = (creativeSection.match(/(?:Hint\s*\d*:?|^-\s+)/gim) ?? []).length;
  const extractReflectionStems = (reflectSection.match(/(?:I noticed|I wonder|I learned|I think|I felt)/gim) ?? []).length;
  const extractTimelineEvents = (bonusSection.match(/(?:timeline|event)/gim) ?? []).length;

  validateCounts({
    think_about_story_questions: Array.from({ length: countQuestionLines(section("Think About the Story")) }),
    inference_questions: Array.from({ length: countQuestionLines(section("Reading Between the Lines")) }),
    analysis_questions: Array.from({ length: countQuestionLines(section("Dig Deeper")) }),
    multiple_choice: Array.from({ length: countQuestionLines(multipleChoiceSection) }),
    short_answer_questions: Array.from({ length: countQuestionLines(section("Evidence from the Story")) }),
    creative_hints: Array.from({ length: extractCreativeHints }),
    character_names: Array.from({ length: Math.min(5, extractNames.length) }),
    reflection_stems: Array.from({ length: Math.min(3, extractReflectionStems) }),
    timeline_events: Array.from({ length: Math.min(7, extractTimelineEvents) }),
  });

  if (!/Dear Deta,/i.test(creativeSection) || !/Sincerely,\s*\n\s*Heidi/i.test(creativeSection)) {
    throw new Error("Creative Response must be LETTER format with 'Dear Deta,' and closing 'Sincerely,\\n\\nHeidi'.");
  }
}

