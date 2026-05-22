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
  // bonus_challenge requires a chapter-count-dependent count (6 for a
  // single-chapter lesson, 10 for a multi-chapter lesson). validateItemCount
  // only handles fixed counts, so the dynamic check lives in
  // workbookValidators.ts and is derived via getBonusChallengeEventCount().
  bonus_challenge: null,
  draw_it: 1,
};

export function getExpectedItemCount(sectionKey: string): number | null {
  return STUDENT_SECTION_ITEM_COUNTS[sectionKey] ?? null;
}

/**
 * Curated structural example questions for the three core question sections
 * (Think About the Story / Reading Between the Lines / Dig Deeper).
 *
 * These come from a hand-built question bank tuned by curriculum editors. Every
 * character name, event, and setting detail has been generalized so that the
 * examples work across any book. Claude is told explicitly that these are
 * structural patterns from a different book and must NEVER be copied or
 * adapted — they exist only to communicate the expected depth, wording style,
 * and cognitive level of each section.
 */
export const CORE_QUESTION_EXAMPLES = {
  think_about_the_story: [
    "How old is the main character at the start of the chapter?",
    "Who is taking the main character to a new place?",
    "What does the main character remove or carry while traveling?",
    "What is one adult character's job or role in the community?",
    "What does the main character say when asked if they are tired?",
    "Where does the older relative plan to go after this chapter ends?",
  ],
  reading_between_the_lines: [
    "Why might the main character feel uncomfortable at the start of the journey?",
    "What does an adult's nervousness suggest about how the main character is viewed by others?",
    "Why might the main character choose to follow the animals rather than stay close to the adult?",
    "What clues show that the main character is curious or adventurous?",
    "Why does the main character's attitude make a difficult situation feel easier?",
    "What does the adult's decision to leave suggest about how she feels about her responsibilities?",
  ],
  dig_deeper: [
    "How does the main character's journey in this chapter show a change in how they feel?",
    "Compare how two adult characters describe the same person — what do their words reveal about each of them?",
    "What does this chapter suggest about how rumors can shape the way people judge someone?",
    "How does the author use a small physical action to reveal something important about a character's personality?",
    "What does this chapter suggest about children's ability to adapt to difficult changes?",
    "How does the setting of this chapter create both a feeling of challenge and a feeling of possibility?",
  ],
  wordingGuide: {
    think_about_the_story: ["Who", "What", "When", "Where"],
    reading_between_the_lines: ["Why might", "What clues show", "What does this suggest"],
    dig_deeper: ["How does", "Compare", "What does this reveal", "What lesson"],
  },
} as const;

/**
 * Grade-specific example questions for the three core question sections.
 *
 * These give Claude concrete models of how each section should sound at each
 * grade level (vocabulary, sentence length, cognitive depth). Like the generic
 * CORE_QUESTION_EXAMPLES bank, these are STYLE references only — Claude is
 * told to write fresh questions from the actual chapter, never copy these.
 *
 * Source: hand-tuned by curriculum editors using a Heidi (chapter 1) excerpt
 * as the shared subject across grades, so the only variable across rows is
 * difficulty calibration.
 */
type CoreSectionKey = "think_about_the_story" | "reading_between_the_lines" | "dig_deeper";

