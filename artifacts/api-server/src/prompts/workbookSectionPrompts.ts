import { gradeGuidanceFor } from "./gradeGuidance.js";
import type { VocabularyWord } from "../vocabulary/types.js";

const ANSWER_SPACE = '<div class="answer-space"></div>';

function answerLines(count = 3): string {
  return Array(count).fill(ANSWER_SPACE).join("\n");
}

export interface WordCountLimitsBySection {
  [sectionKey: string]: number | null;
}

export const STUDENT_SECTION_WORD_LIMITS: WordCountLimitsBySection = {
  get_ready_to_read: 25,
  think_about_the_story: 22,
  reading_between_the_lines: 22,
  multiple_choice_questions: 22,
  thinking_deeper: 22,
  dig_deeper: 50,
  evidence_from_the_story: 35,
  draw_it: 25,
};

export function getPromptWordCountLimit(sectionKey: string): number | null {
  return STUDENT_SECTION_WORD_LIMITS[sectionKey] ?? null;
}

export const STUDENT_SECTION_ITEM_COUNTS: Record<string, number | null> = {
  think_about_the_story: 6,
  reading_between_the_lines: 3,
  dig_deeper: 3,
  multiple_choice_questions: 3,
  evidence_from_the_story: 3,
  bonus_challenge: 7,
  draw_it: 1,
};

export function getExpectedItemCount(sectionKey: string): number | null {
  return STUDENT_SECTION_ITEM_COUNTS[sectionKey] ?? null;
}

const QUESTION_TYPE_GUARDRAILS = `Do NOT mix question types.
Each section must strictly follow its assigned type:
- Think About the Story = literal only
- Reading Between the Lines = inference only
- Dig Deeper = analysis only
Do NOT reuse the same question style across sections.
- Avoid repetitive phrasing across questions
- Avoid forcing vocabulary words into questions
- Keep language grade-appropriate
- Keep questions concise and clear
Internal model:
- Think About → What happened?
- Reading Between → Why did it happen?
- Dig Deeper → Why does it matter?`;

export function studentSectionRequirementByKey(key: string): string {
  switch (key) {
    case "get_ready_to_read":
      return `<div class="focus-question"><div class="focus-label">FOCUS QUESTION</div><p>...</p></div>.
Output exactly one short open-ended personal pre-reading question in a single <p> under 25 words. No plot recap. No chapter event summary.`;
    case "words_to_know":
      return `Output NOTHING except the placeholder:
WORDS_TO_KNOW_TABLE_PLACEHOLDER
Do not include: vocabulary lists, definitions, example sentences, fill-in exercises, duplicate tables.`;
    case "think_about_the_story":
      return `${QUESTION_TYPE_GUARDRAILS}
Generate 5–6 literal comprehension questions.
Rules:
- Answers must be directly stated in the text
- Each question must have ONE clear answer
- Each answer must come from a single location in the chapter
- Each answer must be ONE sentence
- Do NOT require interpretation, opinion, or inference
Disallowed:
- "Why do you think..."
- "How does this show..."
- emotional reasoning
- multi-step thinking
Output as <ol class="question-list"><li class="question-item"><div class="question">...</div>${answerLines(2)}</li></ol> with exactly 6 questions.`;
    case "reading_between_the_lines":
      return `${QUESTION_TYPE_GUARDRAILS}
Generate 3–4 inference questions.
Rules:
- Answers are NOT directly stated in the text
- Answers must be supported by clues from the text
- Focus on character feelings, motivations, or reactions
- Each answer must include reasoning ("because")
- Do NOT ask opinion-only questions
- Do NOT ask direct factual questions
Output as <ol class="question-list"><li class="question-item"><div class="question">...</div>${answerLines(2)}</li></ol> with exactly 3 questions.`;
    case "dig_deeper":
      return `${QUESTION_TYPE_GUARDRAILS}
Generate 3 higher-level analysis questions.
Rules:
- Answers must go beyond the text
- May include: comparison, cause/effect, theme, symbolism, or "what if" scenarios
- Answers must be justified using evidence from the text
- Questions should NOT be answerable with one sentence
- Do NOT ask simple inference questions
- Do NOT ask direct factual questions
Output as <ol class="question-list"><li class="question-item"><div class="question">...</div>${answerLines(2)}</li></ol> with exactly 3 questions.`;
    case "multiple_choice_questions":
      return "Do not force vocabulary words into the questions. Write natural story-based questions that match the section purpose.\n" +
        '<div class="mc-item"><div class="question">...</div><ul class="mc-options"><li>A. ...</li><li>B. ...</li><li>C. ...</li><li>D. ...</li></ul></div> with exactly 3 questions.';
    case "evidence_from_the_story":
      return "Do not force vocabulary words into the questions. Write natural story-based questions that match the section purpose.\n" +
        `<ol class="question-list"><li class="question-item"><div class="question">...</div>${answerLines(3)}</li></ol> with exactly 3 questions.`;
    case "writing_rubric":
      return "Checklist table with exactly 4 criteria rows: I answered the prompt; I included details from Chapter 1; I wrote in Heidi's voice; I checked my spelling and grammar.";
    case "character_chart":
      return "Character table with exactly 5 rows and columns: Character Name, What They Look Like and How They Act, What This Shows About Them.";
    case "draw_it":
      return "Output exactly 1 item. One sentence under 25 words. No paragraph. No list. No scene-description list.";
    case "reflect_on_your_drawing":
      return "Exactly 3 sentence stems for reflection.";
    case "bonus_challenge":
      return '<ol class="timeline-list"><li>...</li></ol> with exactly 7 scrambled events.';
    case "thinking_deeper":
      return "Output exactly two lines with the prediction frame and no additional prompt text.";
    default:
      return "Generate only body HTML for this section.";
  }
}

