// Per-grade calibration guidance salvaged from the deleted Python prompts.py.
// Kept verbatim because this language was tuned by curriculum editors and
// gives Claude a sharper target than a single grade integer.
const GRADE_GUIDANCE: Record<number, string> = {
  3: "Grade 3 (ages 8-9): Very simple vocabulary and short sentences. Comprehension questions are literal — the answer can be pointed to in a single sentence. Vocabulary definitions use only words a 3rd grader already knows. Creative prompt has heavy scaffolding.",
  4: "Grade 4 (ages 9-10): Clear, accessible language. Mix of literal and one or two simple inference questions. Definitions friendly and brief.",
  5: "Grade 5 (ages 10-11): Grade-appropriate language. Mix of literal and inferential questions. Students support answers with text evidence.",
  6: "Grade 6 (ages 11-12): More sophisticated language. Inference and basic analysis questions dominate. Vocabulary genuinely challenging. Text evidence required.",
  7: "Grade 7 (ages 12-13): Literary and analytical language. Character motivation, theme, author craft. Advanced vocabulary. Strong text evidence with page citations.",
  8: "Grade 8 (ages 13-14): Sophisticated literary analysis. Literary devices, thematic depth, in-depth character analysis. Challenging vocabulary with nuanced definitions. Direct quotation as evidence.",
};

export function gradeGuidanceFor(grade: number): string {
  return GRADE_GUIDANCE[grade] ?? GRADE_GUIDANCE[5];
}