export const GRADE_QUESTION_EXAMPLES: Record<3 | 4 | 5 | 6 | 7 | 8, Record<CoreSectionKey, readonly string[]>> = {
  3: {
    think_about_the_story: [
      "What does Heidi take off while climbing?",
      "Who helps Deta carry the pack?",
      "Where does Grandfather live?",
      "What animals does Peter take up the mountain?",
    ],
    reading_between_the_lines: [
      "Why might Heidi feel better after taking off her heavy clothes?",
      "What clues show that Peter knows the mountain well?",
      "Why might Barbara worry about Heidi living with Grandfather?",
      "What shows that Heidi is curious when she meets Grandfather?",
    ],
    dig_deeper: [
      "How does the mountain help Heidi feel happy?",
      "What does Heidi's greeting show about her?",
      "How does Peter help Heidi on the mountain?",
      "What can readers learn from the way people talk about Grandfather?",
    ],
  },
  4: {
    think_about_the_story: [
      "Why does Heidi take off her extra clothes?",
      "What does Deta offer Peter for fetching the clothes?",
      "What does Heidi say when she first greets Grandfather?",
      "Where is Grandfather sitting when Heidi arrives?",
    ],
    reading_between_the_lines: [
      "What clues show that Heidi enjoys being on the mountain?",
      "Why might Peter smile when he sees Heidi in simple clothes?",
      "Why does Barbara think Grandfather may not welcome Heidi?",
      "What suggests that Grandfather is interested in Heidi?",
    ],
    dig_deeper: [
      "How does the mountain change Heidi's mood?",
      "What does Deta's choice show about her situation?",
      "How are Barbara and Deta different in the way they talk about Grandfather?",
      "What does Grandfather's first reaction tell readers about him?",
    ],
  },
  5: {
    think_about_the_story: [
      "What does Heidi do to make the climb easier?",
      "What does Deta offer Peter for fetching the clothes?",
      "What happened to Heidi's parents?",
      "What does Grandfather ask when Deta brings Heidi to him?",
    ],
    reading_between_the_lines: [
      "Why does Heidi seem more confident after removing the extra layers?",
      "What does Peter's reaction to the coin suggest about his life?",
      "Why does Heidi seem unafraid when she meets Grandfather?",
      "What clues suggest that Deta feels she has done her part for Heidi?",
    ],
    dig_deeper: [
      "How does the mountain setting help show Heidi's personality?",
      "How do Barbara's words affect the way readers first see Alm-Uncle?",
      "How does Heidi's arrival begin to change the mood around Grandfather's hut?",
      "What does the chapter suggest about judging someone before knowing them?",
    ],
  },
  6: {
    think_about_the_story: [
      "What problem does Heidi solve by removing her heavy clothes?",
      "What details describe the area around Grandfather's hut?",
      "What does Deta explain about Tobias and Adelheid?",
      "How does Peter earn the five-penny coin?",
    ],
    reading_between_the_lines: [
      "What does Heidi's reaction to the mountain suggest about her personality?",
      "Why might Grandfather worry about caring for Heidi?",
      "What clues show that Peter is used to being independent?",
      "Why might Deta speak firmly when she talks about Grandfather's responsibility?",
    ],
    dig_deeper: [
      "How does the setting affect Heidi's sense of freedom?",
      "How does Grandfather's first response complicate what the village believes about him?",
      "How does Deta's conversation with Barbara develop the conflict of the chapter?",
      "What does Heidi's behavior suggest about adapting to a new life?",
    ],
  },
  7: {
    think_about_the_story: [
      "Which details show that Heidi becomes more comfortable on the mountain?",
      "What does Deta say about why Heidi must stay with Grandfather?",
      "What information does Deta share about Alm-Uncle's past?",
      "What does Heidi notice when she looks at Grandfather?",
    ],
    reading_between_the_lines: [
      "How does Heidi's behavior suggest that she is beginning to feel free?",
      "What clues suggest that Grandfather may be kinder than people expect?",
      "Why might Peter prefer spending time with the goats on the mountain?",
      "What does Deta's explanation reveal about the pressure she feels?",
    ],
    dig_deeper: [
      "How does the author use the mountain setting to reveal Heidi's character?",
      "What does the contrast between Barbara's fear and Heidi's cheerfulness reveal?",
      "How does Grandfather's reputation create tension before Heidi meets him?",
      "How does the chapter explore responsibility through Deta and Grandfather?",
    ],
  },
  8: {
    think_about_the_story: [
      "What details describe Alm-Uncle's hut and its surroundings?",
      "What reason does Deta give for leaving Heidi with Grandfather?",
      "What does the chapter reveal about Tobias and Adelheid?",
      "How does Grandfather respond when Heidi first greets him?",
    ],
    reading_between_the_lines: [
      "What does Heidi's response to the mountain suggest about her independence?",
      "What clues suggest that Grandfather may be different from his reputation?",
      "How does Peter's reaction to the coin reveal something about his circumstances?",
      "What does Deta's tone suggest about how she views her duty to Heidi?",
    ],
    dig_deeper: [
      "How does the contrast between village gossip and Grandfather's smile shape the reader's view of him?",
      "How does Heidi's climb develop the chapter's theme of freedom and belonging?",
      "How does the author use setting to contrast isolation with possibility?",
      "What does the chapter suggest about the difference between reputation and reality?",
    ],
  },
} as const;