export function studentLengthConstraintBySection(key: string): string {
  if (key === "words_to_know") return "";
  const count = getExpectedItemCount(key);
  const maxWords = getPromptWordCountLimit(key);
  if (!maxWords) return "";
  const resolvedCount = count ?? 1;
  return `Output exactly ${resolvedCount} ${resolvedCount === 1 ? "item" : "items"}.
Each item must:
- be ONE sentence
- be under ${maxWords} words
Do NOT include:
- explanations
- multi-sentence responses
- paragraph formatting`;
}

export interface StudentWorkbookPromptInputs {
  sectionKey: string;
  bookTitle: string;
  author: string;
  chapterLabel: string;
  pages: string;
  grade: number;
  vocabulary: VocabularyWord[];
  sectionDisplayTitle: string;
  standingSubheader: string | null;
  chapterText: string;
}

function serializeVocabulary(vocabulary: VocabularyWord[]): string {
  return vocabulary
    .map((v, i) => `${i + 1}. word="${v.word}" quote="${v.book_quote}" page=${v.page_number}`)
    .join("\n");
}

export function buildStudentSectionSystemPrompt(input: StudentWorkbookPromptInputs): string {
  return `You are creating one section body for a CB4A Student Workbook as HTML.
Output only the body HTML content (no wrapper section div, no title, no standing subheader).
Never emit the section title or instructional subheader text.
Use only chapter text and provided vocabulary.
Question text must not start with numbering prefixes.
Never use emojis.
Output ONLY the required structure for this section.
Do NOT add:
- extra headings
- additional sections
- vocabulary lists
- summaries
- intro paragraphs
- sentence starters
- callouts
- duplicated content
Use ONLY the provided vocabulary list.
Do not add, remove, or replace words.

Grade calibration: ${gradeGuidanceFor(input.grade)}

Required section key: ${input.sectionKey}
Formatting target: ${studentSectionRequirementByKey(input.sectionKey)}
${studentLengthConstraintBySection(input.sectionKey)}`;
}

export function buildStudentSectionUserPrompt(input: StudentWorkbookPromptInputs): string {
  return `Book: ${input.bookTitle}
Author: ${input.author}
Chapter: ${input.chapterLabel}
Pages: ${input.pages}
Grade: ${input.grade}

Vocabulary words (use exactly these words and quotes):
${serializeVocabulary(input.vocabulary)}

Section title (for your context only, DO NOT output): ${input.sectionDisplayTitle}
Standing subheader (for your context only, DO NOT output): ${input.standingSubheader ?? "None"}

Chapter text:
${input.chapterText}`;
}
