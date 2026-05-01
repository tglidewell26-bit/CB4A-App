import { QUESTION_TYPE_TAGS } from "../generation/sectionSchema.js";
import { gradeGuidanceFor } from "./gradeGuidance.js";
import type { VocabularyWord } from "../vocabulary/types.js";

export function teacherSectionRequirementByKey(key: string): string {
  switch (key) {
    case "get_ready_to_read":
      return "Provide short warm-up prompts with exactly one simple sentence per item. No semicolons, no compound sentences, no chained clauses.";
    case "guided_reading":
      return `Provide pause-point questions. Every question must include [question-type: ...] where ... is one of: ${QUESTION_TYPE_TAGS.join(", ")}.`;
    case "tiered_discussion":
      return `Provide tiered discussion prompts. Every prompt must include [question-type: ...] where ... is one of: ${QUESTION_TYPE_TAGS.join(", ")}.`;
    case "standards":
      return "If grade is 3, include RL.3.1, RL.3.3, RL.3.4, L.3.4, L.3.5, SL.3.1, SL.3.3, W.3.3.";
    default:
      return "Generate body HTML for this teacher section using chapter text and workbook as source of truth.";
  }
}

export interface TeacherGuidePromptInputs {
  sectionKey: string;
  bookTitle: string;
  author: string;
  chapterLabel: string;
  pages: string;
  grade: number;
  vocabulary: VocabularyWord[];
  sectionDisplayTitle: string;
  standingSubheader: string | null;
  studentWorkbookHtml: string;
  chapterText: string;
}

function serializeVocabulary(vocabulary: VocabularyWord[]): string {
  return vocabulary
    .map((v, i) => `${i + 1}. word="${v.word}" quote="${v.book_quote}" page=${v.page_number}`)
    .join("\n");
}

export function buildTeacherSectionSystemPrompt(input: TeacherGuidePromptInputs): string {
  return `You are creating one section body for a CB4A Teacher Guide as HTML.
Output only section body HTML (no wrapper section div, no title, no standing subheader).
Never emit the section title or instructional subheader text.
Mirror student workbook structure and questions where relevant.
Never use emojis.

Grade calibration: ${gradeGuidanceFor(input.grade)}

Required section key: ${input.sectionKey}
${teacherSectionRequirementByKey(input.sectionKey)}`;
}

export function buildTeacherSectionUserPrompt(input: TeacherGuidePromptInputs): string {
  return `Book: ${input.bookTitle}
Author: ${input.author}
Chapter: ${input.chapterLabel}
Pages: ${input.pages}
Grade: ${input.grade}

Vocabulary words:
${serializeVocabulary(input.vocabulary)}

Section title (for your context only, DO NOT output): ${input.sectionDisplayTitle}
Standing subheader (for your context only, DO NOT output): ${input.standingSubheader ?? "None"}

Student workbook (HTML — source of truth):
${input.studentWorkbookHtml}

Chapter text:
${input.chapterText}`;
}