/**
 * Returns grade-level example questions for one of the three core sections.
 *
 * Selection rules:
 * - Grades 3-8: returns the exact-grade examples.
 * - Anything outside 3-8 is clamped to the nearest supported grade (3 or 8),
 *   matching how the rest of the pipeline (vocab pools, grade calibration)
 *   already treats out-of-range grades.
 */
export function getGradeQuestionExamples(
  grade: number,
  sectionKey: CoreSectionKey,
): readonly string[] {
  const clamped = Math.min(8, Math.max(3, Math.trunc(grade))) as 3 | 4 | 5 | 6 | 7 | 8;
  return GRADE_QUESTION_EXAMPLES[clamped][sectionKey];
}

export function studentSectionRequirementByKey(key: string, chapterCount: number = 1): string {
  switch (key) {
    case "get_ready_to_read":
      return `<div class="focus-question"><div class="focus-label">FOCUS QUESTION</div><p>...</p></div>.
Output exactly one short open-ended personal pre-reading question in a single <p> under 25 words. No plot recap. No chapter event summary.`;
    case "words_to_know":
      return `Output NOTHING except the placeholder:
WORDS_TO_KNOW_TABLE_PLACEHOLDER
Do not include: vocabulary lists, definitions, example sentences, fill-in exercises, duplicate tables.`;
    case "multiple_choice_questions":
      return "Do not force vocabulary words into the questions. Write natural story-based questions that match the section purpose.\n" +
        '<div class="mc-item"><div class="question">...</div><ul class="mc-options"><li>A. ...</li><li>B. ...</li><li>C. ...</li><li>D. ...</li></ul></div> with exactly 3 questions.';
    case "evidence_from_the_story":
      return "Do not force vocabulary words into the questions. Write natural story-based questions that match the section purpose.\n" +
        `<ol class="question-list"><li class="question-item"><div class="question">...</div>${answerLines(3)}</li></ol> with exactly 3 questions.`;
    case "creative_response":
      return `Write a 2–3 sentence letter-writing prompt for the student that is rooted in THIS chapter.

Format: a single <p>...</p> block. Output ONLY the <p> block — no other HTML, no surrounding text.

Required structure of the prompt sentences:
1. "Imagine you are <name of the chapter's main character>."
2. "Write a letter to <a fitting recipient — pick a real character from this chapter or earlier in the book who would naturally hear about what just happened>."
3. One short sentence telling the student what to write about — name something concrete that happens in THIS chapter (a place, an event, a person they meet).
4. End with: "Include at least three details from the chapter."

Example for a different book where a boy named Sam is rescued from the river by a stranger named Mr. Hale:
<p>Imagine you are Sam. Write a letter to your mother telling her about the day you fell into the river and how Mr. Hale pulled you out. Include at least three details from the chapter.</p>

Do NOT copy that example. Do NOT include vocabulary words. Do NOT include any letter template (no "Dear", no "Sincerely") — only the prompt instructions.`;
    case "writing_rubric":
      return "Checklist table with exactly 4 criteria rows: I answered the prompt; I included details from Chapter 1; I wrote in Heidi's voice; I checked my spelling and grammar.";
    case "character_chart":
      return "Character table with exactly 5 rows and columns: Character Name, What They Look Like and How They Act, What This Shows About Them.";
    case "draw_it":
      return "Output exactly 1 item. One sentence under 25 words. No paragraph. No list. No scene-description list.";
    case "reflect_on_your_drawing":
      return "Exactly 3 sentence stems for reflection.";
    case "bonus_challenge": {
      const bonusCount = chapterCount >= 2 ? 10 : 6;
      const chapterScopeLine = chapterCount >= 2
        ? `This lesson covers ${chapterCount} chapters — distribute the ${bonusCount} events across all of them so the timeline spans the entire lesson, not just one chapter.`
        : `Use ${bonusCount} of the chapter's strongest plot beats.`;
      return `<ol class="timeline-list"><li data-page="N">...</li></ol> with EXACTLY ${bonusCount} events from the chapter, each one a single sentence. ${chapterScopeLine} Pick the strongest plot-driving moments — never pad with weak events.

For EACH <li>, include a data-page="N" attribute set to the chapter page number where that event happens (use the earliest page if the event spans multiple pages). You do NOT need to pre-sort the events — the system sorts them by data-page to produce the chronological answer key, then shuffles them for the student.

WHAT COUNTS AS AN EVENT (selection rule):
Each event must be a moment where SOMETHING HAPPENS OR CHANGES — a character arrives, leaves, decides, acts, or speaks the line that drives the next scene. A reader skimming your events should be able to retell the chapter's plot in order. Favor present-tense action with a clear subject and verb. The student is sequencing the chapter's PLOT, not its background.

DO NOT INCLUDE these event types:
- Backstory exposition recited by a character (e.g., "Deta tells Barbara that Tobias was a carpenter") — that's background, not present action.
- Minor object exchanges (e.g., "Peter hands a bundle back") — only include if the exchange is itself a turning point.
- Generic descriptions or observations (e.g., "Heidi looks at her grandfather's beard") — replace with the speaking/doing moment that surrounds it (e.g., "Heidi calls out 'Good evening, Grandfather!' as they reach the hut").
- Restating a quote without naming the action (e.g., "Barbara says he is scary") — turn it into the action ("Barbara warns Deta that the villagers avoid the old man because he is frightening").

EXAMPLE — for a different chapter where a girl named Anna runs away from school:
GOOD events (use this style):
  <li data-page="2">Anna hides her lunchbox under her desk so the teacher will not see it during morning lessons.</li>
  <li data-page="3">Anna slips out the back door of the schoolhouse during recess and starts running toward the woods.</li>
  <li data-page="5">Anna reaches the river and decides to follow it downstream toward the next village.</li>
BAD events (do NOT do this):
  <li data-page="2">Anna's teacher is described as strict, and her classmates are afraid of getting in trouble.</li>  ← background description, not an event
  <li data-page="3">Anna remembers that her grandmother once told her the woods were safe in summer.</li>  ← memory/backstory, not present action
  <li data-page="5">Anna sees the river.</li>  ← too generic; what does she DO?

SELF-AUDIT — before returning, silently re-read each of your events and check:
  1. Does it describe an action that happens IN this chapter (not backstory)?
  2. Does the data-page value match where the event actually occurs?
  3. Could a child retell the plot from your events alone?
If any event fails, replace it with a stronger one from the same part of the chapter — output must contain EXACTLY ${bonusCount} events.`;
    }
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
  /**
   * Number of book chapters covered by this lesson. Threaded into the
   * bonus_challenge formatting target so the prompt asks Claude for the right
   * event count (6 for single-chapter lessons, 10 for multi-chapter lessons).
   * Defaults to 1 when omitted to preserve legacy single-chapter behavior.
   */
  chapterCount?: number;
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
Formatting target: ${studentSectionRequirementByKey(input.sectionKey, input.chapterCount ?? 1)}
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

// ---------------------------------------------------------------------------
// Combined core question sections (Task #35 / Task #41)
//
// Five question sections are generated together in a single Claude call so
// that Claude can deliberately escalate cognitive demand across the sections
// and avoid repeating the same question at the same level. The combined call
// also produces a structured JSON answers block so the Teacher Guide can
// render answer key sections directly — eliminating fragile HTML extraction.
// ---------------------------------------------------------------------------

export const CORE_QUESTION_SECTION_KEYS = [
  "think_about_the_story",
  "reading_between_the_lines",
  "dig_deeper",
  "multiple_choice_questions",
  "evidence_from_the_story",
] as const;

export type CoreQuestionSectionKey = (typeof CORE_QUESTION_SECTION_KEYS)[number];

export interface CoreQuestionsPromptInputs {
  bookTitle: string;
  author: string;
  chapterLabel: string;
  pages: string;
  grade: number;
  vocabulary: VocabularyWord[];
  chapterText: string;
}

function delimiterFor(key: CoreQuestionSectionKey): string {
  return `<!-- SECTION:${key} -->`;
}

function formatExampleBlock(label: string, examples: readonly string[]): string {
  const lines = examples.map((line) => `- ${line}`).join("\n");
  return `${label}:\n${lines}`;
}

function formatWordingGuideBlock(): string {
  const tats = CORE_QUESTION_EXAMPLES.wordingGuide.think_about_the_story.join(", ");
  const rbtl = CORE_QUESTION_EXAMPLES.wordingGuide.reading_between_the_lines.join(", ");
  const dd = CORE_QUESTION_EXAMPLES.wordingGuide.dig_deeper.join(", ");
  return `- Think About the Story starters: ${tats}
- Reading Between the Lines starters: ${rbtl}
- Dig Deeper starters: ${dd}`;
}

export const ANSWERS_JSON_DELIMITER = "<!-- SECTION:answers_json -->";

export function buildCoreQuestionsCombinedSystemPrompt(input: CoreQuestionsPromptInputs): string {
  const tatsDelim = delimiterFor("think_about_the_story");
  const rbtlDelim = delimiterFor("reading_between_the_lines");
  const ddDelim = delimiterFor("dig_deeper");
  const mcDelim = delimiterFor("multiple_choice_questions");
  const etsDelim = delimiterFor("evidence_from_the_story");

  return `You are creating five connected question sections of a CB4A Student Workbook as HTML, generated together in a single pass so each section is aware of the others. After the five HTML sections you will output a JSON answers block for the Teacher Guide.

Output ONLY the body HTML for the five sections followed by the JSON block, each separated by the delimiter comments shown below. Do not include section titles, standing subheaders, wrapper divs, intros, summaries, headings, or any other text outside the delimited blocks.
Question text must not start with numbering prefixes. Never use emojis.

Grade calibration: ${gradeGuidanceFor(input.grade)}

The five sections, in order:

1. Think About the Story (LITERAL recall) — exactly 6 questions
   Cognitive test: "Can the answer be found directly in one place in the chapter?"
   - Answers must be stated directly in the text.
   - Each question has ONE clear answer that comes from a single location.
   - Each answer is ONE sentence.
   - Do NOT require interpretation, opinion, inference, or multi-step thinking.
   - Disallowed phrasings: "Why do you think...", "How does this show...", emotional reasoning.

2. Reading Between the Lines (INFERENCE) — exactly 3 questions
   Cognitive test: "Does the student need to use clues from the text to answer?"
   - Answers are NOT directly stated; they must be supported by clues.
   - Focus on character feelings, motivations, or reactions.
   - Each answer must include reasoning ("because ...").
   - Do NOT ask opinion-only or direct factual questions.

3. Dig Deeper (ANALYSIS) — exactly 3 questions
   Cognitive test: "Does the student need to explain a bigger idea?"
   - Answers go beyond the text: comparison, cause/effect, theme, symbolism, or "what if" scenarios.
   - Answers must be justifiable using evidence from the text.
   - Questions should NOT be answerable in a single sentence.
   - Do NOT ask simple inference or direct factual questions.

4. Multiple Choice Questions (APPLICATION) — exactly 3 questions
   Each question tests whether students can identify key events, characters, or details.
   - Questions should be story-based and natural — do NOT force vocabulary words into questions.
   - Each question has exactly 4 options: A, B, C, D. Exactly one option is correct.
   - Distractors should be plausible to a careless reader but clearly wrong to a careful one.
   - Do NOT repeat questions already covered at the same cognitive level in sections 1–3.

5. Evidence From the Story (QUOTATION EVIDENCE) — exactly 3 questions
   Each question prompts students to find and record a direct quote from the text.
   - Questions should direct students to a specific moment, action, or feeling.
   - Answers must be supportable with a real, findable quote from the chapter.
   - Do NOT repeat questions already covered in sections 1–4.

Layered questioning is ENCOURAGED across sections 1–3. The same event MAY appear at a different cognitive level in a later section. What is NOT allowed: the same question repeated at the same cognitive level, or near-duplicate phrasings within a single section.

Wording guide (use these as starter phrases, mix and match — do not use any single starter twice in one section):
${formatWordingGuideBlock()}

Question style examples — IMPORTANT: these are STRUCTURAL PATTERNS from a DIFFERENT book. They illustrate the expected depth, wording style, and cognitive level only. Do NOT copy them. Do NOT adapt them. Replace every character, event, setting, and detail with content from the chapter text provided in the user message. Use the actual names, places, and events from this chapter — fall back to a descriptive role only when the chapter itself never names a character.

${formatExampleBlock("THINK ABOUT THE STORY (style examples)", CORE_QUESTION_EXAMPLES.think_about_the_story)}

${formatExampleBlock("READING BETWEEN THE LINES (style examples)", CORE_QUESTION_EXAMPLES.reading_between_the_lines)}

${formatExampleBlock("DIG DEEPER (style examples)", CORE_QUESTION_EXAMPLES.dig_deeper)}

Use these examples as grade-level and section-style models. Match their clarity, difficulty, sentence length, and question style. Write fresh questions using only the provided chapter.

${formatExampleBlock(`Grade ${input.grade} examples — Think About the Story`, getGradeQuestionExamples(input.grade, "think_about_the_story"))}

${formatExampleBlock(`Grade ${input.grade} examples — Reading Between the Lines`, getGradeQuestionExamples(input.grade, "reading_between_the_lines"))}

${formatExampleBlock(`Grade ${input.grade} examples — Dig Deeper`, getGradeQuestionExamples(input.grade, "dig_deeper"))}

Per-item rules for HTML sections:
- Use only chapter text and the provided vocabulary words.
- Do not force vocabulary words into questions.
- Think About the Story and Reading Between the Lines questions must each be ONE sentence under 22 words.
- Dig Deeper questions must each be ONE sentence (no length cap, but keep them concise).
- Multiple Choice and Evidence From the Story questions must each be ONE sentence under 35 words.
- Each <li class="question-item"> must contain exactly one <div class="question"> followed by the correct number of <div class="answer-space"></div> elements (2 for sections 1–3, 3 for section 5).

Answers JSON rules:
- Output raw JSON — NO markdown fences, NO extra text outside the delimited block.
- Copy the "question" value for each entry EXACTLY as written in the HTML sections above (word for word).
- For thinkAboutTheStory.answers: the "answer" must cite the specific text evidence; "page" is the actual page number.
- For readingBetweenTheLines and digDeeper: the "answer" includes the inference or analysis reasoning.
- For multipleChoice: "correctLetter" must be exactly A, B, C, or D (the option you wrote as correct above).
- For evidenceFromTheStory: "sampleAnswer" is 1–2 sentences; "quote" is verbatim text from the chapter.
- For characterChart: include one entry per significant named character from this chapter (typically 3–5 entries).
- For drawItDetails: 3–5 specific visual elements the student should include in their drawing of the chapter.
- inferentialPrompts, analyticalThinking, personalConnection: 2–3 items each.
- tieredDiscussion: 2–3 items per tier (literal, inference, analysis, evaluation).

Output format (EXACTLY this structure — all six delimiter comments, nothing else outside the blocks):

${tatsDelim}
<ol class="question-list">
  <li class="question-item"><div class="question">...</div>${ANSWER_SPACE}${ANSWER_SPACE}</li>
  ... (6 items total)
</ol>
${rbtlDelim}
<ol class="question-list">
  <li class="question-item"><div class="question">...</div>${ANSWER_SPACE}${ANSWER_SPACE}</li>
  ... (3 items total)
</ol>
${ddDelim}
<ol class="question-list">
  <li class="question-item"><div class="question">...</div>${ANSWER_SPACE}${ANSWER_SPACE}</li>
  ... (3 items total)
</ol>
${mcDelim}
<div class="mc-item"><div class="question">...</div><ul class="mc-options"><li>A. ...</li><li>B. ...</li><li>C. ...</li><li>D. ...</li></ul></div>
... (3 items total)
${etsDelim}
<ol class="question-list">
  <li class="question-item"><div class="question">...</div>${ANSWER_SPACE}${ANSWER_SPACE}${ANSWER_SPACE}</li>
  ... (3 items total)
</ol>
${ANSWERS_JSON_DELIMITER}
{
  "thinkAboutTheStory": {
    "answers": [ { "question": "<copy EXACTLY from TATS above>", "answer": "...", "page": N }, ... (6 items) ],
    "inferentialPrompts": [ "...", "..." ],
    "tieredDiscussion": { "literal": [ "..." ], "inference": [ "..." ], "analysis": [ "..." ], "evaluation": [ "..." ] },
    "analyticalThinking": [ "...", "..." ],
    "personalConnection": [ "...", "..." ]
  },
  "readingBetweenTheLines": [ { "question": "<copy EXACTLY from RBTL above>", "answer": "...", "page": N }, ... (3 items) ],
  "digDeeper": [ { "question": "<copy EXACTLY from DD above>", "answer": "...", "page": N }, ... (3 items) ],
  "multipleChoice": [ { "question": "<copy EXACTLY from MC above>", "correctLetter": "A or B or C or D", "rationale": "..." }, ... (3 items) ],
  "evidenceFromTheStory": [ { "question": "<copy EXACTLY from ETS above>", "sampleAnswer": "...", "quote": "...", "page": N }, ... (3 items) ],
  "characterChart": [ { "characterName": "...", "description": "...", "whatThisShows": "...", "quote": "...", "page": N }, ... (3–5 entries) ],
  "drawItDetails": [ "...", "...", "..." ]
}`;
}

export function buildCoreQuestionsCombinedUserPrompt(input: CoreQuestionsPromptInputs): string {
  return `Book: ${input.bookTitle}
Author: ${input.author}
Chapter: ${input.chapterLabel}
Pages: ${input.pages}
Grade: ${input.grade}

Vocabulary words (available — do not force them into questions):
${serializeVocabulary(input.vocabulary)}

Chapter text:
${input.chapterText}`;
}

export type ParsedCoreQuestions = Record<CoreQuestionSectionKey, string>;

/**
 * The structured return value from parseCoreQuestionsResponse.
 *
 * - questions: raw HTML body for each of the five student workbook sections.
 * - answersJsonRaw: the raw JSON string from the answers_json delimiter block,
 *   ready to be parsed by parseWorkbookAnswers in studentWorkbook.ts.
 */
export interface ParsedCoreQuestionsResponse {
  questions: ParsedCoreQuestions;
  answersJsonRaw: string;
}

/**
 * Splits the combined Claude response on the five HTML section delimiter
 * comments and the trailing answers_json delimiter, returning the raw HTML
 * body for each section plus the raw answers JSON string.
 *
 * Throws a descriptive error if any delimiter is missing or if the delimiters
 * appear out of order, so generation fails loudly rather than silently
 * producing empty sections or answer keys.
 */
export function parseCoreQuestionsResponse(raw: string): ParsedCoreQuestionsResponse {
  const htmlPositions = CORE_QUESTION_SECTION_KEYS.map((key) => {
    const delimiter = delimiterFor(key);
    const index = raw.indexOf(delimiter);
    return { key, delimiter, index };
  });
  const answersPos = {
    key: "answers_json" as const,
    delimiter: ANSWERS_JSON_DELIMITER,
    index: raw.indexOf(ANSWERS_JSON_DELIMITER),
  };
  const allPositions = [...htmlPositions, answersPos];

  for (const { key, delimiter, index } of allPositions) {
    if (index === -1) {
      throw new Error(
        `Combined core-questions response is missing the "${delimiter}" delimiter for section "${key}".`,
      );
    }
  }

  for (let i = 1; i < allPositions.length; i += 1) {
    if (allPositions[i].index <= allPositions[i - 1].index) {
      throw new Error(
        `Combined core-questions response delimiters are out of order: "${allPositions[i - 1].delimiter}" must appear before "${allPositions[i].delimiter}".`,
      );
    }
  }

  const questions = {} as ParsedCoreQuestions;
  for (let i = 0; i < htmlPositions.length; i += 1) {
    const { key, delimiter, index } = htmlPositions[i];
    const start = index + delimiter.length;
    const end = allPositions[i + 1].index;
    questions[key as CoreQuestionSectionKey] = raw.slice(start, end).trim();
  }

  const answersStart = answersPos.index + answersPos.delimiter.length;
  const answersJsonRaw = raw.slice(answersStart).trim();

  return { questions, answersJsonRaw };
}
