/**
 * Teacher Guide prompts — every prompt asks Claude to return ONLY a JSON
 * object matching the corresponding interface in teacherGuideTypes.ts.
 * No HTML, no headings, no class names. TypeScript renderers handle every
 * structural decision.
 */

import { gradeGuidanceFor } from "./gradeGuidance.js";
import type { VocabularyWord } from "../vocabulary/types.js";
import { formatStandardsForPrompt } from "../standards/index.js";
import type { GradeLevel } from "../standards/types.js";

const QUESTION_TYPES = [
  "comprehension",
  "inference",
  "analysis",
  "evaluation",
  "vocabulary and inference",
] as const;

export function teacherSectionRequirementByKey(key: string, grade?: GradeLevel): string {
  const gradeLevel = (grade ?? 4) as GradeLevel;
  switch (key) {
    case "measurable_objectives":
      return `Return a JSON object with this exact shape and nothing else:

{
  "objectives": [
    { "text": "Identify and describe main characters using evidence from the text", "standardCode": "RL.${gradeLevel}.3" },
    { "text": "Define key vocabulary words using context clues", "standardCode": "L.${gradeLevel}.4" },
    { "text": "Sequence major events and explain their importance", "standardCode": "RL.${gradeLevel}.2" },
    { "text": "Make inferences about character feelings and motivations", "standardCode": "RL.${gradeLevel}.1" },
    { "text": "Engage in collaborative discussions", "standardCode": "SL.${gradeLevel}.1" },
    { "text": "Write a narrative or written response using clear event sequence and details", "standardCode": "W.${gradeLevel}.3" }
  ]
}

Rules:
- Output 5–6 objective items.
- Each "text" is a polished, curriculum-style objective fragment that completes the shared stem "Students will be able to...".
- Do NOT include the stem "Students will be able to" in any "text" value.
- Each "text" begins with a strong measurable verb in title case (for example: Identify, Define, Sequence, Make, Engage, Write, Explain, Compare, Analyze).
- Write each objective as a concise fragment, not a full sentence: no ending periods, no first-person language, and no vague verbs such as understand, learn, know, or appreciate.
- Use classroom-ready language that names the skill and, when useful, the evidence, strategy, or product students will use.
- Each "standardCode" must be an exact code for grade ${gradeLevel} from the standards block. Never invent codes.
- The standardCode is the bare code (e.g. "RL.${gradeLevel}.1"), no parentheses, no extra text.

Return ONLY the JSON object. No markdown fences, no commentary.`;

    case "standards": {
      const standardsBlock = formatStandardsForPrompt(gradeLevel);
      return `Return a JSON object with this exact shape and nothing else:

{
  "standards": [
    { "code": "RL.${gradeLevel}.1", "lessonSections": ["Think About the Story", "Reading Between the Lines"] },
    { "code": "W.${gradeLevel}.3", "lessonSections": ["Creative Response"] }
  ]
}

Rules:
- Pick the standards this chapter actually addresses. Coverage must include at least:
  - one Reading standard (RL.${gradeLevel}.* or RI.${gradeLevel}.*)
  - one Writing standard (W.${gradeLevel}.*)
  - one Language standard (L.${gradeLevel}.*) — vocabulary mini-lesson maps here
  - one Speaking and Listening standard (SL.${gradeLevel}.*) — discussion maps here
- Each "code" must be an exact grade-${gradeLevel} code from the standards block below. Do NOT invent codes.
- Each "lessonSections" is an array of student workbook section names this standard maps to (e.g. "Think About the Story", "Words to Know", "Creative Response").
- Standard descriptions are filled in from a code lookup table — do NOT include description text.

Available standards (use ONLY these — do not invent codes):
${standardsBlock}

Return ONLY the JSON object. No markdown fences, no commentary.`;
    }

    case "get_ready_to_read":
      return `Return a JSON object with this exact shape and nothing else:

{
  "quickWritePrompt": "Have you ever moved to a new place where you didn't know anyone? What did that feel like?",
  "implementationSteps": [
    "Display the prompt and read it aloud.",
    "Give students 3–5 minutes to write quietly.",
    "Have students share with an elbow partner.",
    "Invite 2–3 students to share with the whole class.",
    "Connect responses to today's chapter."
  ],
  "connectionTip": "This warm-up activates students' background knowledge about change and unfamiliar settings, preparing them for the chapter's themes."
}

Rules:
- "quickWritePrompt": ONE short open-ended question students respond to in writing. Connect to a theme or situation in this chapter without spoiling plot. No quote marks inside the string.
- "implementationSteps": 4–5 short steps covering display, write time, partner share, whole-class share, connection to chapter.
- "connectionTip": one sentence explaining why this warm-up activates schema for the chapter.

Return ONLY the JSON object. No markdown fences, no commentary.`;

    case "words_to_know_mini_lesson":
      return `Return a JSON object with this exact shape and nothing else:

{
  "workedWord": "scrambled",
  "workedQuote": "She scrambled up the steep mountain path.",
  "workedPage": 7,
  "contextClueStrategy": "Look at the verbs around the word — 'climbing' and 'pulling herself up' suggest a quick, hurried movement using hands and feet.",
  "studentDefinition": "moved quickly and clumsily, using hands and feet",
  "vocabularyTip": "Have students act out the word as a quick gesture before writing the definition — physicalizing the meaning helps it stick."
}

Rules:
- "workedWord": ONE real word from the provided vocabulary list.
- "workedQuote": a real, verbatim quote from the chapter that contains the worked word.
- "workedPage": the page number where the quote appears.
- "contextClueStrategy": describe how a student would use surrounding text to figure out the meaning.
- "studentDefinition": short, kid-friendly definition.
- "vocabularyTip": short pedagogical extension idea (morphology, figurative-language tie-in, scaffolding for stronger or weaker readers).

Return ONLY the JSON object. No markdown fences, no commentary.`;

    case "guided_reading":
      return `Return a JSON object with this exact shape and nothing else:

{
  "sections": [
    {
      "pageStart": 4,
      "pageEnd": 6,
      "openingPhrase": "It was a bright June morning",
      "closingPhrase": "Heidi stood at the top of the path",
      "questions": [
        { "text": "Who is Heidi traveling with at the start of the chapter?", "questionType": "comprehension" },
        { "text": "What clues suggest that Heidi feels excited rather than afraid?", "questionType": "inference" }
      ]
    }
  ],
  "readAloudTip": "Pause at the closing phrase of each section to let students summarize before moving on."
}

Rules:
- Split the chapter into 3–4 sections that together COVER THE FULL CHAPTER PAGE RANGE in order. No overlapping ranges.
- Each section has 2–4 pause-point questions.
- Each "questionType" must be EXACTLY one of: ${QUESTION_TYPES.map((t) => `"${t}"`).join(", ")}.
- Vary question types across sections — do not use the same type every time.
- "openingPhrase" and "closingPhrase" must come VERBATIM from the actual chapter text.
- "readAloudTip": one sentence of pedagogical advice for reading these sections aloud.

Return ONLY the JSON object. No markdown fences, no commentary.`;

    case "think_about_the_story_answers":
      return `For each "Think About the Story" question in the Student Workbook (provided in the workbook context), provide the teacher-facing answer.

Return a JSON object with this exact shape and nothing else:

{
  "answers": [
    { "question": "Who is taking Heidi up the mountain?", "answer": "Her aunt Deta is taking her to live with her grandfather.", "page": 4 }
  ],
  "inferentialPrompts": [
    "What does Heidi's behavior on the climb suggest about her personality?",
    "Why might Deta be eager to leave Heidi with Grandfather?"
  ],
  "tieredDiscussion": {
    "literal": ["Where does Grandfather live?", "What does Peter do for work?"],
    "inference": ["What does Grandfather's reputation suggest about how the village treats him?", "Why might Heidi feel free on the mountain?"],
    "analysis": ["How does the contrast between Deta and Heidi reveal each character?"],
    "evaluation": ["Was Deta right to leave Heidi with Grandfather? Defend your answer with text evidence."]
  },
  "analyticalThinking": [
    "How does the author use the mountain setting to reveal Heidi's personality?",
    "What does the chapter suggest about reputation versus reality?"
  ],
  "personalConnection": [
    "Have you ever been judged before someone got to know you? How did that feel?",
    "Describe a place where you feel completely free, like Heidi does on the mountain."
  ]
}

Rules:
- "answers": one entry per question in the workbook's Think About the Story section, IN ORDER. Restate the question exactly as it appears in the workbook. Each answer is 1–2 sentences with a page citation.
- "inferentialPrompts": 2–3 deeper teacher follow-up prompts that push beyond literal recall.
- "tieredDiscussion": 1–3 prompts at each cognitive tier (literal, inference, analysis, evaluation).
- "analyticalThinking": 2–3 higher-order prompts focused on author's craft, theme, or symbolism.
- "personalConnection": 2–3 prompts that link the chapter's themes to students' own lives.

Return ONLY the JSON object. No markdown fences, no commentary.`;

    case "answer_key":
      return `Provide a teacher answer key for the workbook sections supplied in the workbook context. The questions are already written — your job is to ANSWER them, in order, using the chapter text.

Return a JSON object with this exact shape and nothing else:

{
  "readingBetweenTheLines": [
    { "question": "<workbook question, restated exactly>", "answer": "<1–2 sentence teacher answer>", "page": 5 }
  ],
  "digDeeper": [
    { "question": "<workbook question, restated exactly>", "answer": "<2–4 sentence teacher answer>", "page": 7 }
  ],
  "multipleChoice": [
    { "question": "<workbook question, restated exactly>", "correctLetter": "B", "rationale": "Page 6 says exactly..." }
  ],
  "evidenceFromTheStory": [
    { "question": "<workbook question, restated exactly>", "sampleAnswer": "<sample student answer>", "quote": "<exact quote from chapter>", "page": 8 }
  ],
  "characterChart": [
    { "characterName": "Heidi", "description": "Curious and energetic; runs ahead on the climb.", "whatThisShows": "She adapts quickly to new situations.", "quote": "She scrambled up the steep path", "page": 5 }
  ],
  "drawItDetails": [
    "Heidi's simple dress visible after she removes her layers",
    "The steep mountain path with goats nearby",
    "Grandfather's hut at the top with the dark fir trees behind it"
  ]
}

Rules:
- "readingBetweenTheLines", "digDeeper", "multipleChoice", "evidenceFromTheStory": one entry per question in the workbook context, IN ORDER. Restate each question EXACTLY as it appears in the workbook.
- "multipleChoice.correctLetter" must be EXACTLY one of: "A", "B", "C", "D".
- "characterChart": one entry per character row in the workbook's character chart. Use real characters from THIS chapter.
- "drawItDetails": 3–5 concrete visual elements students should consider including, grounded in the chapter.
- All page numbers must come from this chapter's actual page range.

Return ONLY the JSON object. No markdown fences, no commentary.`;

    case "differentiated_supports":
      return `Return a JSON object with this exact shape and nothing else:

{
  "strugglingReaders": {
    "before": ["Pre-teach 2–3 challenging vocabulary words.", "Show a quick image gallery of mountain settings to build context."],
    "during": ["Read the first paragraph aloud together.", "Have students mark unknown words with a question mark."],
    "after": ["Pair students to summarize each page in one sentence.", "Use the Words to Know table for guided definition writing."]
  },
  "englishLanguageLearners": {
    "before": ["Provide a translated glossary of the chapter's key vocabulary."],
    "during": ["Use a sentence frame: 'I think Heidi feels ___ because ___.'"],
    "after": ["Allow students to draw their answer to a comprehension question before writing it."]
  },
  "advancedStudents": {
    "before": ["Pose an open question: 'What might cause an adult to send a child away?'"],
    "during": ["Track each character's emotional shifts in a notebook."],
    "after": ["Compare this opening chapter to the opening of another classic novel they've read."]
  }
}

Rules:
- All three groups required: "strugglingReaders", "englishLanguageLearners", "advancedStudents".
- Each group has "before", "during", "after" arrays with at least 2 strategies each.
- Strategies must reference THIS specific chapter — its vocabulary, characters, or events. No generic strategies.

Return ONLY the JSON object. No markdown fences, no commentary.`;

    case "common_student_questions":
      return `Return a JSON object with this exact shape and nothing else:

{
  "questions": [
    { "studentQ": "Why doesn't Heidi want to wear all those clothes?", "teacherA": "Heidi removes the heavy clothes because she finds them hot and uncomfortable on the climb.", "page": 5 },
    { "studentQ": "Why is everyone afraid of Grandfather?", "teacherA": "The villagers gossip about him because he lives alone on the mountain and rarely speaks to people. The chapter doesn't confirm whether the gossip is fair.", "page": 6 }
  ]
}

Rules:
- 5–8 question/answer pairs that students are LIKELY to ask while reading THIS chapter.
- "studentQ": short, student-voiced.
- "teacherA": teacher-facing, 1–3 sentences.
- "page" is optional; include it whenever the answer points to a specific page.

Return ONLY the JSON object. No markdown fences, no commentary.`;

    case "creative_response_common_errors":
      return `Return a JSON object with this exact shape and nothing else:

{
  "characterName": "Heidi",
  "errors": {
    "noSpecificDetails": {
      "paragraph": "Students often write generic letters that could describe any character. Without details from the chapter, the response feels disconnected from the source material.",
      "weakExample": "I am writing to tell you about my new home. It is very nice here. I like it a lot.",
      "howToFix": "Coach students to name at least two specific details: a real character, a real setting, or a real event from the chapter."
    },
    "breakingCharacter": {
      "paragraph": "Students sometimes drop the persona and write as themselves, breaking the immersion of the creative response.",
      "weakExample": "Hi! My teacher said I had to write this letter as Heidi. So here it is. I think Heidi is kind.",
      "howToFix": "Remind students to use 'I' and write everything from the character's perspective, never referring to themselves as a student."
    },
    "retelling": {
      "paragraph": "Students retell the entire chapter rather than focusing on the character's inner experience and reflection.",
      "weakExample": "First we left home. Then we walked up the mountain. Then I met Grandfather.",
      "howToFix": "Ask students to focus on ONE moment and describe how the character FELT, not just what happened."
    },
    "noEvidence": {
      "paragraph": "Students make claims about the character or events without grounding them in the actual text.",
      "weakExample": "I love the mountain. It is the best place ever.",
      "howToFix": "Have students underline 1–2 lines in the chapter and weave them into their response — even paraphrased."
    },
    "modernLanguage": {
      "paragraph": "Students slip into present-day vocabulary and slang that doesn't fit the time period or setting of the story.",
      "weakExample": "Grandfather's hut is super lit. The vibe is amazing.",
      "howToFix": "Read 1–2 sentences from the chapter aloud and ask students to match that style and word choice in their writing."
    }
  }
}

Rules:
- "characterName": the chapter's main character (used in the renderer's "Retelling" heading).
- All five error keys are required, in this exact shape.
- Each error has "paragraph" (1–2 sentences), "weakExample" (a concrete student response), "howToFix" (a teacher coaching tip).

Return ONLY the JSON object. No markdown fences, no commentary.`;

    case "exit_ticket":
      return `Return a JSON object with this exact shape and nothing else:

{
  "prompt": "Predict what you think will happen between Heidi and Grandfather in the next chapter. Use 'because' and at least one detail from this chapter to support your prediction.",
  "successCriteria": [
    "Names a specific prediction (not just 'something will happen').",
    "Uses the word 'because' to connect the prediction to text evidence.",
    "References at least one detail from this chapter."
  ],
  "strongExample": "I predict Grandfather will start to like Heidi because at the end of this chapter he gave her a stool to sit on, which shows he is starting to make room for her in his home.",
  "developingExample": "I think Heidi and Grandfather will get along because he seems okay."
}

Rules:
- "prompt": MUST ask students to PREDICT what will happen in the NEXT chapter, justified with "because" + text evidence from THIS chapter. This is a prediction prompt, NOT a character-analysis prompt.
- "successCriteria": EXACTLY 3 concrete observable criteria.
- "strongExample": a model student response that demonstrates all success criteria.
- "developingExample": a weaker student response that shows partial mastery.

Return ONLY the JSON object. No markdown fences, no commentary.`;

    default:
      return "Return a JSON object for this section.";
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
  workbookContext: Record<string, string>;
  chapterText: string;
}

function serializeVocabulary(vocabulary: VocabularyWord[]): string {
  return vocabulary
    .map((v, i) => `${i + 1}. word="${v.word}" quote="${v.book_quote}" page=${v.page_number}`)
    .join("\n");
}

export function buildTeacherSectionSystemPrompt(input: TeacherGuidePromptInputs): string {
  return `You are generating ONE section of a CB4A Teacher Guide.

Your output is consumed by a TypeScript program that renders the final HTML. You must return ONLY a JSON object matching the shape described in the section-specific requirements below. Do NOT return HTML. Do NOT return markdown fences. Do NOT return commentary.

When the requirements reference workbook questions, character names, vocabulary, or page numbers, pull them from the inputs below — never invent.

Grade calibration (apply to vocabulary depth, sentence complexity, and cognitive demand): ${gradeGuidanceFor(input.grade)}

Required section key: ${input.sectionKey}

Section-specific requirements:
${teacherSectionRequirementByKey(input.sectionKey, input.grade as GradeLevel)}`;
}

export function buildTeacherSectionUserPrompt(input: TeacherGuidePromptInputs): string {
  const workbookContextEntries = Object.entries(input.workbookContext);
  const workbookContextBlock = workbookContextEntries.length === 0
    ? "(none for this section)"
    : workbookContextEntries
      .map(([name, value]) => `--- ${name} ---\n${value}`)
      .join("\n\n");

  return `Book: ${input.bookTitle}
Author: ${input.author}
Chapter: ${input.chapterLabel}
Pages: ${input.pages}
Grade: ${input.grade}

Vocabulary words for this chapter:
${serializeVocabulary(input.vocabulary)}

Section title (for your context only, DO NOT echo): ${input.sectionDisplayTitle}

Workbook context (only the slices relevant for this section):
${workbookContextBlock}

Chapter text:
${input.chapterText}`;
}
