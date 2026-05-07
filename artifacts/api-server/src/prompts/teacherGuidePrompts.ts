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

export interface TeacherGuidePromptInputs {
  sectionKey: string;
  bookTitle: string;
  author: string;
  chapterLabel: string;
  pages: string;
  grade: GradeLevel;
  vocabulary: VocabularyWord[];
  sectionDisplayTitle: string;
  workbookContext: Record<string, string>;
  chapterText: string;
}

export function buildTeacherSectionSystemPrompt(args: TeacherGuidePromptInputs): string {
  const guidance = gradeGuidanceFor(args.grade);
  const requirements = teacherSectionRequirementByKey(args.sectionKey, args.grade, args.vocabulary.length);
  return `You are writing the ${args.sectionDisplayTitle} section of a Teacher Guide for ${args.bookTitle} by ${args.author}.
${guidance}

Use only the provided chapter text and workbook context.
Required section key: ${args.sectionKey}

${requirements}`;
}

export function buildTeacherSectionUserPrompt(args: TeacherGuidePromptInputs): string {
  const context = Object.entries(args.workbookContext)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
  return `Section: ${args.sectionKey}
Title: ${args.sectionDisplayTitle}
Book: ${args.bookTitle}
Author: ${args.author}
Chapter: ${args.chapterLabel}
Pages: ${args.pages}

Workbook context:
${context || "(none)"}

Chapter text:
${args.chapterText}

Vocabulary:
${args.vocabulary.map((v) => `${v.word} — ${v.book_quote}`).join("\n")}`;
}

