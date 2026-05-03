import { QUESTION_TYPE_TAGS } from "../generation/sectionSchema.js";
import { gradeGuidanceFor } from "./gradeGuidance.js";
import type { VocabularyWord } from "../vocabulary/types.js";
import { formatStandardsForPrompt } from "../standards/index.js";
import type { GradeLevel } from "../standards/types.js";
import type { GeneratedSection } from "../generation/templateRenderers.js";

const QUESTION_TYPE_LABELS = QUESTION_TYPE_TAGS.map((t) => `- ${t}`).join("\n");

export function teacherSectionRequirementByKey(key: string, grade?: GradeLevel): string {
  const gradeLevel = (grade ?? 4) as GradeLevel;
  switch (key) {
    case "lesson_overview":
      return `Write a Lesson Overview block with these elements in order:
1. A short paragraph naming the chapter (use the chapter label given) and stating the lesson is designed for one ~60-minute period.
2. A "Learning Goals" sentence (one sentence) summarizing what students will be able to do by the end.
3. An inline tip callout using exactly this HTML pattern:
   <div class="tg-tip"><strong>Pacing tip:</strong> ...</div>
   The tip should give a concrete pacing/timing suggestion for a 60-minute period.

Do not list standards or objectives here — those are separate sections.`;

    case "measurable_objectives":
      return `Output 5–6 measurable "SWBAT" (Students Will Be Able To) bullets as an unordered list.
Each bullet must:
- Begin with "Students will be able to" and a measurable verb (identify, explain, compare, describe, infer, analyze, evaluate, write, etc.).
- End with the relevant ELA standard code in parentheses, e.g. (RL.${gradeLevel}.1).
- Use only standard codes for grade ${gradeLevel} from the Standards block below.
- Be grade-appropriate in cognitive demand for grade ${gradeLevel}.

Output exactly one <ul> with 5–6 <li> children. No headings, no extra prose.`;

    case "standards": {
      const standardsBlock = formatStandardsForPrompt(gradeLevel);
      return `Output a single HTML <table class="tg-standards-table"> with this exact thead:
<thead><tr><th>Standard</th><th>Description</th><th>Workbook Section(s)</th></tr></thead>
Then a <tbody> with one row per standard the chapter actually addresses.
Group rows in this strand order (do NOT include strand labels in rows themselves; group by inserting a <tr class="tg-strand-header"><td colspan="3">Reading Literature</td></tr> style row before each strand's rows): Reading Literature, Reading Informational Text, Writing, Language, Speaking and Listening. Skip any strand with no applicable standards.

Pick at least one standard from Reading Literature OR Reading Informational, plus at least one Writing standard, plus at least one Language standard (vocabulary mini-lesson maps here), plus at least one Speaking and Listening standard (discussion maps here).

For each row:
- Standard column: the exact code from the block below (e.g. RL.${gradeLevel}.3). Never invent codes.
- Description column: the official text from the block (you may shorten only by trimming trailing examples in parentheses).
- Workbook Section(s) column: a comma-separated list of the workbook section names this standard maps to (e.g. "Think About the Story, Reading Between the Lines").

Available standards (use ONLY these — do not invent codes):
${standardsBlock}`;
    }

    case "materials_needed":
      return `Output a single <ul> listing the physical/printable materials a teacher needs to run this lesson. Include at minimum: the chapter pages from the book, the Student Workbook for this chapter, pencils, and any anchor/wall material implied by the workbook (word wall, chart paper, etc.). 4–7 items. No headings.`;

    case "get_ready_to_read":
      return `Generate a Get Ready to Read teacher block with these three elements in order:
1. A "Quick-write prompt" labeled clearly. Use this exact pattern:
   <p><strong>Quick-write prompt:</strong> "..."</p>
   The prompt is a single short question students respond to in writing. It must connect to a theme or situation in this specific chapter without spoiling plot.
2. An ordered list of implementation steps. Use this exact pattern:
   <ol class="tg-impl-steps"><li>Display the prompt and read it aloud.</li><li>Give students 3–5 minutes to write...</li>...</ol>
   Include 4–5 steps covering: display, write time, share with partner, share whole-class, connect to today's chapter.
3. An inline tip callout:
   <div class="tg-tip"><strong>Connection tip:</strong> ...</div>
   The tip explains why this warm-up activates schema for what students will read.`;

    case "words_to_know_mini_lesson":
      return `Output exactly three labeled sub-blocks, in this order, each as its own <div>:

<div class="tg-subblock"><h3>Activities</h3>
  <p>Introduce vocabulary by previewing each word in the context of the chapter. Walk through this worked example for ONE of this chapter's vocab words:</p>
  <ul>
    <li>Word: <em>{{vocab_word}}</em></li>
    <li>Quote from chapter (with page): "..."</li>
    <li>Context-clue strategy: ...</li>
    <li>Student-friendly definition: ...</li>
  </ul>
</div>

<div class="tg-subblock"><h3>Partner Practice</h3>
  <p>Pair students. Have them locate each remaining word in the chapter and discuss meaning using a sentence frame such as: "I think <em>[word]</em> means ___ because the text says ___."</p>
</div>

<div class="tg-subblock"><h3>Quick Check</h3>
  <ol>
    <li>Call on 2–3 pairs to share their definitions.</li>
    <li>Confirm or correct using the official definition.</li>
    <li>Add the word to the classroom word wall.</li>
  </ol>
</div>

After the three sub-blocks, append one inline tip callout:
<div class="tg-tip"><strong>Vocabulary tip:</strong> ...</div>
The tip should give a short pedagogical extension idea (e.g. word-relationship work, morphology, figurative-language tie-in) that scales the vocabulary lesson for stronger or weaker readers.

Replace {{vocab_word}} with one real word from the vocabulary list provided. Use a real quote from the chapter text. Do NOT add other top-level headings; ONLY emit the three sub-blocks above plus the tip callout.`;

    case "guided_reading":
      return `Split the chapter into 3–4 numbered Guided Reading sections that cover the chapter's full page range in order. Use this exact pattern for each section:

<div class="tg-gr-section">
  <h3>Section [N]: pages [start]–[end]</h3>
  <p><em>Read from "[opening phrase from this segment]" through "[closing phrase from this segment]".</em></p>
  <p><strong>Pause-point questions:</strong></p>
  <ol class="tg-pause-points">
    <li>Question text. [question-type: comprehension]</li>
    <li>Question text. [question-type: inference]</li>
  </ol>
</div>

Rules:
- Section page ranges together must cover the full chapter page span given in the metadata. They must not overlap and must be in order.
- Each section must have 2–4 pause-point questions.
- Every pause-point question must end with a [question-type: LABEL] tag using EXACTLY one of these labels (do not modify or combine):
${QUESTION_TYPE_LABELS}
- Vary the question types across the sections — do not use the same label every time.
- Opening/closing phrases must come from the actual chapter text supplied below.

After all numbered sections, append one inline tip callout:
<div class="tg-tip"><strong>Read-aloud tip:</strong> ...</div>`;

    case "think_about_the_story_answers":
      return `For each "Think About the Story" question in the Student Workbook (look for <div class="question"> elements inside the Think About the Story section), restate the question and provide the teacher answer.

Use this exact pattern for each:
<div class="tg-answer">
  <p><strong>Q:</strong> [restated question]</p>
  <p><strong>A:</strong> [literal answer in 1–2 sentences] (p. [page]).</p>
</div>

After ALL Think About the Story answers, append a single inferential-thinking sub-block linearized into the flow:
<div class="tg-subblock tg-inferential">
  <h3>Inferential Thinking — deeper follow-ups</h3>
  <ol>
    <li>Deeper teacher prompt 1.</li>
    <li>Deeper teacher prompt 2.</li>
    <li>Deeper teacher prompt 3.</li>
  </ol>
</div>

Generate 2–3 inferential follow-up prompts that push beyond literal recall. Do NOT skip the inferential block.`;

    case "answer_key":
      return `Output a teacher answer key for the remaining workbook sections. Emit each as its own labeled subblock in this order:

<div class="tg-subblock"><h3>Reading Between the Lines — Answers</h3>
  <ol>
    <li><strong>Q:</strong> ...<br/><strong>A:</strong> ... (p. ...).</li>
    ...
  </ol>
</div>

<div class="tg-subblock"><h3>Dig Deeper — Answers</h3>
  <ol>
    <li><strong>Q:</strong> ...<br/><strong>A:</strong> ... (p. ...).</li>
    ...
  </ol>
</div>

<div class="tg-subblock"><h3>Multiple Choice — Answers</h3>
  <ol>
    <li><strong>Correct: [A/B/C/D]</strong> — one-line rationale citing the text.</li>
    ...
  </ol>
</div>

<div class="tg-subblock"><h3>Evidence from the Story — Sample Answers</h3>
  <ol>
    <li>Sample student answer with quote and page citation.</li>
    ...
  </ol>
</div>

<div class="tg-subblock"><h3>Character Chart — Answer Key</h3>
  <table class="tg-character-key">
    <thead><tr><th>Character</th><th>Description / Actions</th><th>What This Shows</th><th>Evidence (quote + page)</th></tr></thead>
    <tbody>
      <tr><td>...</td><td>...</td><td>...</td><td>"..." (p. ...)</td></tr>
    </tbody>
  </table>
</div>

<div class="tg-subblock"><h3>Draw It! — Suggested Details</h3>
  <ul>
    <li>Visual element 1 grounded in the chapter.</li>
    <li>Visual element 2 grounded in the chapter.</li>
    <li>Visual element 3 grounded in the chapter.</li>
  </ul>
</div>

Use the actual workbook questions provided. Cite real page numbers from the chapter's page range. Do not invent characters not present in the chapter text.`;

    case "differentiated_supports":
      return `Output exactly three labeled groups, in this order, each as its own subblock. Within each group, split into Before / During / After reading bullets.

<div class="tg-subblock tg-supports"><h3>Struggling Readers</h3>
  <p><strong>Before reading:</strong></p>
  <ul><li>...</li><li>...</li></ul>
  <p><strong>During reading:</strong></p>
  <ul><li>...</li><li>...</li></ul>
  <p><strong>After reading:</strong></p>
  <ul><li>...</li><li>...</li></ul>
</div>

<div class="tg-subblock tg-supports"><h3>English Language Learners</h3>
  <p><strong>Before reading:</strong></p>
  <ul><li>...</li><li>...</li></ul>
  <p><strong>During reading:</strong></p>
  <ul><li>...</li><li>...</li></ul>
  <p><strong>After reading:</strong></p>
  <ul><li>...</li><li>...</li></ul>
</div>

<div class="tg-subblock tg-supports"><h3>Advanced Students</h3>
  <p><strong>Before reading:</strong></p>
  <ul><li>...</li><li>...</li></ul>
  <p><strong>During reading:</strong></p>
  <ul><li>...</li><li>...</li></ul>
  <p><strong>After reading:</strong></p>
  <ul><li>...</li><li>...</li></ul>
</div>

Each phase must contain at least 2 bullets. Bullets must reference this specific chapter (its vocabulary, characters, or events) — not generic strategies.`;

    case "common_student_questions":
      return `Generate 5–8 question/answer pairs that students are likely to ask while reading THIS chapter. Each Q is short and student-voiced; each A is teacher-facing and 1–3 sentences with a page citation when applicable.

Use this exact pattern:
<ol class="tg-csq">
  <li>
    <p><strong>Q:</strong> ...</p>
    <p><strong>A:</strong> ... (p. ...)</p>
  </li>
  ...
</ol>`;

    case "creative_response_common_errors":
      return `Identify 3–5 common errors students make on this chapter's Creative Response prompt. For each error, emit a named pattern with a Weak example and a How-to-fix line.

Use this exact pattern:
<div class="tg-weak-fix">
  <h4>[Error pattern name]</h4>
  <p><strong>Weak example:</strong> "..."</p>
  <p><strong>How to fix:</strong> ...</p>
</div>

Repeat for each error. Reference this specific chapter's creative response context.`;

    case "exit_ticket":
      return `Output an exit ticket block with these elements in this order:

<div class="tg-subblock"><h3>Prompt</h3>
  <p>One short prompt students answer in 2–4 sentences.</p>
</div>

<div class="tg-subblock"><h3>Success Criteria</h3>
  <ul>
    <li>Criterion 1 (concrete, observable).</li>
    <li>Criterion 2.</li>
    <li>Criterion 3.</li>
  </ul>
</div>

<div class="tg-subblock"><h3>Example Responses</h3>
  <ol>
    <li>Strong example response in 2–3 sentences.</li>
    <li>Adequate example response in 2–3 sentences.</li>
  </ol>
</div>

The prompt must connect to a key idea or character moment from THIS chapter. Success criteria are 3 items; example responses are 1–2 items.`;

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
  priorSections: GeneratedSection[];
}

function serializeVocabulary(vocabulary: VocabularyWord[]): string {
  return vocabulary
    .map((v, i) => `${i + 1}. word="${v.word}" quote="${v.book_quote}" page=${v.page_number}`)
    .join("\n");
}

function priorSectionsDigest(priorSections: GeneratedSection[]): string {
  if (priorSections.length === 0) return "(none — this is the first section)";
  return priorSections
    .map(
      (s) =>
        `--- prior teacher section: ${s.key} (${s.displayTitle}) ---\n${s.bodyHtml}`,
    )
    .join("\n\n");
}

export function buildTeacherSectionSystemPrompt(input: TeacherGuidePromptInputs): string {
  return `You are creating one section body for a CB4A Teacher Guide as HTML.

Output ONLY the section body HTML.
- Do NOT wrap your output in a <div class="tg-section"> or any outer section wrapper.
- Do NOT emit the section title (h1/h2) or the standing subheader text.
- Do NOT use a two-column layout, sidebars, margin callouts, page headers, or page footers.
- Do NOT use emojis.
- Output is single-column, top-to-bottom, copy-paste ready. Tip callouts are inline <div class="tg-tip"> blocks INSIDE the section flow, never floating margins.
- When you need to reference workbook questions, character names, vocabulary, or page numbers, pull them from the inputs below — never invent.

Grade calibration (apply to vocabulary depth, sentence complexity, and cognitive demand): ${gradeGuidanceFor(input.grade)}

Required section key: ${input.sectionKey}

Section-specific requirements:
${teacherSectionRequirementByKey(input.sectionKey, input.grade as GradeLevel)}`;
}

export function buildTeacherSectionUserPrompt(input: TeacherGuidePromptInputs): string {
  return `Book: ${input.bookTitle}
Author: ${input.author}
Chapter: ${input.chapterLabel}
Pages: ${input.pages}
Grade: ${input.grade}

Vocabulary words for this chapter:
${serializeVocabulary(input.vocabulary)}

Section title (for your context only, DO NOT output): ${input.sectionDisplayTitle}
Standing subheader (for your context only, DO NOT output): ${input.standingSubheader ?? "None"}

Student Workbook (HTML — source of truth for question wording):
${input.studentWorkbookHtml}

Previously generated Teacher Guide sections (for cohesion — reference codes/objectives/vocab from these instead of restating):
${priorSectionsDigest(input.priorSections)}

Chapter text:
${input.chapterText}`;
}