export function teacherSectionRequirementByKey(key: string, grade?: GradeLevel, vocabCount?: number): string {
  const gradeLevel = (grade ?? 4) as GradeLevel;
  const wordCount = vocabCount ?? 10;
  switch (key) {
    case "measurable_objectives": {
      const standardsBlock = formatStandardsForPrompt(gradeLevel);
      return `Return a JSON object with this exact shape and nothing else:

{
  "objectives": [
    { "text": "Identify and describe the main characters (e.g., Character A, Character B, Character C) using evidence from the text", "standardCode": "RL.${gradeLevel}.3" },
    { "text": "Define ${wordCount} key vocabulary words using context clues and apply them in sentences", "standardCode": "L.${gradeLevel}.4" },
    { "text": "Sequence the major events of [specific chapter event or journey] and explain why each event is important", "standardCode": "RL.${gradeLevel}.1" },
    { "text": "Make inferences about character feelings and motivations based on their actions and dialogue", "standardCode": "RL.${gradeLevel}.3" },
    { "text": "Engage effectively in collaborative discussions by building on others' ideas, asking clarifying questions, and providing text evidence", "standardCode": "SL.${gradeLevel}.1" },
    { "text": "Write narratives to develop real or imagined experiences or events using effective technique, descriptive details, and clear event sequences", "standardCode": "W.${gradeLevel}.3" }
  ]
}

Rules:
- Output 5–6 objective items.
- Each "text" is the verb phrase that follows "Students will be able to". Do NOT prefix it with "Students will be able to" yourself.
- Each "text" begins with a measurable verb (identify, describe, explain, compare, infer, analyze, evaluate, write, etc.).
- For character objectives: name the specific characters who appear in this chapter in parentheses, e.g. "Identify and describe the main characters (Heidi, Peter, Grandfather) using evidence from the text".
- For the vocabulary objective: always use exactly ${wordCount} as the word count — do not change this number.
- For event-sequencing objectives: name the specific event, journey, or situation from this chapter rather than writing "the major events of this chapter" generically.
- Each "standardCode" must be an exact code for grade ${gradeLevel} from the standards block below. Never invent codes.
- The standardCode is the bare code (e.g. "RL.${gradeLevel}.1"), no parentheses, no extra text.

Example output (used only as an example, and not as the default):
Identify and describe the main characters (Heidi, Deta, Grandfather [Alm-Uncle], Peter) using
evidence from the text (RL.3.3).
• Define ten key vocabulary words using context clues and apply them in sentences (L.3.4).
• Sequence the major events of Heidi’s journey up the mountain and explain why each event is
important (RL.3.1).
• Make inferences about character feelings and motivations based on their actions and dialogue
(RL.3.1).
• Engage effectively in collaborative discussions by building on others’ ideas, asking clarifying
questions, and providing text evidence to support thinking (SL.3.1).
• Write narratives to develop real or imagined experiences or events using effective technique,
descriptive details, and clear event sequences (W.3.1).

Available standards (use ONLY these — do not invent codes):
${standardsBlock}

Return ONLY the JSON object. No markdown fences, no commentary.`;
    }

    case "standards": {
      const standardsBlock = formatStandardsForPrompt(gradeLevel);
      return `Return a JSON object with this exact shape and nothing else:

{
  "standards": [
    { "code": "RL.${gradeLevel}.1" },
    { "code": "W.${gradeLevel}.3" }
  ]
}

Rules:
- Pick the standards this chapter actually addresses. Coverage must include at least:
  - one to three Reading standard (RL.${gradeLevel}.* or RI.${gradeLevel}.*)
  - one to three Writing standard (W.${gradeLevel}.*)
  - one to three Reading Language standard (L.${gradeLevel}.*) — vocabulary mini-lesson maps here
  - one to three Reading Speaking and Listening standard (SL.${gradeLevel}.*) — discussion maps here
- Each "code" must be an exact grade-${gradeLevel} code from the standards block below. Do NOT invent codes.
- Standard descriptions are filled in from a code lookup table — do NOT include description text.

Available standards (use ONLY these — do not invent codes):
${standardsBlock}

Return ONLY the JSON object. No markdown fences, no commentary.`;
    }

    case "get_ready_to_read":
      return `Return a JSON object with this exact shape and nothing else:

{
  "implementationSteps": [
    "Display the prompt.",
    "Give students 2–3 quiet writing minutes.",
    "Invite students to share with their neighbor."
  ],
  "connectionTip": "This activates prior knowledge before close reading."
}

Rules:
- implementationSteps must have 4–5 short steps.
- connectionTip must be one concise sentence.
- Never use the phrase "turn-and-talk"; always say "turn to your neighbor" or "share with their neighbor" when describing partner sharing.

Return ONLY the JSON object. No markdown fences, no commentary.`;

    case "words_to_know_mini_lesson":
      return `Return a JSON object with this exact shape and nothing else:

{
  "workedWord": "scrambled",
  "workedQuote": "She scrambled up the path.",
  "workedPage": 12,
  "contextClueStrategy": "Use the verbs around the word and the action in the sentence."
}

Rules:
- Use one real vocabulary word from the chapter.
- Quote must be an exact quote from the chapter.
- workedPage must be the page number where the quote appears.
- Keep each field concise and student-friendly.

Return ONLY the JSON object. No markdown fences, no commentary.`;

    case "guided_reading":
      return `Return a JSON object with this exact shape and nothing else:

{
  "sections": [
    {
      "pageStart": 1,
      "pageEnd": 3,
      "openingPhrase": "...",
      "closingPhrase": "...",
      "questions": [
        { "text": "What is happening here?", "questionType": "comprehension" },
        { "text": "What does this suggest?", "questionType": "inference" }
      ]
    }
  ],
  "readAloudTip": "Pause after each section and ask students to explain their thinking."
}

Question types must be one of: ${QUESTION_TYPES.join(", ")}.
- Use 3–5 sections.
- Each section needs 2–4 questions.
- openingPhrase and closingPhrase must be exact phrases from the chapter.
- readAloudTip must be one short teacher tip.

Return ONLY the JSON object. No markdown fences, no commentary.`;

    case "think_about_the_story_answers":
      return `Return a JSON object with this exact shape and nothing else:

{
  "answers": [
    { "question": "...", "answer": "...", "page": 3 }
  ],
  "inferentialPrompts": [
    "Why do you think ...?",
    "What might ... suggest?"
  ],
  "tieredDiscussion": {
    "literal": ["..."],
    "inference": ["..."],
    "analysis": ["..."],
    "evaluation": ["..."]
  },
  "analyticalThinking": ["..."],
  "personalConnection": ["..."]
}

Rules:
- The "question" field in every answers item must be copied exactly word-for-word from the numbered list in thinkAboutTheStoryQuestions. Use every question, in the same order. Do not rephrase, reorder, or omit any question.
- inferentialPrompts should push beyond literal recall.
- tieredDiscussion must include all four tiers.
- analyticalThinking and personalConnection should each have 2–3 items.

Return ONLY the JSON object. No markdown fences, no commentary.`;

    case "differentiated_supports":
      return `Return a JSON object with this exact shape and nothing else:

{
  "strugglingReaders": {
    "before": ["..."],
    "during": ["..."],
    "after": ["..."]
  },
  "englishLanguageLearners": {
    "before": ["..."],
    "during": ["..."],
    "after": ["..."]
  },
  "advancedStudents": {
    "before": ["..."],
    "during": ["..."],
    "after": ["..."]
  }
}

Rules:
- Each list should be short, practical, and classroom-ready.
- Do not add any extra keys.

Return ONLY the JSON object. No markdown fences, no commentary.`;

    case "common_student_questions":
      return `Return a JSON object with this exact shape and nothing else:

{
  "questions": [
    { "studentQ": "Why did the character do that?", "teacherA": "...", "page": 4 }
  ]
}

Rules:
- Write 5–8 common student questions.
- teacherA should be concise and helpful.
- page is optional if there is no direct citation.

Return ONLY the JSON object. No markdown fences, no commentary.`;

    case "creative_response_common_errors":
      return `Return a JSON object with this exact shape and nothing else:

{
  "characterName": "Heidi",
  "errors": {
    "noSpecificDetails": {
      "paragraph": "...",
      "weakExample": "...",
      "howToFix": "..."
    },
    "breakingCharacter": {
      "paragraph": "...",
      "weakExample": "...",
      "howToFix": "..."
    },
    "retelling": {
      "paragraph": "...",
      "weakExample": "...",
      "howToFix": "..."
    },
    "noEvidence": {
      "paragraph": "...",
      "weakExample": "...",
      "howToFix": "..."
    },
    "modernLanguage": {
      "paragraph": "...",
      "weakExample": "...",
      "howToFix": "..."
    }
  }
}

Rules:
- Provide one short paragraph, one weak example, and one how-to-fix tip for each error.
- characterName should be the main character's name.
- Keep language concrete and teacher-friendly.

Return ONLY the JSON object. No markdown fences, no commentary.`;

    case "exit_ticket":
      return `Return a JSON object with this exact shape and nothing else:

{
  "prompt": "Predict what will happen next chapter, and explain why using a detail from the text.",
  "successCriteria": [
    "Makes a prediction",
    "Uses text evidence",
    "Explains the thinking with because"
  ],
  "strongExample": "...",
  "developingExample": "..."
}

Rules:
- The prompt must ask students to PREDICT what will happen next, not summarize the chapter.
- successCriteria must contain exactly 3 clear observable criteria.
- strongExample and developingExample should each be 2–3 sentences.

Return ONLY the JSON object. No markdown fences, no commentary.`;

    case "answer_key":
      return `Return a JSON object with this exact shape and nothing else:

{
  "readingBetweenTheLines": [
    { "question": "...", "answer": "...", "page": 4 }
  ],
  "digDeeper": [
    { "question": "...", "answer": "...", "page": 5 }
  ],
  "multipleChoice": [
    { "question": "...", "correctLetter": "B", "rationale": "..." }
  ],
  "evidenceFromTheStory": [
    { "question": "...", "sampleAnswer": "...", "quote": "...", "page": 6 }
  ],
  "characterChart": [
    { "characterName": "...", "description": "...", "whatThisShows": "...", "quote": "...", "page": 7 }
  ],
  "drawItDetails": ["...", "...", "..."]
}

Rules:
- Use the workbook context provided to answer only the questions that appear in the workbook.
- For multipleChoice, read the full question + options and return the correct letter plus a short rationale.
- drawItDetails must be 3–5 concrete visual details.

Return ONLY the JSON object. No markdown fences, no commentary.`;

    default:
      throw new Error(`Unknown teacher guide section key: ${key}`);
  }
}
